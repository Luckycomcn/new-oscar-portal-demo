/* 元数据维护（MVP F-4 / F-6 / F-7 写侧演示）
   ------------------------------------------------------------------
   演示节点侧（WIGOS Node）维护能力，页面内的任何操作**不产生真实写操作**：
     · 单条修改：分区表单 + 校验 + 变更前后差异对照
     · 新建记录：WSI 分配演示 + 必填校验
     · 批量导入：CSV / WMDR V2 解析预览与逐行校验
     · 批量修改：范围选择 + 字段操作规则 + 影响预览
     · 批量删除：勾选 + 原因 + 删除方式（逻辑删除 / 物理删除）
     · 变更与审批：草稿箱、审批链推进、版本历史、审计日志
   所有写按钮按 auth.js 的分级权限启用，越权给出提示而不隐藏。 */

import { store } from "../data.js";
import { currentRows } from "./search.js";
import { t, tv, getLang } from "../i18n.js";
import { esc, el, fmtNum, fmtCoord, toast, download } from "../util.js";
import { session, can, permLabel, scopeIds, DEMO_USERS, ROLE_BY_ID } from "../auth.js";

/* --------------------------------------------------------------- 表单定义 */

const FORM = [
  { id: "id", zh: "标识", en: "Identification", fields: [
    { k: "wigos", l: { zh: "WIGOS 台站标识符", en: "WIGOS ID" }, req: true, ro: true, ph: "0-20000-0-60415" },
    { k: "name", l: { zh: "站点名称", en: "Station name" }, req: true },
    { k: "alias", l: { zh: "别名（分号分隔）", en: "Aliases (; separated)" } },
    { k: "progId", l: { zh: "计划专属标识", en: "Programme-specific ID" } },
    { k: "type", l: { zh: "站点类型", en: "Station type" }, req: true, vocab: "types" },
    { k: "cls", l: { zh: "站点分级", en: "Station class" }, vocab: "classes" },
  ] },
  { id: "loc", zh: "位置", en: "Location", fields: [
    { k: "lat", l: { zh: "纬度", en: "Latitude" }, req: true, num: true, min: -90, max: 90 },
    { k: "lon", l: { zh: "经度", en: "Longitude" }, req: true, num: true, min: -180, max: 180 },
    { k: "elev", l: { zh: "海拔（m）", en: "Elevation (m)" }, num: true, min: -500, max: 9000 },
    { k: "hp", l: { zh: "气压表高度（m）", en: "Barometer height (m)" }, num: true, min: -500, max: 9000 },
    { k: "geopos", l: { zh: "定位方法", en: "Positioning method" } },
    { k: "tz", l: { zh: "时区", en: "Time zone" }, ph: "Asia/Shanghai" },
  ] },
  { id: "prog", zh: "计划与网络隶属", en: "Programme affiliation", fields: [
    { k: "prog", l: { zh: "计划 / 网络", en: "Programme / network" }, vocab: "programs" },
    { k: "decl", l: { zh: "申报状态", en: "Declared status" }, vocab: "declared" },
    { k: "ass", l: { zh: "评估状态", en: "Assessed status" }, vocab: "assessed" },
    { k: "center", l: { zh: "评估中心", en: "Assessing centre" } },
  ] },
  { id: "org", zh: "机构与联系人", en: "Organisation & contacts", fields: [
    { k: "org", l: { zh: "监管机构", en: "Supervising organisation" } },
    { k: "contactRole", l: { zh: "联系人职能", en: "Contact function" }, ph: "Manager" },
    { k: "terr", l: { zh: "国家 / 属地", en: "Country / territory" }, req: true, vocab: "territories" },
  ] },
  { id: "life", zh: "生命周期", en: "Lifecycle", fields: [
    { k: "est", l: { zh: "建立日期", en: "Date established" }, date: true },
    { k: "closed", l: { zh: "关闭日期", en: "Date closed" }, date: true },
    { k: "reason", l: { zh: "变更原因", en: "Reason for change" }, req: true, ph: "metadata correction / annual update" },
  ] },
];

const DEL_REASONS = [
  { id: "dup", zh: "重复记录（合并至主记录）", en: "Duplicate (merge into primary)" },
  { id: "void", zh: "记录作废", en: "Record voided" },
  { id: "test", zh: "测试 / 演练数据", en: "Test / exercise data" },
  { id: "priv", zh: "涉密或隐私不宜公开", en: "Sensitive or privacy restricted" },
];

const APPROVAL_CHAIN = ["采录员提交", "机构管理员复核", "国家管理员审批", "区域协调中心备案", "发布至目录"];

/* --------------------------------------------------------------- 演示状态 */

const state = {
  tab: "single",
  drafts: [
    { id: "C-2026-1043", kind: "update", target: "0-20000-0-60415", actor: "u07", role: "editor", at: "2026-10-07T16:20", items: 3, status: 2,
      note: "上垫面与定位方法按 2026 年观测年报更正" },
    { id: "C-2026-1038", kind: "import", target: "GOS 区域二季度批量上报（214 条）", actor: "u02", role: "regional", at: "2026-10-06T11:02", items: 214, status: 4,
      note: "CSV 导入，校验通过 212 / 警告 2" },
  ],
  audit: [
    { at: "2026-10-08T08:31", who: "u03", act: "登录", obj: "门户", res: "成功", ip: "10.20.1.16" },
    { at: "2026-10-08T08:12", who: "u03", act: "批量修改（草稿）", obj: "国家 / 属地 = China，共 214 条", res: "待审批", ip: "10.20.1.16" },
    { at: "2026-10-07T16:20", who: "u07", act: "修改记录", obj: "0-20000-0-60415", res: "待审批", ip: "10.30.7.4" },
  ],
  seq: 1044,
};

/* --------------------------------------------------------------- 工具 */

const zh = (cn, en) => (getLang() === "zh" ? cn : en);

function optionsOf(vocab) {
  const f = store.facets || {};
  const src = { types: f.types, classes: f.classes, programs: f.programNames,
    territories: f.territories, declared: f.declared, assessed: f.assessed }[vocab];
  return (src || []).slice(0, 60).map(([v, n]) => `<option value="${esc(v)}">${esc(tv(v))}${n ? ` · ${esc(n)}` : ""}</option>`).join("");
}

function stationToForm(s) {
  const e = store.enrich[String(s.id)] || {};
  return {
    wigos: s.wigos || "", name: s.name || "", alias: "", progId: "",
    type: s.type || "", cls: e.c || s.cls || "",
    lat: s.lat ?? "", lon: s.lon ?? "", elev: s.elev ?? "", hp: s.hp ?? "",
    geopos: "", tz: "",
    prog: (s.prog || []).map((p) => p.n).join("; "),
    decl: s.decl || "", ass: s.ass || "", center: "",
    org: e.o || "", contactRole: "", terr: s.terr || "",
    est: s.est || "", closed: s.closed || "", reason: "",
  };
}

/** 校验：返回 [{k, level:'err'|'warn', msg}] */
function validate(v) {
  const out = [];
  for (const sec of FORM) {
    for (const f of sec.fields) {
      const val = (v[f.k] ?? "").toString().trim();
      if (f.req && !val) out.push({ k: f.k, level: "err", msg: zh("必填要素缺失", "mandatory element missing") });
      if (f.num && val !== "") {
        const n = Number(val);
        if (!Number.isFinite(n)) out.push({ k: f.k, level: "err", msg: zh("不是数值", "not a number") });
        else if (f.min != null && (n < f.min || n > f.max)) {
          out.push({ k: f.k, level: "err", msg: `${zh("取值须在", "must be within ")}${f.min} ~ ${f.max}` });
        }
      }
      if (f.req && val && f.k === "wigos" && !/^\d{1,6}-\d{1,6}-\d{1,6}$/.test(val)) {
        out.push({ k: f.k, level: "err", msg: zh("WSI 格式应为 0-20000-0-60415", "WSI pattern expected: 0-20000-0-60415") });
      }
      if (f.req && val && f.k === "terr" && !(store.facets?.territories || []).some(([x]) => x === val)) {
        out.push({ k: f.k, level: "warn", msg: zh("不在受控词表内，将触发审批复核", "outside the controlled vocabulary; approval review required") });
      }
    }
  }
  if (v.est && v.closed && String(v.closed) < String(v.est)) {
    out.push({ k: "closed", level: "err", msg: zh("关闭日期早于建立日期", "closure date precedes establishment date") });
  }
  if ((v.lat !== "" && v.lat != null) && (v.lon === "" || v.lon == null)) {
    out.push({ k: "lon", level: "warn", msg: zh("仅有纬度，将按所在国家中心点补齐并标注", "longitude missing; will be derived from country centroid and flagged") });
  }
  return out;
}

function diffRows(before, after) {
  const rows = [];
  for (const sec of FORM) {
    for (const f of sec.fields) {
      if (f.ro) continue;
      const a = (before[f.k] ?? "").toString().trim();
      const b = (after[f.k] ?? "").toString().trim();
      if (a !== b) rows.push({ sec: zh(sec.zh, sec.en), k: f.k, label: zh(f.l.zh, f.l.en), before: a || "—", after: b || "—" });
    }
  }
  return rows;
}

function logAudit(act, obj, res) {
  const u = session.user;
  state.audit.unshift({ at: new Date().toISOString().slice(0, 19).replace("T", " "), who: u.acct, act, obj, res, ip: "10.20.1.16" });
}

function addDraft(kind, target, items, note) {
  const id = `C-2026-${state.seq++}`;
  const u = session.user;
  state.drafts.unshift({ id, kind, target, actor: u.acct, role: u.role, at: new Date().toISOString().slice(0, 16).replace("T", " "), items, status: 1, note });
  logAudit(`${zh("新建变更单", "created change")}（${kind}）`, target, zh("待审批", "pending approval"));
  return id;
}

/* --------------------------------------------------------------- 权限条 */

function roleBar() {
  const u = session.user;
  const r = ROLE_BY_ID.get(u.role);
  return `
  <div class="panel" id="ed-role">
    <div class="role-line">
      <span class="tag acc">L${r.lvl}</span>
      <span class="mono">${esc(u.acct)}</span>
      <span class="dim">${esc(zh(r.zh, r.en))}</span>
      <span class="dim">· ${esc(zh(r.org, r.org))}</span>
      <span class="tag ${r.scope === "global" ? "ok" : "warn"}">${esc(zh(`数据范围：${r.scopeZh}`, `Scope: ${r.scope}`))}</span>
      <select id="ed-assume" title="${esc(zh("演示：以其他账号身份查看，验证分级控制", "Demo: view as another account to verify tiered control"))}">
        ${DEMO_USERS.map((x) => `<option value="${x.id}" ${x.id === u.id ? "selected" : ""}>${esc(zh(`${x.acct}（${ROLE_BY_ID.get(x.role).zh}）`, `${x.acct} (${ROLE_BY_ID.get(x.role).en})`))}</option>`).join("")}
      </select>
    </div>
    <div class="chips" style="margin-top:10px">
      ${["create", "update", "delete", "bulk_import", "bulk_update", "bulk_delete", "approve", "publish", "manage_users"]
        .map((p) => {
          const v = can(p);
    const lb = permLabel(v);
    return `<span class="perm ${lb.cls}">${esc(p)}${lb.cls === "warn" ? "·范围" : ""}${v === false ? "·禁止" : ""}</span>`;
  }).join("")}
    </div>
    <div class="muted" style="font-size:12px;margin-top:8px">${esc(zh(
      "写操作由 WIGOS 节点承担，本页为沙箱演示：改动只进入草稿与审批链，不写库、不发布。切换上方账号可见按钮按分级权限启用或禁用。",
      "Write operations belong to the WIGOS Node. This page is a sandbox demo: changes only enter the draft and approval chain, nothing is written or published. Switch the account above to see tiered permission enforcement.",
    ))}</div>
  </div>`;
}

/* --------------------------------------------------------------- 视图 */

export function renderEdit() {
  const node = el(`<div>
    <h1 class="page-title">${esc(zh("元数据维护", "Metadata maintenance"))}</h1>
    <p class="page-desc">${esc(zh(
      "演示 WIGOS 节点侧的元数据写能力：逐条新建与修改、批量导入 / 修改 / 删除，全部改动经校验进入变更单并按分级审批链推进。门户只读缓存不受影响。",
      "Node-side metadata write capabilities: record-by-record create and update, bulk import / update / delete. Every change is validated, turned into a change request and advanced along a tiered approval chain. The portal's read-only cache is untouched.",
    ))}</p>
    ${roleBar()}
    <div class="tabs" id="ed-tabs">
      ${[["single", "单条修改", "Single update"], ["create", "新建记录", "Create"], ["import", "批量导入", "Bulk import"],
    ["bulk", "批量修改", "Bulk update"], ["del", "批量删除", "Bulk delete"], ["flow", "变更与审批", "Changes & approval"]]
    .map(([k, a, b]) => `<button class="tab${k === state.tab ? " on" : ""}" data-tab="${k}">${esc(zh(a, b))}</button>`).join("")}
    </div>
    <div id="ed-body"></div>
  </div>`);

  const body = node.querySelector("#ed-body");
  const draw = () => {
    const map = { single: paneSingle, create: paneCreate, import: paneImport, bulk: paneBulk, del: paneDelete, flow: paneFlow };
    body.replaceChildren((map[state.tab] || paneSingle)(draw));
    node.querySelectorAll("#ed-tabs .tab").forEach((b) => b.classList.toggle("on", b.dataset.tab === state.tab));
  };
  node.querySelectorAll("#ed-tabs .tab").forEach((b) => b.addEventListener("click", () => { state.tab = b.dataset.tab; draw(); }));
  node.querySelector("#ed-assume").addEventListener("change", (ev) => {
    session.assume(ev.target.value);
    toast(zh(`已切换为 ${session.user.acct}（${ROLE_BY_ID.get(session.user.role).zh}）`, `Now acting as ${session.user.acct}`));
    window.dispatchEvent(new CustomEvent("hashchange"));
  });
  draw();
  return node;
}

/* 通用：记录选择器（限本角色数据范围内） */
function recordPicker(id, actionLabel) {
  const ids = scopeIds();
  const list = store.stations.filter((s) => ids.has(String(s.id))).slice(0, 200);
  return `
  <label class="field"><span class="lbl">${esc(zh("选择记录（本角色范围内前 200 条）", "Record (first 200 within your scope)"))}</span>
    <select id="${id}">
      ${list.map((s) => `<option value="${s.id}">${esc(s.name)} · ${esc(s.wigos || s.id)} · ${esc(tv(s.terr))}</option>`).join("")}
    </select>
  </label>
  <div class="muted" style="font-size:12px;margin:-4px 0 10px">${esc(zh(
    `共 ${fmtNum(ids.size)} 条记录在本角色数据范围内；范围外记录不进入可选列表。`,
    `${fmtNum(ids.size)} records are within your scope; out-of-scope records are not selectable.`,
  ))}</div>
  <button class="primary" id="${id}-go">${esc(actionLabel)}</button>`;
}

/* ---------------------------------------------------------- 面板：单条修改 */

function paneSingle(refresh) {
  const p = el(`<div class="grid g2">
    <div class="panel" id="ed-sel">
      <div class="panel-head"><span class="panel-title">1 · ${esc(zh("定位记录", "Locate record"))}</span></div>
      ${recordPicker("ed-one", zh("载入表单 →", "Load into form →"))}
      <div class="mono-box" style="margin-top:12px">${esc(zh(
        "也可从检索页勾选记录后「带入维护」，或在站点记录页点击「在节点维护元数据」跳转本模块。",
        "Alternatively, bring records from the search page, or use 'Maintain in Node' on a station page.",
      ))}</div>
    </div>
    <div class="panel" id="ed-val">
      <div class="panel-head"><span class="panel-title">2 · ${esc(zh("校验与提交", "Validate and submit"))}</span></div>
      <div id="ed-vlist" class="mono">${esc(zh("载入记录后显示校验结论。", "Validation results appear after loading a record."))}</div>
    </div>
  </div>
  <div class="panel" style="margin-top:16px"><div class="panel-head"><span class="panel-title">3 · ${esc(zh("变更前后差异对照", "Change diff"))}</span></div>
    <div id="ed-diff" class="empty-state">${esc(zh("尚无变更。修改任一字段后，此处列出提交前的逐字段差异，供复核人确认。",
    "No change yet. After editing fields, a field-by-field diff is listed here for the reviewer."))}</div>
  </div>`);

  const sel = p.querySelector("#ed-one");
  const form = el(`<div class="panel" style="margin-top:16px"><div class="panel-head"><span class="panel-title">${esc(zh("元数据表单（WIGOS 标准必备要素）", "Metadata form (WIGOS mandatory elements)"))}</span></div>
    <div class="form-grid">${FORM.map((sec) => `<div class="section" style="grid-column:1/-1"><h3><span class="idx">${esc(sec.id.toUpperCase())}</span>${esc(zh(sec.zh, sec.en))}</h3>
      <div class="grid g2">${sec.fields.map((f) => `<label class="field"><span class="lbl">${esc(zh(f.l.zh, f.l.en))}${f.req ? '<i class="req">*</i>' : ""}</span>
        ${f.vocab
    ? `<select data-k="${f.k}" ${f.ro ? "disabled" : ""}><option value="">—</option>${optionsOf(f.vocab)}</select>`
    : `<input type="${f.num ? "number" : f.date ? "date" : "text"}" data-k="${f.k}" ${f.ro ? "disabled" : ""} ${f.ph ? `placeholder="${esc(f.ph)}"` : ""} />`}
      </label>`).join("")}</div></div>`).join("")}</div>
    <div class="chips" style="margin-top:12px">
      <button class="primary" id="ed-save" ${can("update") ? "" : "disabled"}>${esc(zh("保存为草稿并提交复核", "Save draft & submit for review"))}</button>
      <button id="ed-reset">${esc(zh("放弃修改", "Discard"))}</button>
      <button class="ghost" id="ed-hist">${esc(zh("版本历史", "Version history"))}</button>
    </div>
    <div class="muted" style="font-size:12px;margin-top:8px">${esc(zh(
      "标识（WIGOS ID）由系统分配不可编辑；改动须填写「变更原因」，随变更单一并留痕。",
      "The WIGOS ID is system-assigned and read-only; a reason for change is mandatory and travels with the change request.",
    ))}</div>
  </div>`);

  let current = null;
  let before = null;
  const inputs = [...form.querySelectorAll("[data-k]")];
  const values = () => Object.fromEntries(inputs.map((i) => [i.dataset.k, i.value]));

  const renderDiff = () => {
    const box = p.querySelector("#ed-diff");
    if (!before) return;
    const rows = diffRows(before, values());
    box.className = rows.length ? "table-wrap" : "empty-state";
    box.innerHTML = rows.length
      ? `<table class="data"><thead><tr><th style="width:120px">${esc(zh("要素段", "Section"))}</th><th>${esc(zh("字段", "Field"))}</th><th>${esc(zh("修改前", "Before"))}</th><th>${esc(zh("修改后", "After"))}</th></tr></thead>
         <tbody>${rows.map((r) => `<tr><td class="dim">${esc(r.sec)}</td><td>${esc(r.label)}</td><td class="mono">${esc(r.before)}</td><td class="mono diff-after">${esc(r.after)}</td></tr>`).join("")}</tbody></table>`
      : esc(zh("尚无变更。修改任一字段后，此处列出提交前的逐字段差异，供复核人确认。",
        "No change yet. After editing fields, a field-by-field diff is listed here for the reviewer."));
  };

  const loadForm = (station) => {
    current = station;
    before = stationToForm(station);
    for (const i of inputs) i.value = before[i.dataset.k] ?? "";
    renderDiff();
    const issues = validate(before);
    const box = p.querySelector("#ed-vlist");
    box.innerHTML = issues.length
      ? issues.map((i) => `<div class="issue ${i.level}">${i.level === "err" ? "✕" : "!"} ${esc(zh(i.k, i.k))} — ${esc(i.msg)}</div>`).join("")
      : `<div class="issue ok">✓ ${esc(zh("全部必备要素齐备，可提交修改。", "All mandatory elements present; the update can be submitted."))}</div>`;
  };

  sel.addEventListener("change", () => {
    const s = store.stations.find((x) => String(x.id) === sel.value);
    if (s) loadForm(s);
  });
  p.querySelector("#ed-one-go").addEventListener("click", () => {
    const s = store.stations.find((x) => String(x.id) === sel.value);
    if (!s) return;
    loadForm(s);
    form.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  inputs.forEach((i) => i.addEventListener("input", renderDiff));
  form.querySelector("#ed-reset").addEventListener("click", () => { if (current) loadForm(current); });
  form.querySelector("#ed-hist").addEventListener("click", () => toast(zh("演示：该记录最近 3 次修改（审计日志见「变更与审批」）", "Demo: last 3 modifications of this record — see Changes & approval")));
  form.querySelector("#ed-save").addEventListener("click", () => {
    if (!current) { toast(zh("请先载入记录", "Load a record first")); return; }
    if (!can("update")) { toast(zh("当前角色无修改权限", "Your role cannot update")); return; }
    const v = values();
    const errs = validate(v).filter((i) => i.level === "err");
    if (errs.length) { toast(zh(`校验未通过：${errs.length} 项错误`, `${errs.length} validation error(s)`)); return; }
    const rows = diffRows(before, v);
    const id = addDraft("update", current.wigos || current.id, rows.length, v.reason || "(未填写原因)");
    toast(zh(`已生成变更单 ${id}，进入审批链`, `Change request ${id} created`));
    refresh();
  });

  const wrap = el(`<div></div>`);
  wrap.appendChild(p);
  wrap.appendChild(form);
  return wrap;
}

/* ---------------------------------------------------------- 面板：新建记录 */

function paneCreate(refresh) {
  const p = el(`<div class="grid g2">
    <div class="panel">
      <div class="panel-head"><span class="panel-title">${esc(zh("WSI 分配（演示）", "WSI allocation (demo)"))}</span></div>
      <dl class="kv">
        <dt>${esc(zh("分配规则", "Rule"))}</dt><dd class="dim">${esc(zh("0 · 国家码 · 序列号；国家码取 WMO 属地代码，序列号在国家内唯一且不复用", "0 · country code · sequence; country code from the WMO territory list, sequence unique per country"))}</dd>
        <dt>${esc(zh("拟分配标识", "Proposed WIGOS ID"))}</dt><dd class="mono" id="cw-id" style="font-size:15px">—</dd>
        <dt>${esc(zh("碰撞检查", "Collision check"))}</dt><dd><span class="tag ok">${esc(zh("未占用", "not in use"))}</span></dd>
      </dl>
      <button class="primary" id="cw-alloc" style="margin-top:10px">${esc(zh("生成标识", "Allocate ID"))}</button>
      <div class="notice" style="margin-top:12px">${esc(zh(
        "真实系统按国家码自动生成并做唯一性约束；重复记录只能通过合并流程处理，不允许手工改号。",
        "A live system derives it from the country code with a uniqueness constraint; duplicates are merged, never renumbered by hand.",
      ))}</div>
    </div>
    <div class="panel">
      <div class="panel-head"><span class="panel-title">${esc(zh("新建流程（生命周期）", "Creation workflow"))}</span></div>
      ${["录入要素（WIGOS 必备要素集）", "提交机构管理员复核", "国家管理员审批并分配 WSI", "发布至全球观测设施目录", "门户只读缓存周期性拉取可见"].map((s, i) => `<div class="step"><span class="n">${i + 1}</span>${esc(zh(s, s))}</div>`).join("")}
      <div class="muted" style="font-size:12px;margin-top:8px">${esc(zh("新建记录默认状态为「待发布」，审批通过前不出现在目录与门户检索结果中。", "A new record stays 'pending publication' and is invisible to catalogue search and the portal until approved."))}</div>
    </div>
  </div>
  <div class="panel" style="margin-top:16px">
    <div class="panel-head"><span class="panel-title">${esc(zh("必填要素校验清单", "Mandatory element checklist"))}</span></div>
    <div class="table-wrap" style="max-height:none"><table class="data">
      <thead><tr><th style="width:180px">${esc(zh("要素", "Element"))}</th><th>${esc(zh("校验规则", "Rule"))}</th><th style="width:90px">${esc(zh("必填", "Required"))}</th></tr></thead>
      <tbody>${[
    ["WIGOS 台站标识符", zh("格式 0-20000-0-60415，全局唯一，系统分配", "pattern 0-20000-0-60415, globally unique, system-assigned"), true],
    ["站点名称", zh("2~80 字符，不得全为数字", "2–80 characters, not all digits"), true],
    ["站点类型 / 分级", zh("取值须在受控词表内", "values must come from the controlled vocabulary"), true],
    ["经纬度", zh("纬 −90~90，经 −180~180；海上站点需注明定位方式", "lat −90~90, lon −180~180; positioning method required at sea"), true],
    ["海拔", zh("−500~9000 m；缺测时填 −999", "−500–9000 m; use −999 when unknown"), false],
    ["国家 / 属地", zh("WMO 属地受控词表", "WMO territory controlled vocabulary"), true],
    ["计划 / 网络隶属", zh("至少隶属一个计划方能进入 GBON 评估", "at least one programme affiliation to enter GBON assessment"), false],
    ["观测变量", zh("须为受控变量并指定几何", "controlled variable with an observation geometry"), false],
    ["监管机构与联系人", zh("机构须在机构注册表中；联系人信息仅在节点侧存储", "organisation must be registered; contacts are held node-side only"), false],
    ["观测频率与时区", zh("时区按 IANA 名称", "time zone as an IANA name"), false],
  ].map((r) => `<tr><td>${esc(r[0])}</td><td class="dim">${esc(r[1])}</td><td>${r[2] ? `<span class="tag ok">${esc(zh("必填", "yes"))}</span>` : `<span class="tag">${esc(zh("选填", "no"))}</span>`}</td></tr>`).join("")}</tbody>
    </table></div>
    <div class="chips" style="margin-top:12px">
      <button class="primary" id="cw-create" ${can("create") ? "" : "disabled"}>${esc(zh("打开新建表单", "Open creation form"))}</button>
      <span class="muted" style="font-size:12px">${esc(zh("新建表单复用单条修改的面板结构，字段与校验规则一致；本演示聚焦流程与权限，表单细节从略。", "The creation form reuses the single-update panel structure with identical fields and rules; this demo focuses on workflow and permissions."))}</span>
    </div>
  </div>`);

  p.querySelector("#cw-alloc").addEventListener("click", () => {
    if (!can("create")) { toast(zh("当前角色无新建权限", "Your role cannot create")); return; }
    const cc = session.user.terr === "Hong Kong" ? "45000" : "60000";
    const seq = String(1000 + Math.floor(Math.random() * 8999));
    p.querySelector("#cw-id").textContent = `0-${cc}-${seq}`;
    logAudit(zh("分配 WSI（草稿）", "WSI allocated (draft)"), `0-${cc}-${seq}`, zh("仅演示", "demo only"));
  });
  p.querySelector("#cw-create").addEventListener("click", () => {
    if (!can("create")) return;
    const id = addDraft("create", zh("新建记录", "new record"), 1, zh("经必填校验，待机构复核", "passed mandatory checks, awaiting org review"));
    toast(zh(`已生成变更单 ${id}`, `Change request ${id} created`));
    refresh();
  });
  return p;
}

/* ---------------------------------------------------------- 面板：批量导入 */

const IMPORT_SAMPLE_CSV = [
  "wigosId,name,stationType,latitude,longitude,elevation,territory,programme,declaredStatus",
  ",HAIYAN BACK,Land (fixed),30.083,120.233,10,China,GBON,Operational",
  ",WUHAN EAST,Land (fixed),30.583,114.300,23,China,GOS General,Operational",
  "0-20000-0-99991,TEST STATION A,Land (fixed),35.000,120.000,5,China,GOS General,Operational",
  ",BAD LAT,Land (fixed),95.2,120.000,5,China,GOS General,Operational",
  ",NO TERRITORY,Land (fixed),40.000,116.400,50,Atlantis,GOS General,Operational",
  ",HARBOUR MOBILE,Sea (mobile),22.300,114.170,0,Hong Kong,WHYCOS,Partly operational",
].join("\n");

const IMPORT_COLS = [
  { k: "wigosId", l: { zh: "WIGOS 标识符", en: "WIGOS ID" }, req: false, check: (v) => (!v ? "warn" : /^\d{1,6}-\d{1,6}-\d{1,6}$/.test(v) ? "ok" : "err") },
  { k: "name", l: { zh: "站点名称", en: "Station name" }, req: true, check: (v) => (v && v.length >= 2 ? "ok" : "err") },
  { k: "stationType", l: { zh: "站点类型", en: "Station type" }, req: true, check: (v) => ((store.facets?.types || []).some(([x]) => x === v) ? "ok" : "err") },
  { k: "latitude", l: { zh: "纬度", en: "Latitude" }, req: true, check: (v) => { const n = Number(v); return v !== "" && n >= -90 && n <= 90 ? "ok" : "err"; } },
  { k: "longitude", l: { zh: "经度", en: "Longitude" }, req: true, check: (v) => { const n = Number(v); return v !== "" && n >= -180 && n <= 180 ? "ok" : "err"; } },
  { k: "elevation", l: { zh: "海拔", en: "Elevation" }, req: false, check: () => "ok" },
  { k: "territory", l: { zh: "国家 / 属地", en: "Territory" }, req: true, check: (v) => ((store.facets?.territories || []).some(([x]) => x === v) ? "ok" : "warn") },
  { k: "programme", l: { zh: "计划 / 网络", en: "Programme" }, req: false, check: () => "ok" },
  { k: "declaredStatus", l: { zh: "申报状态", en: "Declared status" }, req: false, check: () => "ok" },
];

function paneImport(refresh) {
  const p = el(`<div class="grid g2">
    <div class="panel">
      <div class="panel-head"><span class="panel-title">${esc(zh("① 选择来源", "① Source"))}</span></div>
      <label class="field"><span class="lbl">${esc(zh("文件格式", "Format"))}</span>
        <select id="im-fmt"><option value="csv">CSV（逗号分隔，首行为列名）</option><option value="wmdr">WMDR V2（JSON 数组）</option></select>
      </label>
      <div class="dropzone" id="im-drop">
        ${esc(zh("将文件拖放到此处，或点击选择", "Drop a file here, or click to choose"))}
        <div class="muted" style="font-size:12px;margin-top:6px">${esc(zh("支持 UTF-8 CSV 与 WMDR V2 JSON；单次建议不超过 5 000 行，超出转入异步作业队列。", "UTF-8 CSV and WMDR V2 JSON; up to 5 000 rows per run, larger files go to an async job queue."))}</div>
      </div>
      <div class="chips" style="margin-top:10px">
        <button class="ghost" id="im-sample">${esc(zh("载入示例文件（6 行）", "Load sample (6 rows)"))}</button>
        <button class="ghost" id="im-clear">${esc(zh("清空", "Clear"))}</button>
      </div>
      <label class="field" style="margin-top:12px"><span class="lbl">${esc(zh("或直接粘贴内容", "or paste content"))}</span>
        <textarea id="im-text" rows="6" placeholder="${esc(zh("粘贴 CSV 文本…", "paste CSV text…"))}"></textarea></label>
      <button class="primary" id="im-parse">${esc(zh("解析并校验", "Parse & validate"))}</button>
    </div>
    <div class="panel">
      <div class="panel-head"><span class="panel-title">${esc(zh("② 校验规则", "② Validation rules"))}</span></div>
      <div class="tree">
        <div class="t-node on">${esc(zh("结构与格式", "Structure & format"))}
          <div class="t-leaf">${esc(zh("列头映射到 WMDR 字段，未知列进入「附加属性」", "Headers map to WMDR fields; unknown columns go to additional properties"))}</div>
          <div class="t-leaf">${esc(zh("必填要素缺失 → 拒收该行", "Missing mandatory elements → row rejected"))}</div>
        </div>
        <div class="t-node">${esc(zh("值域与受控词表", "Ranges & controlled vocabularies"))}
          <div class="t-leaf">${esc(zh("类型 / 分级 / 属地 / 状态须在受控词表内（警告转人工复核）", "Type / class / territory / status must be controlled values"))}</div>
        </div>
        <div class="t-node">${esc(zh("业务规则", "Business rules"))}
          <div class="t-leaf">${esc(zh("标识唯一性、重复检测（疑似重复进入人工合并队列）", "Identifier uniqueness; duplicates go to a manual merge queue"))}</div>
          <div class="t-leaf">${esc(zh("计划隶属与观测变量的一致性", "Consistency between programme affiliation and observed variables"))}</div>
          <div class="t-leaf">${esc(zh("位置精度与定位方法合理性", "Position precision vs positioning method"))}</div>
        </div>
      </div>
      <div class="muted" id="im-sum"></div>
    </div>
  </div>
  <div class="panel" style="margin-top:16px">
    <div class="panel-head"><span class="panel-title">${esc(zh("③ 解析预览与逐行结果", "③ Parse preview and per-row results"))}</span>
      <button class="primary" id="im-run" disabled ${can("bulk_import") ? "" : "disabled"}>${esc(zh("执行导入（演示）", "Run import (demo)"))}</button></div>
    <div id="im-preview" class="empty-state">${esc(zh("尚未解析。", "Nothing parsed yet."))}</div>
  </div>`);

  let parsed = null;

  const doParse = () => {
    const text = p.querySelector("#im-text").value.trim();
    if (!text) { toast(zh("请先载入或粘贴内容", "Load or paste content first")); return; }
    const lines = text.split(/\r?\n/).filter(Boolean);
    const head = lines[0].split(",").map((h) => h.trim());
    const rows = lines.slice(1).map((l) => {
      const cells = l.split(",");
      const rec = Object.fromEntries(head.map((h, i) => [h, (cells[i] ?? "").trim()]));
      const issues = IMPORT_COLS.filter((c) => c.req && !rec[c.k]).map((c) => `${zh(c.l.zh, c.l.en)} ${zh("缺失", "missing")}`);
      const bad = IMPORT_COLS.filter((c) => !c.req || rec[c.k] || c.check("")).map((c) => c.check(rec[c.k] ?? "")).filter((v) => v !== "ok");
      return { rec, issues, bad };
    });
    parsed = { head, rows };
    const errs = rows.filter((r) => r.issues.length || r.bad.includes("err")).length;
    const warns = rows.filter((r) => !r.issues.length && r.bad.includes("warn")).length;
    p.querySelector("#im-sum").innerHTML = `<div class="issue ${errs ? "err" : "ok"}">${esc(zh(
      `解析完成：共 ${rows.length} 行，可导入 ${rows.length - errs} 行，拒绝 ${errs} 行，警告 ${warns} 行。`,
      `Parsed ${rows.length} rows: ${rows.length - errs} importable, ${errs} rejected, ${warns} with warnings.`,
    ))}</div>`;
    const box = p.querySelector("#im-preview");
    box.className = "table-wrap";
    box.innerHTML = `<table class="data"><thead><tr>
      <th style="width:60px">${esc(zh("行号", "Row"))}</th>${head.map((h) => `<th>${esc(h)}</th>`).join("")}
      <th style="width:130px">${esc(zh("校验结果", "Validation"))}</th></tr></thead>
      <tbody>${rows.map((r, i) => {
      const st = r.issues.length || r.bad.includes("err") ? "bad" : r.bad.length ? "warn" : "ok";
      const msg = r.issues.length ? r.issues.join("；") : r.bad.length ? zh("值不在受控词表", "value outside controlled vocabulary") : zh("通过", "passed");
      return `<tr><td class="mono">${i + 2}</td>${head.map((h) => `<td class="mono">${esc(r.rec[h] ?? "")}</td>`).join("")}
          <td><span class="tag ${st}">${esc(msg)}</span></td></tr>`;
    }).join("")}</tbody></table>`;
    p.querySelector("#im-run").disabled = false;
  };

  p.querySelector("#im-sample").addEventListener("click", () => { p.querySelector("#im-text").value = IMPORT_SAMPLE_CSV; doParse(); });
  p.querySelector("#im-clear").addEventListener("click", () => { p.querySelector("#im-text").value = ""; parsed = null; });
  p.querySelector("#im-drop").addEventListener("click", () => p.querySelector("#im-sample").click());
  p.querySelector("#im-parse").addEventListener("click", doParse);
  p.querySelector("#im-run").addEventListener("click", () => {
    if (!can("bulk_import")) { toast(zh("当前角色无批量导入权限", "Your role cannot bulk import")); return; }
    if (!parsed) return;
    const errs = parsed.rows.filter((r) => r.issues.length || r.bad.includes("err")).length;
    const good = parsed.rows.length - errs;
    if (good) addDraft("import", zh(`${parsed.rows.length} 行文件`, `${parsed.rows.length}-row file`), good, zh(`校验拒绝 ${errs} 行`, `${errs} row(s) rejected`));
    logAudit(zh("批量导入（草稿）", "Bulk import (draft)"), `${parsed.rows.length} 行`, good ? zh("待审批", "pending") : zh("全部拒绝", "all rejected"));
    toast(good ? zh(`已入变更单：${good} 条待审批，${errs} 条被拒`, `${good} accepted, ${errs} rejected`) : zh("全部行未通过校验", "All rows rejected"));
    refresh();
  });
  return p;
}

/* ---------------------------------------------------------- 面板：批量修改 */

const BULK_OPS = [
  { id: "set", zh: "统一赋值", en: "set value" },
  { id: "replace", zh: "查找替换", en: "find & replace" },
  { id: "prefix", zh: "添加前缀", en: "prepend" },
  { id: "suffix", zh: "添加后缀", en: "append" },
  { id: "onlyEmpty", zh: "仅当为空时填充", en: "fill if empty" },
  { id: "clear", zh: "置空（不建议）", en: "clear value" },
];

function paneBulk(refresh) {
  const ids = scopeIds();
  const inScopeRows = store.stations.filter((s) => ids.has(String(s.id)));
  const result = currentRows();
  const scopedResult = result.filter((s) => ids.has(String(s.id)));

  const p = el(`<div class="panel">
    <div class="panel-head"><span class="panel-title">${esc(zh("批量修改：范围 + 规则 + 影响预览", "Bulk update: scope + rule + impact preview"))}</span></div>
    <div class="grid g3">
      <label class="field"><span class="lbl">1 · ${esc(zh("作用范围", "Scope"))}</span>
        <select id="bk-scope">
          <option value="scope">${esc(zh("本角色数据范围内全部记录", "All records within my scope"))}（${fmtNum(inScopeRows.length)}）</option>
          <option value="result">${esc(zh("当前检索结果（∩ 数据范围）", "Current search result ∩ scope"))}（${fmtNum(scopedResult.length)}）</option>
          <option value="gbon">${esc(zh("仅 GBON 隶属记录", "GBON-affiliated only"))}</option>
        </select>
      </label>
      <label class="field"><span class="lbl">2 · ${esc(zh("目标字段", "Field"))}</span>
        <select id="bk-field">
          ${FORM.flatMap((s) => s.fields.filter((f) => !f.ro).map((f) => `<option value="${f.k}">${esc(zh(f.l.zh, f.l.en))}</option>`))}
        </select>
      </label>
      <label class="field"><span class="lbl">3 · ${esc(zh("操作与取值", "Operation & value"))}</span>
        <div style="display:flex;gap:8px">
          <select id="bk-op" style="flex:0 0 42%">${BULK_OPS.map((o) => `<option value="${o.id}">${esc(zh(o.zh, o.en))}</option>`).join("")}</select>
          <input type="text" id="bk-val" placeholder="${esc(zh("取值", "value"))}" />
        </div>
      </label>
    </div>
    <div class="chips">
      <button class="primary" id="bk-prev" ${can("bulk_update") ? "" : "disabled"}>${esc(zh("生成影响预览", "Preview impact"))}</button>
      <button class="primary" id="bk-run" disabled>${esc(zh("提交为变更单", "Submit as change request"))}</button>
      <span class="tag" id="bk-n">${esc(zh("未生成预览", "no preview"))}</span>
    </div>
    <div class="notice" style="margin-top:10px">${esc(zh(
      "安全约束：批量修改不触碰标识（WIGOS ID）与站点类型；一次作业的影响记录数超过 500 条时强制走二级审批；所有批次按记录粒度留痕，可整批回退。",
      "Safety rules: bulk update never touches the WIGOS ID or station type; batches affecting more than 500 records require second-level approval; every batch is traced per record and can be rolled back as a whole.",
    ))}</div>
    <div id="bk-prev-box" class="empty-state" style="margin-top:12px">${esc(zh("选择范围与规则后生成预览。", "Choose a scope and a rule to preview the impact."))}</div>
  </div>`);

  let plan = null;
  p.querySelector("#bk-prev").addEventListener("click", () => {
    if (!can("bulk_update")) { toast(zh("当前角色无批量修改权限", "Your role cannot bulk update")); return; }
    const scope = p.querySelector("#bk-scope").value;
    const field = p.querySelector("#bk-field").value;
    const op = p.querySelector("#bk-op").value;
    const val = p.querySelector("#bk-val").value;
    let base = scope === "result" ? scopedResult : inScopeRows;
    if (scope === "gbon") base = base.filter((s) => (s.prog || []).some((p) => p.n === "GBON"));
    const affected = [];
    for (const s of base) {
      const e = store.enrich[String(s.id)] || {};
      const cur = field === "cls" ? (e.c || s.cls || "") : (field === "org" ? (e.o || "") : s[field] ?? "");
      const next = op === "set" ? val
        : op === "replace" ? String(cur).split(val[0] || "|").join(val.slice(1))
          : op === "prefix" ? `${val}${cur}` : op === "suffix" ? `${cur}${val}`
            : op === "clear" ? "" : (cur === "" ? val : cur);
      if (String(next) !== String(cur)) affected.push({ s, cur: String(cur), next: String(next) });
    }
    plan = { affected, scope, field, op, val };
    p.querySelector("#bk-n").textContent = t("se.results.n", { n: affected.length });
    p.querySelector("#bk-run").disabled = !affected.length;
    const box = p.querySelector("#bk-prev-box");
    box.className = "table-wrap";
    box.innerHTML = affected.length ? `<table class="data"><thead><tr>
      <th style="width:60px">${esc(zh("序", "#"))}</th><th>${esc(zh("站点", "Station"))}</th><th style="width:150px">${esc(zh("WIGOS ID", "WIGOS ID"))}</th>
      <th>${esc(zh("修改前", "Before"))}</th><th>${esc(zh("修改后", "After"))}</th></tr></thead>
      <tbody>${affected.slice(0, 40).map((a, i) => `<tr><td class="mono">${i + 1}</td>
        <td><a href="#/station/${a.s.id}">${esc(a.s.name)}</a><span class="sub">${esc(tv(a.s.terr))}</span></td>
        <td class="mono">${esc(a.s.wigos || a.s.id)}</td><td class="mono">${esc(a.cur || "—")}</td><td class="mono diff-after">${esc(a.next || "—")}</td></tr>`).join("")}
      </tbody></table>${affected.length > 40 ? `<div class="muted" style="padding:8px 10px">${esc(zh(`另有 ${affected.length - 40} 条未展示`, `${affected.length - 40} more not shown`))}</div>` : ""}`
      : esc(zh("该规则下没有记录发生变化。", "No record changes under this rule."));
  });

  p.querySelector("#bk-run").addEventListener("click", () => {
    if (!plan || !plan.affected.length) return;
    const big = plan.affected.length > 500;
    if (big && can("approve") !== true) {
      toast(zh(`影响 ${plan.affected.length} 条（>500），需二级审批，请先提交后由上级审批`, `${plan.affected.length} records (>500) need second-level approval`));
    }
    const f = FORM.flatMap((s) => s.fields).find((x) => x.k === plan.field);
    const id = addDraft("update_bulk", zh(`${plan.affected.length} 条 · ${zh(f.l.zh, f.l.en)}`, `${plan.affected.length} records · ${zh(f.l.zh, f.l.en)}`),
      plan.affected.length, `${BULK_OPS.find((o) => o.id === plan.op).zh} → ${plan.val || "(清空)"}`);
    logAudit(zh("批量修改（草稿）", "Bulk update (draft)"), `${plan.affected.length} 条 / ${plan.field}`, zh("待审批", "pending"));
    toast(zh(`已生成变更单 ${id}`, `Change request ${id} created`));
    refresh();
  });

  return p;
}

/* ---------------------------------------------------------- 面板：批量删除 */

function paneDelete(refresh) {
  const ids = scopeIds();
  const rows = store.stations.filter((s) => ids.has(String(s.id))).slice(0, 60);
  const p = el(`<div class="grid g2">
    <div class="panel">
      <div class="panel-head"><span class="panel-title">${esc(zh("① 选择记录", "① Select records"))}</span>
        <span class="tag" id="dl-n">${esc(zh("已选 0 条", "0 selected"))}</span></div>
      <div class="chips" style="margin-bottom:8px">
        <button class="ghost sm" id="dl-all">${esc(zh("全选本页", "Select all"))}</button>
        <button class="ghost sm" id="dl-none">${esc(zh("清空", "Clear"))}</button>
        <span class="muted" style="font-size:12px">${esc(zh(`数据范围内共 ${fmtNum(ids.size)} 条，本页列出前 60 条`, `${fmtNum(ids.size)} in scope; first 60 listed`))}</span>
      </div>
      <div class="table-wrap" style="max-height:44vh"><table class="data">
        <thead><tr><th style="width:36px"></th><th>${esc(zh("站点", "Station"))}</th><th style="width:140px">${esc(zh("WIGOS ID", "WIGOS ID"))}</th><th style="width:90px">${esc(zh("类型", "Type"))}</th><th>${esc(zh("计划 / 状态", "Programme / status"))}</th></tr></thead>
        <tbody>${rows.map((s) => `<tr><td><input type="checkbox" class="dl-cb" value="${s.id}" /></td>
          <td>${esc(s.name)}<span class="sub">${esc(tv(s.terr))} · ${esc(fmtCoord(s.lat, s.lon))}</span></td>
          <td class="mono">${esc(s.wigos || s.id)}</td><td class="dim">${esc(tv(s.type))}</td>
          <td class="dim">${esc((s.prog || []).map((x) => x.n).join(", ") || "—")} · ${esc(tv(s.decl))}</td></tr>`).join("")}</tbody>
      </table></div>
    </div>
    <div class="panel">
      <div class="panel-head"><span class="panel-title">${esc(zh("② 删除方式与影响分析", "② Deletion mode & impact"))}</span></div>
      <label class="field"><span class="lbl">${esc(zh("删除原因（必填，进入审计）", "Reason (required, audited)"))}</span>
        <select id="dl-reason">${DEL_REASONS.map((r) => `<option value="${r.id}">${esc(zh(r.zh, r.en))}</option>`).join("")}</select></label>
      <label class="field"><span class="lbl">${esc(zh("删除方式", "Mode"))}</span>
        <select id="dl-mode">
          <option value="logical">${esc(zh("逻辑删除（推荐）：保留记录与历史，检索默认不可见", "Logical (recommended): keep record and history, hidden from search"))}</option>
          <option value="physical" ${can("delete") === true ? "" : "disabled"}>${esc(zh("物理删除：仅超级管理员，记录不可恢复", "Physical: super administrator only, irreversible"))}</option>
        </select></label>
      <div id="dl-impact" class="mono-box" style="max-height:170px">${esc(zh("选择记录后显示关联影响。", "Impact appears once records are selected."))}</div>
      <div class="chips" style="margin-top:10px">
        <button class="primary" id="dl-run" disabled ${can("bulk_delete") ? "" : "disabled"}>${esc(zh("提交删除（演示）", "Submit deletion (demo)"))}</button>
        <button class="ghost" id="dl-dup">${esc(zh("重复检测", "Duplicate check"))}</button>
      </div>
      <div class="notice" style="margin-top:10px">${esc(zh(
        "约束：隶属 GBON 且申报为运行中的记录不得物理删除；存在观测数据或历史评估结论的记录只能逻辑删除并保留来源痕迹。",
        "Constraints: GBON records declared operational cannot be purged; records with observations or assessment history may only be logically deleted, keeping provenance.",
      ))}</div>
    </div>
  </div>`);

  const boxes = [...p.querySelectorAll(".dl-cb")];
  const tag = p.querySelector("#dl-n");
  const impact = p.querySelector("#dl-impact");
  const run = p.querySelector("#dl-run");
  const sel = () => boxes.filter((b) => b.checked).map((b) => store.stations.find((s) => String(s.id) === b.value)).filter(Boolean);

  const refreshImpact = () => {
    const list = sel();
    tag.textContent = zh(`已选 ${list.length} 条`, `${list.length} selected`);
    run.disabled = !list.length;
    if (!list.length) { impact.textContent = zh("选择记录后显示关联影响。", "Impact appears once records are selected."); return; }
    const obs = list.reduce((a, s) => a + ((store.enrich[String(s.id)] || {}).v || []).length, 0);
    const prog = list.reduce((a, s) => a + (s.prog || []).length, 0);
    const gbon = list.filter((s) => (s.prog || []).some((p) => p.n === "GBON" && p.d === "Operational")).length;
    const mode = p.querySelector("#dl-mode").value;
    impact.innerHTML = [
      `${zh("选中记录", "Records")}：${list.length}`,
      `${zh("关联观测变量条目", "Observation entries")}：${obs}`,
      `${zh("计划 / 网络隶属条目", "Programme affiliations")}：${prog}`,
      `${zh("其中 GBON 运行中", "GBON operational")}：${gbon}${gbon ? ` <span class="tag warn">${esc(zh("仅可逻辑删除", "logical deletion only"))}</span>` : ""}`,
      `${zh("删除方式", "Mode")}：${mode === "logical" ? zh("逻辑删除", "logical") : zh("物理删除", "physical")}`,
      `${zh("影响范围外", "Out of scope")}：${list.filter((s) => !ids.has(String(s.id))).length}`,
    ].map((l) => `<div>${l}</div>`).join("");
    if (mode === "physical" && gbon) toast(zh("存在 GBON 运行中记录，物理删除将被拒绝", "GBON operational records block physical deletion"));
  };

  boxes.forEach((b) => b.addEventListener("change", refreshImpact));
  p.querySelector("#dl-all").addEventListener("click", () => { boxes.forEach((b) => { b.checked = true; }); refreshImpact(); });
  p.querySelector("#dl-none").addEventListener("click", () => { boxes.forEach((b) => { b.checked = false; }); refreshImpact(); });
  p.querySelector("#dl-mode").addEventListener("change", refreshImpact);
  p.querySelector("#dl-dup").addEventListener("click", () => toast(zh("重复检测：0 条疑似重复（演示）", "Duplicate check: 0 suspected (demo)")));
  run.addEventListener("click", () => {
    if (!can("bulk_delete")) { toast(zh("当前角色无批量删除权限", "Your role cannot bulk delete")); return; }
    const list = sel();
    const mode = p.querySelector("#dl-mode").value;
    const reason = DEL_REASONS.find((r) => r.id === p.querySelector("#dl-reason").value);
    if (mode === "physical" && can("delete") !== true) { toast(zh("仅超级管理员可物理删除", "Only the super administrator may purge")); return; }
    if (mode === "physical" && list.some((s) => (s.prog || []).some((p) => p.n === "GBON" && p.d === "Operational"))) {
      toast(zh("存在 GBON 运行中记录，已拒绝物理删除", "GBON operational records present: physical deletion refused"));
      return;
    }
    const id = addDraft("delete", zh(`${list.length} 条记录`, `${list.length} records`), list.length, zh(reason?.zh || reason?.en, ""));
    logAudit(mode === "logical" ? zh("逻辑删除（草稿）", "Logical delete (draft)") : zh("物理删除（草稿）", "Physical delete (draft)"), `${list.length} 条`, zh("待审批", "pending"));
    toast(zh(`已生成变更单 ${id}`, `Change request ${id} created`));
    refresh();
  });
  return p;
}

/* ---------------------------------------------------------- 面板：变更与审批 */

function paneFlow() {
  const p = el(`<div class="panel">
    <div class="panel-head"><span class="panel-title">${esc(zh("变更单与审批链", "Change requests and approval chain"))}</span></div>
    <div class="table-wrap" style="max-height:none"><table class="data">
      <thead><tr><th style="width:120px">${esc(zh("变更单号", "Change ID"))}</th><th style="width:90px">${esc(zh("类型", "Type"))}</th>
        <th>${esc(zh("对象", "Target"))}</th><th style="width:80px">${esc(zh("要素数", "Items"))}</th><th style="width:130px">${esc(zh("提交人", "Submitted by"))}</th>
        <th style="width:130px">${esc(zh("时间", "Time"))}</th><th style="width:240px">${esc(zh("审批进度", "Approval"))}</th><th style="width:100px"></th></tr></thead>
      <tbody>${state.drafts.map((d) => {
    const kind = { update: zh("修改", "update"), create: zh("新建", "create"), import: zh("导入", "import"), update_bulk: zh("批量修改", "bulk update"), delete: zh("删除", "delete") }[d.kind] || d.kind;
    const steps = APPROVAL_CHAIN.map((s) => zh(s, s));
    return `<tr><td class="mono">${esc(d.id)}</td><td><span class="tag">${esc(kind)}</span></td>
      <td>${esc(d.target)}<span class="sub">${esc(d.note || "")}</span></td><td class="num">${d.items}</td>
      <td class="dim">${esc(d.actor)}<span class="sub">${esc((ROLE_BY_ID.get(d.role) || {}).zh || d.role)}</span></td>
      <td class="mono">${esc(d.at)}</td>
      <td><div class="flow">${steps.map((s, i) => `<span class="fstep ${i < d.status ? "on" : ""}">${esc(s)}</span>`).join('<i class="farrow">›</i>')}</div></td>
      <td>${d.status < steps.length ? `<button class="ghost sm" data-adv="${esc(d.id)}" ${can("approve") ? "" : "disabled"}>${esc(zh("推进", "Advance"))}</button>` : `<span class="tag ok">${esc(zh("已发布", "published"))}</span>`}</td></tr>`;
  }).join("") || `<tr><td colspan="8" class="muted">${esc(zh("暂无变更单", "no change requests"))}</td></tr>`}</tbody>
    </table></div>
    <div class="muted" style="font-size:12px;margin-top:10px">${esc(zh(
      "审批链按记录属地与管理层级确定：采录员提交后由机构管理员复核，国家管理员终审，区域协调中心备案后方可发布；每一步留痕并可回退。",
      "The chain follows the record's territory and tier: editor → organisation review → national approval → regional registration → publication; each step is traced and reversible.",
    ))}</div>
  </div>

  <div class="panel" style="margin-top:16px">
    <div class="panel-head"><span class="panel-title">${esc(zh("审计日志（演示）", "Audit log (demo)"))}</span>
      <button class="ghost sm" id="fl-dl">${esc(zh("导出 CSV", "Export CSV"))}</button></div>
    <div class="table-wrap" style="max-height:46vh"><table class="data">
      <thead><tr><th style="width:150px">${esc(zh("时间", "Time"))}</th><th style="width:120px">${esc(zh("账号", "Account"))}</th>
        <th>${esc(zh("动作", "Action"))}</th><th>${esc(zh("对象", "Object"))}</th><th style="width:90px">${esc(zh("结果", "Result"))}</th><th style="width:110px">${esc(zh("来源地址", "Source"))}</th></tr></thead>
      <tbody>${state.audit.map((a) => `<tr><td class="mono">${esc(a.at)}</td><td class="mono">${esc(a.who)}</td><td>${esc(a.act)}</td>
        <td class="dim">${esc(a.obj)}</td><td><span class="tag ${a.res === zh("成功", "success") ? "ok" : a.res.includes("待") ? "warn" : ""}">${esc(a.res)}</span></td>
        <td class="mono dim">${esc(a.ip)}</td></tr>`).join("")}</tbody>
    </table></div>
  </div>`);

  p.querySelectorAll("[data-adv]").forEach((b) => b.addEventListener("click", () => {
    if (!can("approve")) { toast(zh("当前角色无审批权限", "Your role cannot approve")); return; }
    const d = state.drafts.find((x) => x.id === b.dataset.adv);
    if (!d) return;
    d.status = Math.min(APPROVAL_CHAIN.length, d.status + 1);
    logAudit(zh("推进审批", "approval advanced"), d.id, d.status >= APPROVAL_CHAIN.length ? zh("已发布（演示）", "published (demo)") : zh("审批中", "in review"));
    toast(d.status >= APPROVAL_CHAIN.length ? zh(`${d.id} 全链通过，已标记发布（演示）`, `${d.id} published (demo)`) : zh(`${d.id} 已推进至「${APPROVAL_CHAIN[d.status]}」`, `${d.id} advanced`));
    const fresh = renderEdit();
    document.getElementById("app").replaceChildren(fresh);
  }));
  p.querySelector("#fl-dl").addEventListener("click", () => {
    const head = "time,account,action,object,result,source\n";
    const body = state.audit.map((a) => [a.at, a.who, a.act, a.obj, a.res, a.ip].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    download("wigos_audit_log.csv", head + body + "\n", "text/csv;charset=utf-8");
    toast(t("toast.exported"));
  });
  return p;
}
