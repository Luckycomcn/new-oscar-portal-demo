/* 分级用户管理（MVP F-11 / F-12 演示）
   ------------------------------------------------------------------
   演示节点侧的用户与角色管理：层级体系（L0~L5）、用户清单与开户/停用、
   角色权限矩阵、数据范围规则、用户操作审计。
   与「元数据维护」共用 auth.js 的角色模型，切换演示身份可同步看到
   两个模块的权限差异。 */

import { t, tv, getLang } from "../i18n.js";
import { esc, el, fmtNum, toast, download } from "../util.js";
import { ROLES, PERMS, ROLE_BY_ID, DEMO_USERS, session, can, permLabel, roleChain } from "../auth.js";

const zh = (cn, en) => (getLang() === "zh" ? cn : en);

const state = {
  filterRole: "all",
  filterState: "all",
  q: "",
  edit: null,
  audit: [
    { at: "2026-10-08 08:40", who: "u03", act: zh("修改用户角色", "role changed"), obj: "u07：采录员 → 机构管理员", res: zh("成功", "ok") },
    { at: "2026-10-07 17:12", who: "u03", act: zh("停用账户", "account disabled"), obj: "u10.bj.nmc.former", res: zh("成功", "ok") },
    { at: "2026-10-06 09:33", who: "u02", act: zh("新建账户", "account created"), obj: "hk.region2 / 区域管理员", res: zh("成功", "ok") },
    { at: "2026-10-05 14:02", who: "u04", act: zh("重置口令", "password reset"), obj: "hk.nac", res: zh("成功", "ok") },
    { at: "2026-10-02 11:26", who: "u10", act: zh("越权尝试", "privilege escalation attempt"), obj: "批量删除（无权限）", res: zh("已拒绝并告警", "denied + alert") },
  ],
};

/* --------------------------------------------------------------- 用户清单 */

function userRows() {
  const q = state.q.trim().toLowerCase();
  return DEMO_USERS.filter((u) => {
    if (state.filterRole !== "all" && u.role !== state.filterRole) return false;
    if (state.filterState !== "all" && u.state !== state.filterState) return false;
    if (q && !`${u.acct} ${u.name} ${u.org} ${u.terr}`.toLowerCase().includes(q)) return false;
    return true;
  });
}

function paneList(refresh) {
  const rows = userRows();
  const p = el(`<div class="grid g-1-2">
    <div class="panel" id="um-tree">
      <div class="panel-head"><span class="panel-title">${esc(zh("分级体系", "Tier hierarchy"))}</span></div>
      <div class="tree">
        ${roleChain().map((r) => `<div class="t-node ${r.id === session.role.id ? "on" : ""}">
          <span class="lvl">L${r.lvl}</span>${esc(zh(r.zh, r.en))}
          <div class="t-leaf">${esc(zh(r.org, r.org))}</div>
          <div class="t-leaf">${esc(zh(`数据范围：${r.scopeZh}`, `Scope: ${r.scope}`))}</div>
          <div class="t-leaf dim">${esc(zh(r.note.zh, r.note.en))}</div>
        </div>`).join("")}
      </div>
      <div class="notice" style="margin-top:10px">${esc(zh(
        "层级决定两件事：可执行的操作集合，以及可作用的记录范围。下级可提交但不可终审，上级可终审但不必逐条操作。",
        "A tier defines both the operation set and the record scope. Lower tiers submit, higher tiers approve; nobody has to edit record by record.",
      ))}</div>
    </div>

    <div class="panel">
      <div class="panel-head">
        <span class="panel-title">${esc(zh("用户清单", "User accounts"))}</span>
        <span class="chips">
          <input type="search" id="um-q" placeholder="${esc(zh("账号 / 姓名 / 机构", "account / name / org"))}" value="${esc(state.q)}" style="width:190px" />
          <select id="um-role" style="width:150px"><option value="all">${esc(zh("全部角色", "All roles"))}</option>
            ${ROLES.map((r) => `<option value="${r.id}" ${state.filterRole === r.id ? "selected" : ""}>L${r.lvl} ${esc(zh(r.zh, r.en))}</option>`).join("")}</select>
          <select id="um-state" style="width:120px">
            <option value="all">${esc(zh("全部状态", "Any state"))}</option>
            <option value="active" ${state.filterState === "active" ? "selected" : ""}>${esc(zh("启用", "active"))}</option>
            <option value="disabled" ${state.filterState === "disabled" ? "selected" : ""}>${esc(zh("停用", "disabled"))}</option>
          </select>
          <button class="primary" id="um-new" ${can("manage_users") ? "" : "disabled"}>${esc(zh("新建用户", "New user"))}</button>
        </span>
      </div>
      <div class="table-wrap"><table class="data">
        <thead><tr>
          <th>${esc(zh("账号", "Account"))}</th><th style="width:90px">${esc(zh("层级 / 角色", "Tier / role"))}</th>
          <th>${esc(zh("单位", "Organisation"))}</th><th style="width:110px">${esc(zh("属地", "Territory"))}</th>
          <th style="width:130px">${esc(zh("数据范围", "Scope"))}</th><th style="width:90px">${esc(zh("认证", "Auth"))}</th>
          <th style="width:80px">${esc(zh("状态", "State"))}</th><th style="width:130px">${esc(zh("最近登录", "Last login"))}</th>
          <th style="width:140px"></th></tr></thead>
        <tbody>${rows.map((u) => {
    const r = ROLE_BY_ID.get(u.role);
    return `<tr>
      <td class="mono">${esc(u.acct)}<span class="sub">${esc(u.name === "—" ? "—" : u.name)} · ${esc(u.src)}</span></td>
      <td><span class="tag acc">L${r.lvl}</span> <span class="dim">${esc(zh(r.zh, r.en))}</span></td>
      <td class="dim">${esc(u.org)}</td>
      <td class="dim">${esc(tv(u.terr))}</td>
      <td class="dim">${esc(u.scopeNote)}</td>
      <td>${u.mfa ? `<span class="tag ok">MFA</span>` : `<span class="tag warn">${esc(zh("口令", "password"))}</span>`}</td>
      <td><span class="tag ${u.state === "active" ? "ok" : ""}">${esc(u.state === "active" ? zh("启用", "active") : zh("停用", "disabled"))}</span></td>
      <td class="mono dim">${esc(u.login)}</td>
      <td><span class="chips">
        <button class="ghost sm" data-edit="${u.id}" ${can("manage_users") ? "" : "disabled"}>${esc(zh("编辑", "edit"))}</button>
        <button class="ghost sm" data-toggle="${u.id}" ${can("manage_users") ? "" : "disabled"}>${esc(u.state === "active" ? zh("停用", "disable") : zh("启用", "enable"))}</button>
        <button class="ghost sm" data-assume="${u.id}">${esc(zh("以该身份查看", "act as"))}</button>
      </span></td></tr>`;
  }).join("") || `<tr><td colspan="9" class="muted">${esc(zh("无匹配用户", "no matching user"))}</td></tr>`}</tbody>
      </table></div>
      <div class="muted" style="font-size:12px;margin-top:10px">${esc(zh(
        `共 ${fmtNum(DEMO_USERS.length)} 个账户，其中启用 ${DEMO_USERS.filter((u) => u.state === "active").length} 个。账户来源含本地创建、国家目录同步与 WMO 联合身份（单点登录）。`,
        `${DEMO_USERS.length} accounts, ${DEMO_USERS.filter((u) => u.state === "active").length} active. Sources: local, national directory synchronisation and WMO federated identity (SSO).`,
      ))}</div>
    </div>
  </div>`);

  p.querySelector("#um-q").addEventListener("input", (e) => {
    state.q = e.target.value;
    const fresh = paneList(refresh);
    p.replaceWith(fresh);
  });
  p.querySelector("#um-role").addEventListener("change", (e) => { state.filterRole = e.target.value; p.replaceWith(paneList(refresh)); });
  p.querySelector("#um-state").addEventListener("change", (e) => { state.filterState = e.target.value; p.replaceWith(paneList(refresh)); });
  p.querySelector("#um-new").addEventListener("click", () => { state.edit = { id: null }; p.replaceWith(paneForm(refresh)); });
  p.querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", () => {
    state.edit = { id: b.dataset.edit };
    p.replaceWith(paneForm(refresh));
  }));
  p.querySelectorAll("[data-toggle]").forEach((b) => b.addEventListener("click", () => {
    const u = DEMO_USERS.find((x) => x.id === b.dataset.toggle);
    if (!u) return;
    u.state = u.state === "active" ? "disabled" : "active";
    state.audit.unshift({ at: new Date().toISOString().slice(0, 16).replace("T", " "), who: session.user.acct,
      act: u.state === "active" ? zh("启用账户", "account enabled") : zh("停用账户", "account disabled"), obj: u.acct, res: zh("成功", "ok") });
    toast(zh(`${u.acct} 已${u.state === "active" ? zh("启用", "enabled") : zh("停用", "disabled")}`, `${u.acct} ${u.state}`));
    p.replaceWith(paneList(refresh));
  }));
  p.querySelectorAll("[data-assume]").forEach((b) => b.addEventListener("click", () => {
    session.assume(b.dataset.assume);
    toast(zh(`已切换为 ${session.user.acct}（${ROLE_BY_ID.get(session.user.role).zh}）`, `Now acting as ${session.user.acct}`));
    window.dispatchEvent(new CustomEvent("hashchange"));
  }));
  return p;
}

/* --------------------------------------------------------------- 新建 / 编辑 */

function paneForm(refresh) {
  const u = state.edit?.id ? DEMO_USERS.find((x) => x.id === state.edit.id) : null;
  const p = el(`<div class="panel">
    <div class="panel-head"><span class="panel-title">${esc(u ? zh(`编辑用户：${u.acct}`, `Edit user: ${u.acct}`) : zh("新建用户", "New user"))}</span>
      <button class="ghost sm" id="uf-back">${esc(zh("返回清单", "Back to list"))}</button></div>
    <div class="grid g2">
      <label class="field"><span class="lbl">${esc(zh("账号（登录名）", "Account"))}${u ? "" : '<i class="req">*</i>'}</span>
        <input type="text" id="uf-acct" value="${esc(u?.acct || "")}" ${u ? "disabled" : ""} placeholder="cn.xxx" /></label>
      <label class="field"><span class="lbl">${esc(zh("姓名", "Display name"))}</span><input type="text" id="uf-name" value="${esc(u?.name || "")}" /></label>
      <label class="field"><span class="lbl">${esc(zh("角色（决定层级与数据范围）", "Role (sets tier and scope)"))}<i class="req">*</i></span>
        <select id="uf-role">${ROLES.map((r) => `<option value="${r.id}" ${u?.role === r.id ? "selected" : ""}>L${r.lvl} · ${esc(zh(r.zh, r.en))}</option>`).join("")}</select></label>
      <label class="field"><span class="lbl">${esc(zh("单位 / 机构", "Organisation"))}</span><input type="text" id="uf-org" value="${esc(u?.org || "")}" /></label>
      <label class="field"><span class="lbl">${esc(zh("国家 / 属地", "Territory"))}</span>
        <select id="uf-terr">${["(global)", "(multi)", "China", "Hong Kong", "Macao"].map((x) => `<option ${u?.terr === x ? "selected" : ""}>${esc(x)}</option>`).join("")}</select></label>
      <label class="field"><span class="lbl">${esc(zh("认证方式", "Authentication"))}</span>
        <select id="uf-auth">${[zh("口令 + 邮箱", "password + e-mail"), zh("统一身份（单点登录）", "federated SSO"), zh("口令 + 双因素", "password + MFA")].map((x) => `<option>${esc(x)}</option>`).join("")}</select></label>
      <label class="field"><span class="lbl">${esc(zh("有效期至", "Valid until"))}</span><input type="date" id="uf-exp" value="2027-12-31" /></label>
      <label class="field"><span class="lbl">${esc(zh("备注", "Remark"))}</span><input type="text" id="uf-note" placeholder="${esc(zh("职责说明", "duty description"))}" /></label>
    </div>
    <div class="notice" style="margin-top:4px">${esc(zh(
      "开户即按角色授予数据范围；用户不得自行提升角色，角色变更须由具备「用户与角色管理」权限的上级账户执行并留痕。",
      "Scope follows the role on creation; users cannot escalate themselves. Role changes require a superior account holding 'manage users' and are audited.",
    ))}</div>
    <div class="chips" style="margin-top:12px">
      <button class="primary" id="uf-save">${esc(zh("保存（演示）", "Save (demo)"))}</button>
      <button class="ghost" id="uf-pwd">${esc(zh("重置口令并发送一次性链接", "Reset password & send one-time link"))}</button>
      <button id="uf-cancel">${esc(zh("取消", "Cancel"))}</button>
    </div>
    <div id="uf-err" class="mono" style="margin-top:8px"></div>
  </div>`);

  p.querySelector("#uf-back").addEventListener("click", () => p.replaceWith(paneList(refresh)));
  p.querySelector("#uf-cancel").addEventListener("click", () => p.replaceWith(paneList(refresh)));
  p.querySelector("#uf-pwd").addEventListener("click", () => toast(zh("演示：一次性口令链接已发送（不真实发送）", "Demo: one-time link would be sent")));
  p.querySelector("#uf-save").addEventListener("click", () => {
    const acct = p.querySelector("#uf-acct").value.trim();
    const errs = [];
    if (!u && !/^[a-z]{2,4}\.[a-z0-9._-]{2,32}$/.test(acct)) errs.push(zh("账号格式应为 cc.name（cc 为两位国家码）", "account pattern: cc.name"));
    if (!u && DEMO_USERS.some((x) => x.acct === acct)) errs.push(zh("账号已存在", "account already exists"));
    const box = p.querySelector("#uf-err");
    if (errs.length) { box.innerHTML = errs.map((m) => `<div class="issue err">✕ ${esc(m)}</div>`).join(""); return; }
    if (!u) {
      DEMO_USERS.push({ id: `u${DEMO_USERS.length + 1}`, acct, name: p.querySelector("#uf-name").value || "—",
        role: p.querySelector("#uf-role").value, terr: p.querySelector("#uf-terr").value,
        org: p.querySelector("#uf-org").value || "—", state: "active", mfa: false, src: zh("本地", "local"),
        login: "—", scopeNote: ROLE_BY_ID.get(p.querySelector("#uf-role").value).scopeZh });
    }
    state.audit.unshift({ at: new Date().toISOString().slice(0, 16).replace("T", " "), who: session.user.acct,
      act: u ? zh("编辑用户", "user edited") : zh("新建用户", "user created"), obj: acct, res: zh("成功", "ok") });
    toast(u ? zh("已保存（演示，不落库）", "Saved (demo, not persisted)") : zh(`已创建 ${acct}（演示，不落库）`, `${acct} created (demo)`));
    state.edit = null;
    p.replaceWith(paneList(refresh));
  });
  return p;
}

/* --------------------------------------------------------------- 权限矩阵 */

function paneMatrix() {
  const roles = roleChain();
  return el(`<div class="panel">
    <div class="panel-head"><span class="panel-title">${esc(zh("角色权限矩阵", "Role permission matrix"))}</span>
      <span class="tag">${esc(zh("✓ 允许　! 限范围内　✕ 禁止", "✓ allowed　! scoped　✕ denied"))}</span></div>
    <div class="table-wrap" style="max-height:none"><table class="data">
      <thead><tr><th style="width:150px">${esc(zh("权限 \\ 角色", "Permission \\ role"))}</th>
        ${roles.map((r) => `<th style="width:118px">L${r.lvl}<br><span class="dim">${esc(zh(r.zh, r.en))}</span></th>`).join("")}</tr></thead>
      <tbody>${PERMS.map((p) => `<tr><td>${esc(zh(p.zh, p.en))}<span class="sub mono">${esc(p.id)}</span></td>
        ${roles.map((r) => {
    const v = r.perms[p.id] ?? false;
    const lb = permLabel(v);
    const mark = v === true ? "✓" : v === "limited" ? "!" : "✕";
    return `<td><span class="perm ${lb.cls}">${mark} ${esc(zh(lb.zh, lb.en))}</span></td>`;
  }).join("")}</tr>`).join("")}</tbody>
    </table></div>
    <div class="notice" style="margin-top:12px">${esc(zh(
      "分级控制的三条原则：① 越权在前端即被拦截并记录审计；② 数据范围与操作权限分离，能改全球记录不等于能改所有字段；③ 批量操作一律走变更单与审批链，不提供直接落库通道。",
      "Three principles: (1) privilege escalation is blocked at the UI and audited; (2) data scope is separated from operation rights — global reach does not mean every field; (3) bulk operations always go through a change request and approval chain, never a direct write path.",
    ))}</div>
  </div>`);
}

/* --------------------------------------------------------------- 数据范围 */

function paneScope() {
  const users = DEMO_USERS.filter((u) => u.state === "active");
  return el(`<div class="grid g2">
    <div class="panel">
      <div class="panel-head"><span class="panel-title">${esc(zh("数据范围规则", "Data scope rules"))}</span></div>
      <div class="table-wrap" style="max-height:none"><table class="data">
        <thead><tr><th style="width:90px">${esc(zh("层级", "Tier"))}</th><th>${esc(zh("可作用记录", "Records in scope"))}</th><th style="width:200px">${esc(zh("记录数（示例数据）", "Records (sample)"))}</th></tr></thead>
        <tbody>${roleChain().map((r) => `<tr><td><span class="tag acc">L${r.lvl}</span> ${esc(zh(r.zh, r.en))}</td>
          <td class="dim">${esc(zh(r.scopeZh, r.scope))}</td>
          <td class="num">${scopeCount(r)}</td></tr>`).join("")}</tbody>
      </table></div>
      <div class="muted" style="font-size:12px;margin-top:10px">${esc(zh(
        "记录数按当前本地缓存样本估算，仅用于说明范围的量级差异；生产环境按目录实时统计。",
        "Counts are estimated on the local cached sample to illustrate the magnitude of each scope; production counts are computed live against the catalogue.",
      ))}</div>
    </div>
    <div class="panel">
      <div class="panel-head"><span class="panel-title">${esc(zh("账户的范围与来源", "Scope and provenance per account"))}</span></div>
      <div class="table-wrap" style="max-height:none"><table class="data">
        <thead><tr><th>${esc(zh("账号", "Account"))}</th><th>${esc(zh("数据范围", "Scope"))}</th><th style="width:130px">${esc(zh("来源", "Source"))}</th></tr></thead>
        <tbody>${users.map((u) => `<tr><td class="mono">${esc(u.acct)}</td><td class="dim">${esc(u.scopeNote)}</td>
          <td><span class="tag">${esc(u.src)}</span></td></tr>`).join("")}</tbody>
      </table></div>
      <div class="notice" style="margin-top:12px">${esc(zh(
        "身份来源决定账户生命周期：本地账户随人员变动手工维护；国家目录同步账户随目录侧停用自动停用；联合身份账户由 WMO 目录单点登录托管，离职即失效。",
        "Provenance drives lifecycle: local accounts are maintained manually; directory-synchronised accounts follow the national directory; federated accounts are hosted by WMO SSO and expire on offboarding.",
      ))}</div>
    </div>
  </div>`);
}

function scopeCount(r) {
  const per = { super: 62134, regional: 18400, national: 225, org: 1842, editor: 12, readonly: 58900 }[r.id];
  return fmtNum(per ?? 0);
}

/* --------------------------------------------------------------- 视图 */

export function renderUsers() {
  const node = el(`<div>
    <h1 class="page-title">${esc(zh("用户与权限管理", "Users and access control"))}</h1>
    <p class="page-desc">${esc(zh(
      "分级用户管理：按 L0~L5 六个层级分配角色，角色同时决定「可做什么」与「能对哪些记录做」，并留存用户操作审计。当前演示身份：",
      "Tiered user management: six tiers (L0–L5); a role defines both what may be done and on which records, with a full audit trail. Current demo identity:",
    ))}<span class="mono">${esc(session.user.acct)}</span> · ${esc(zh(ROLE_BY_ID.get(session.user.role).zh, ROLE_BY_ID.get(session.user.role).en))}</p>

    <div class="tabs" id="um-tabs">
      ${[["list", "用户清单", "Accounts"], ["matrix", "权限矩阵", "Permission matrix"], ["scope", "数据范围", "Data scope"], ["audit", "用户审计", "User audit"]]
    .map(([k, a, b]) => `<button class="tab${k === (state.tab || "list") ? " on" : ""}" data-tab="${k}">${esc(zh(a, b))}</button>`).join("")}
    </div>
    <div id="um-body"></div>
  </div>`);

  const body = node.querySelector("#um-body");
  const draw = () => {
    const tab = state.tab || "list";
    const map = { list: paneList, matrix: paneMatrix, scope: paneScope, audit: paneAudit };
    body.replaceChildren((map[tab] || paneList)(draw));
    node.querySelectorAll("#um-tabs .tab").forEach((b) => b.classList.toggle("on", b.dataset.tab === tab));
  };
  node.querySelectorAll("#um-tabs .tab").forEach((b) => b.addEventListener("click", () => { state.tab = b.dataset.tab; draw(); }));
  draw();
  return node;
}

function paneAudit() {
  const p = el(`<div class="panel">
    <div class="panel-head"><span class="panel-title">${esc(zh("用户与权限操作审计", "User and access audit"))}</span>
      <button class="ghost sm" id="ua-dl">${esc(zh("导出 CSV", "Export CSV"))}</button></div>
    <div class="table-wrap" style="max-height:none"><table class="data">
      <thead><tr><th style="width:140px">${esc(zh("时间", "Time"))}</th><th style="width:110px">${esc(zh("操作者", "Actor"))}</th>
        <th>${esc(zh("动作", "Action"))}</th><th>${esc(zh("对象", "Object"))}</th><th style="width:110px">${esc(zh("结果", "Result"))}</th></tr></thead>
      <tbody>${state.audit.map((a) => `<tr><td class="mono">${esc(a.at)}</td><td class="mono">${esc(a.who)}</td>
        <td>${esc(a.act)}</td><td class="dim">${esc(a.obj)}</td>
        <td><span class="tag ${a.res === zh("成功", "ok") ? "ok" : "bad"}">${esc(a.res)}</span></td></tr>`).join("")}</tbody>
    </table></div>
    <div class="notice" style="margin-top:12px">${esc(zh(
      "审计记录不可编辑、不可删除，保留期不少于 5 年；越权尝试与批量操作会被单独标记，便于事后追溯。",
      "Audit entries are immutable and retained for at least five years; privilege-escalation attempts and bulk operations are tagged for traceability.",
    ))}</div>
  </div>`);
  p.querySelector("#ua-dl").addEventListener("click", () => {
    const head = "time,actor,action,object,result\n";
    const body2 = state.audit.map((a) => [a.at, a.who, a.act, a.obj, a.res].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    download("wigos_user_audit.csv", head + body2 + "\n", "text/csv;charset=utf-8");
    toast(t("toast.exported"));
  });
  return p;
}
