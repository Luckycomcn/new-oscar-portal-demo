/* 分级用户与权限模型（演示）
   ------------------------------------------------------------------
   元数据写操作在 WIGOS 节点侧完成，本模块演示其权限与审批骨架：
   角色按层级（L0~L5）分级，每一级绑定「数据范围」与「操作权限」，
   页面所有写按钮按 can() 结果启用/禁用，越权操作给出提示而非隐藏，
   以便演示时说明分级控制的效果。

   约定：can(perm) 返回
     true      —— 允许
     "limited" —— 允许，但受数据范围约束（越出范围的部分不可选）
     false     —— 禁止                                                  */

import { store } from "./data.js";

/* ------------------------------------------------------------------ 权限项 */
export const PERMS = [
  { id: "view",        zh: "查看记录",       en: "View records" },
  { id: "create",      zh: "新建记录",       en: "Create records" },
  { id: "update",      zh: "修改记录",       en: "Update records" },
  { id: "delete",      zh: "删除记录",       en: "Delete records" },
  { id: "bulk_import", zh: "批量导入",       en: "Bulk import" },
  { id: "bulk_update", zh: "批量修改",       en: "Bulk update" },
  { id: "bulk_delete", zh: "批量删除",       en: "Bulk delete" },
  { id: "approve",     zh: "审批变更",       en: "Approve changes" },
  { id: "publish",     zh: "发布至目录",     en: "Publish to catalogue" },
  { id: "manage_users",zh: "用户与角色管理", en: "Manage users and roles" },
  { id: "view_audit",  zh: "查看审计日志",   en: "View audit log" },
];

/* ------------------------------------------------------------------ 角色 */
export const ROLES = [
  {
    id: "super", lvl: 0, zh: "超级管理员", en: "Super administrator",
    org: "WMO 秘书处 / 系统运营方", scope: "global", scopeZh: "全球全部记录",
    perms: { view: true, create: true, update: true, delete: true, bulk_import: true, bulk_update: true,
      bulk_delete: true, approve: true, publish: true, manage_users: true, view_audit: true },
    note: { zh: "唯一可执行物理删除与发布；管理全部用户与角色", en: "Only role allowed to purge and publish; manages all users" },
  },
  {
    id: "regional", lvl: 1, zh: "区域管理员", en: "Regional administrator",
    org: "WMO 区域协调中心", scope: "region", scopeZh: "本 WMO 区域",
    perms: { view: true, create: true, update: true, delete: true, bulk_import: true, bulk_update: true,
      bulk_delete: true, approve: true, publish: false, manage_users: "limited", view_audit: true },
    note: { zh: "审批区域内变更，不得发布至全球目录", en: "Approves regional changes; cannot publish globally" },
  },
  {
    id: "national", lvl: 2, zh: "国家管理员", en: "National administrator",
    org: "国家 meteorological 主管部门（示例：中国）", scope: "territory", scopeZh: "本国家 / 属地",
    perms: { view: true, create: true, update: true, delete: true, bulk_import: true, bulk_update: true,
      bulk_delete: true, approve: true, publish: false, manage_users: "limited", view_audit: "limited" },
    note: { zh: "本属地记录的最终审批人；只能管理本属地账户", en: "Final approver for its territory; manages only local accounts" },
  },
  {
    id: "org", lvl: 3, zh: "机构管理员", en: "Organisation administrator",
    org: "台站所属机构", scope: "org", scopeZh: "本机构全部记录",
    perms: { view: true, create: true, update: true, delete: false, bulk_import: true, bulk_update: true,
      bulk_delete: false, approve: "limited", publish: false, manage_users: false, view_audit: "limited" },
    note: { zh: "可维护本机构记录并提交审批，不得删除、不得审批他人变更", en: "Maintains own organisation's records; cannot delete or approve others' changes" },
  },
  {
    id: "editor", lvl: 4, zh: "授权采录员", en: "Authorised data editor",
    org: "台站运维单位", scope: "own", scopeZh: "本人负责的记录",
    perms: { view: true, create: true, update: true, delete: false, bulk_import: false, bulk_update: false,
      bulk_delete: false, approve: false, publish: false, manage_users: false, view_audit: false },
    note: { zh: "仅逐条新建与修改，改动进入草稿待机构管理员复核", en: "Record-by-record edits only; changes enter drafts for review" },
  },
  {
    id: "readonly", lvl: 5, zh: "只读用户", en: "Read-only user",
    org: "公众 / 研究机构", scope: "public", scopeZh: "已发布记录的公开要素",
    perms: { view: true, create: false, update: false, delete: false, bulk_import: false, bulk_update: false,
      bulk_delete: false, approve: false, publish: false, manage_users: false, view_audit: false },
    note: { zh: "仅可查看与导出已发布记录", en: "May view and export published records only" },
  },
];

export const ROLE_BY_ID = new Map(ROLES.map((r) => [r.id, r]));

/* ------------------------------------------------------------------ 演示用户 */
export const DEMO_USERS = [
  { id: "u01", acct: "wmo.super", name: "K. Mensah", role: "super", terr: "(global)", org: "WMO Secretariat", state: "active", mfa: true, src: "本地", login: "2026-10-07T09:12", scopeNote: "全球" },
  { id: "u02", acct: "hk.region2", name: "L. Chan", role: "regional", terr: "(multi)", org: "WMO Region II (Asia)", state: "active", mfa: true, src: "WMO 联合身份", login: "2026-10-07T22:40", scopeNote: "区域二" },
  { id: "u03", acct: "cn.nac", name: "王建国", role: "national", terr: "China", org: "中国气象局", state: "active", mfa: true, src: "本地", login: "2026-10-08T08:05", scopeNote: "中国（含港澳台另计）" },
  { id: "u04", acct: "hk.nac", name: "陈志强", role: "national", terr: "Hong Kong", org: "香港天文台", state: "active", mfa: true, src: "本地", login: "2026-10-06T16:22", scopeNote: "香港" },
  { id: "u05", acct: "bj.nmc", name: "赵敏", role: "org", terr: "China", org: "国家气象信息中心", state: "active", mfa: false, src: "本地", login: "2026-10-08T07:31", scopeNote: "本机构 1 842 条" },
  { id: "u06", acct: "sh.cma", name: "李伟", role: "org", terr: "China", org: "上海市气象局", state: "active", mfa: false, src: "国家目录同步", login: "2026-10-05T11:09", scopeNote: "本机构 216 条" },
  { id: "u07", acct: "gz.station", name: "刘敏", role: "editor", terr: "China", org: "广州天河气象观测站", state: "active", mfa: false, src: "本地", login: "2026-10-08T06:58", scopeNote: "本人负责 12 条" },
  { id: "u08", acct: "ur.station", name: "A. Ahmat", role: "editor", terr: "China", org: "乌鲁木齐观测站", state: "active", mfa: false, src: "本地", login: "2026-10-04T14:47", scopeNote: "本人负责 8 条" },
  { id: "u09", acct: "guest.demo", name: "—", role: "readonly", terr: "(multi)", org: "公开访问", state: "active", mfa: false, src: "本地", login: "2026-10-08T10:02", scopeNote: "已发布公开要素" },
  { id: "u10", acct: "bj.nmc.former", name: "孙立", role: "editor", terr: "China", org: "国家气象信息中心", state: "disabled", mfa: false, src: "本地", login: "2026-06-30T09:00", scopeNote: "已离职，停用" },
];

/* ------------------------------------------------------------------ 当前登录（演示可切换） */
const ROLE_KEY = "wigos-demo-role";

export const session = {
  userId: "u03",
  get user() { return DEMO_USERS.find((u) => u.id === this.userId) || DEMO_USERS[0]; },
  get role() { return ROLE_BY_ID.get(this.user.role) || ROLES[ROLES.length - 1]; },
  /** 演示：以指定角色身份查看（等价于切换登录账号） */
  assume(userId) {
    this.userId = userId;
    try { localStorage.setItem(ROLE_KEY, userId); } catch { /* 隐私模式下忽略 */ }
  },
  restore() {
    try {
      const v = localStorage.getItem(ROLE_KEY);
      if (v && DEMO_USERS.some((u) => u.id === v)) this.userId = v;
    } catch { /* 忽略 */ }
  },
};

/** 权限判定：true | "limited" | false */
export function can(perm, roleId = session.role.id) {
  const r = ROLE_BY_ID.get(roleId);
  if (!r) return false;
  return r.perms[perm] ?? false;
}

export function permLabel(v) {
  if (v === true) return { cls: "ok", zh: "允许", en: "allowed" };
  if (v === "limited") return { cls: "warn", zh: "范围内", en: "scoped" };
  return { cls: "bad", zh: "禁止", en: "denied" };
}

/* ------------------------------------------------------------------ 数据范围 */

/** 当前角色可维护的记录范围（演示：按属地/区域近似判定） */
export function inScope(station, roleId = session.role.id) {
  const r = ROLE_BY_ID.get(roleId);
  if (!r || station == null) return false;
  const user = session.user;
  switch (r.scope) {
    case "global": return true;
    case "region": return ["Asia", "Europe"].includes(station.ra);
    case "territory": return station.terr === user.terr;
    case "org": return station.terr === user.terr;
    case "own": return (DEMO_USERS.find((u) => u.id === user.id)?.scopeNote || "").includes("本人负责")
      ? ["广州", "乌鲁木齐"].some((k) => (station.name || "").includes(k))
      : station.terr === user.terr;
    case "public": return station.decl === "Operational";
    default: return false;
  }
}

/** 范围内记录 id 集合（一次遍历，供批量操作与列表禁用态使用） */
export function scopeIds(roleId = session.role.id) {
  const ids = new Set();
  for (const s of store.stations) if (inScope(s, roleId)) ids.add(String(s.id));
  return ids;
}

/** 分级体系说明（用户管理页展示） */
export function roleChain() {
  return [...ROLES].sort((a, b) => a.lvl - b.lvl);
}
