/* 检索（MVP F-5）：简单检索 + 高级条件检索，结果以列表与地图返回。
   全部条件写入地址栏，支持书签、分享与前进后退（NF-5 平滑迁移）。 */

import {
  store, search, paginate, criteriaFromParams, criteriaToParams,
  EMPTY_CRITERIA, activeCriteriaCount,
} from "../data.js";
import { t, tv, getLang } from "../i18n.js";
import { esc, el, fmtNum, fmtCoord, buildHash, debounce, metrics } from "../util.js";
import { createMap } from "../map.js";

const S = { c: { ...EMPTY_CRITERIA }, rows: [], view: "table", map: null, host: null };

export function currentRows() { return S.rows; }
export function currentCriteria() { return S.c; }

function ddSummary(selected) {
  const L = getLang();
  if (!selected.length) return L === "zh" ? "全部" : "All";
  return L === "zh" ? `已选 ${selected.length} 项` : `${selected.length} selected`;
}

/** OSCAR 风格多选下拉菜单：按钮显已选摘要，展开为带计数的复选项 */
function facetDropdown(facetKey, selected) {
  const items = (store.facets[facetKey] || []);
  if (!items.length) return `<div class="muted" style="font-size:12px">—</div>`;
  return `<div class="dd" data-dd="${facetKey}">
    <button type="button" class="dd-btn">
      <span class="dd-label">${esc(ddSummary(selected))}</span>
      <span class="dd-caret">▾</span>
    </button>
    <div class="dd-panel" hidden>
      <div class="dd-opts">
        ${items.map(([k, n]) => `<label class="dd-opt"><input type="checkbox" value="${esc(k)}" ${selected.includes(k) ? "checked" : ""}><span class="dd-txt">${esc(tv(k) || k)}</span><span class="dd-n">${fmtNum(n)}</span></label>`).join("")}
      </div>
    </div>
  </div>`;
}

let docCloseBound = false;
let openDdKey = null; // 勾选后保持展开的下拉，整页重建后重新展开
function ensureDocClose() {
  if (docCloseBound) return;
  docCloseBound = true;
  document.addEventListener("click", (ev) => {
    document.querySelectorAll(".dd-panel:not([hidden])").forEach((p) => {
      if (!p.closest(".dd").contains(ev.target)) p.hidden = true;
    });
  });
}

export function renderSearch(params) {
  if (params) S.c = criteriaFromParams(params);
  if (!S.rows.length) S.rows = search(S.c);

  const L = getLang();

  const node = el(`
  <div>
    <h1 class="page-title">${esc(t("se.title"))}</h1>
    <p class="page-desc">${esc(t("se.desc"))}</p>
    <div class="split">
      <aside class="side panel" id="se-filters">
        <div class="panel-head"><span class="panel-title">${L === "zh" ? "检索条件" : "Criteria"}</span>
          <button class="ghost" id="btn-reset">${esc(t("se.reset"))}</button></div>

        <label class="field"><span class="lbl">${esc(t("se.keyword"))}</span>
          <input type="search" id="f-q" placeholder="${esc(t("se.keyword.ph"))}" value="${esc(S.c.q)}" />
        </label>

        <label class="field"><span class="lbl">${esc(t("se.match"))}</span>
          <div class="chips">
            <span class="chip ${S.c.match === "all" ? "on" : ""}" data-match="all">${esc(t("se.match.all"))}</span>
            <span class="chip ${S.c.match === "any" ? "on" : ""}" data-match="any">${esc(t("se.match.any"))}</span>
          </div>
        </label>

        <label class="field"><span class="lbl">${esc(t("se.type"))}</span>${facetDropdown("types", S.c.types)}</label>

        <label class="field"><span class="lbl">${esc(t("se.class"))}</span>${facetDropdown("classes", S.c.classes)}</label>

        <label class="field"><span class="lbl">${esc(t("se.prog"))}</span>${facetDropdown("programs", S.c.programs)}</label>

        <label class="field"><span class="lbl">${esc(t("se.var"))}</span>${facetDropdown("variables", S.c.variables)}</label>

        <label class="field"><span class="lbl">${esc(t("se.region"))}</span>${facetDropdown("regions", S.c.regions)}</label>

        <label class="field"><span class="lbl">${esc(t("se.terr"))}</span>${facetDropdown("territories", S.c.territories)}</label>

        <label class="field"><span class="lbl">${esc(t("se.decl"))}</span>${facetDropdown("declared", S.c.declared)}</label>

        <label class="field"><span class="lbl">${esc(t("se.ass"))}</span>${facetDropdown("assessed", S.c.assessed)}</label>

        <label class="field"><span class="lbl">${L === "zh" ? "空间范围" : "Spatial extent"}</span>
          <div class="chips">
            <span class="chip ${S.c.bbox ? "on" : ""}" id="f-bbox-chip">${esc(t("se.space.on"))}</span>
            <span class="chip ${S.c.gbon ? "on" : ""}" id="f-gbon">${esc(t("se.gbon"))}</span>
          </div>
          <div id="bbox-text" class="muted" style="font-size:11px;margin-top:5px">${S.c.bbox ? esc(S.c.bbox.join(", ")) : ""}</div>
        </label>

        <button class="primary" id="btn-search" style="width:100%">${esc(t("se.search"))}</button>
      </aside>

      <section>
        <div class="panel">
          <div class="panel-head">
            <span class="panel-title">${esc(t("se.results"))}
              <small id="res-count">${esc(t("se.results.n", { n: fmtNum(S.rows.length) }))}</small>
              <small id="res-time"></small>
            </span>
            <span class="chips">
              <span class="chip ${S.view === "table" ? "on" : ""}" data-view="table">${esc(t("se.view.table"))}</span>
              <span class="chip ${S.view === "map" ? "on" : ""}" data-view="map">${esc(t("se.view.map"))}</span>
            </span>
          </div>
          <div id="se-active" class="filter-summary"></div>
          <div id="result-area"></div>
        </div>
      </section>
    </div>
  </div>`);

  bind(node);
  if (openDdKey) {
    const dd = node.querySelector(`.dd[data-dd="${openDdKey}"]`);
    if (dd) dd.querySelector(".dd-panel").hidden = false;
    openDdKey = null;
  }
  renderActive(node);
  renderResults(node);
  return node;
}

function bind(node) {
  const q = node.querySelector("#f-q");
  q.addEventListener("input", debounce(() => { S.c.q = q.value; run(node, false); }, 320));
  q.addEventListener("keydown", (ev) => { if (ev.key === "Enter") run(node, true); });

  node.querySelectorAll("[data-match]").forEach((c) => c.addEventListener("click", () => {
    S.c.match = c.dataset.match;
    node.querySelectorAll("[data-match]").forEach((x) => x.classList.toggle("on", x === c));
    run(node);
  }));

  // 下拉菜单（多选）：展开/收起 + 复选联动
  const panels = node.querySelectorAll(".dd-panel");
  node.querySelectorAll("[data-dd]").forEach((dd) => {
    const btn = dd.querySelector(".dd-btn");
    const panel = dd.querySelector(".dd-panel");
    btn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      const willOpen = panel.hidden;
      panels.forEach((p) => (p.hidden = true));
      panel.hidden = !willOpen;
    });
    panel.querySelectorAll('input[type="checkbox"]').forEach((cb) => cb.addEventListener("change", () => {
      const key = dd.dataset.dd;
      const vals = [...panel.querySelectorAll('input[type="checkbox"]:checked')].map((c) => c.value);
      S.c[key] = vals;
      dd.querySelector(".dd-label").textContent = ddSummary(vals);
      openDdKey = key;
      run(node);
    }));
  });
  ensureDocClose();

  node.querySelector("#f-gbon").addEventListener("click", (ev) => {
    S.c.gbon = !S.c.gbon;
    ev.currentTarget.classList.toggle("on", S.c.gbon);
    run(node);
  });

  node.querySelector("#f-bbox-chip").addEventListener("click", (ev) => {
    if (S.c.bbox) { S.c.bbox = null; ev.currentTarget.classList.remove("on"); node.querySelector("#bbox-text").textContent = ""; run(node); }
    else location.hash = "#/map";
  });

  node.querySelector("#btn-reset").addEventListener("click", () => {
    S.c = { ...EMPTY_CRITERIA };
    S.rows = search(S.c);
    const host = node.closest("#app") || node.parentElement;
    if (host) host.replaceChildren(renderSearch(null));
    location.hash = "#/search";
  });

  node.querySelector("#btn-search").addEventListener("click", () => run(node, true));

  node.querySelectorAll("[data-view]").forEach((c) => c.addEventListener("click", () => {
    S.view = c.dataset.view;
    node.querySelectorAll("[data-view]").forEach((x) => x.classList.toggle("on", x === c));
    renderResults(node);
  }));
}

function run(node, push = true) {
  S.c.page = 1;
  const t0 = performance.now();
  S.rows = search(S.c);
  metrics.hit();
  node.querySelector("#res-count").textContent = t("se.results.n", { n: fmtNum(S.rows.length) });
  node.querySelector("#res-time").textContent = `${(performance.now() - t0).toFixed(1)} ms`;
  renderActive(node);
  renderResults(node);
  if (push) location.hash = buildHash("search", null, criteriaToParams(S.c));
}

function renderActive(node) {
  const box = node.querySelector("#se-active");
  const n = activeCriteriaCount(S.c);
  if (!n) { box.innerHTML = `<span class="tag">${esc(t("se.active"))}：${esc(t("se.none"))}</span>`; return; }
  const items = [];
  if (S.c.q) items.push(`“${esc(S.c.q)}”`);
  ["types", "classes", "programs", "variables", "regions", "territories", "declared", "assessed"]
    .forEach((k) => S.c[k].forEach((v) => items.push(esc(tv(v) || v))));
  if (S.c.gbon) items.push("GBON");
  if (S.c.bbox) items.push(`bbox ${esc(S.c.bbox.join(","))}`);
  box.innerHTML = `<span class="tag acc">${esc(t("se.active"))} ${n}</span>`
    + items.slice(0, 12).map((x) => `<span class="tag">${x}</span>`).join("")
    + (items.length > 12 ? `<span class="tag">+${items.length - 12}</span>` : "");
}

function renderResults(node) {
  const area = node.querySelector("#result-area");
  if (S.view === "map") return renderMapResults(area);
  if (S.map) { S.map.destroy(); S.map = null; }

  const { page, total, pages } = paginate(S.rows, S.c.page, S.c.size);
  if (!total) {
    area.innerHTML = `<div class="table-wrap empty"><div class="empty-state">${esc(t("se.empty"))}</div></div>`;
    return;
  }

  const L = getLang();
  const th = (key, label) => {
    const active = S.c.sort === key || S.c.sort === `-${key}`;
    const dir = active && S.c.sort.startsWith("-") ? " ▾" : " ▴";
    return `<th data-sort="${key}" class="${active ? "sorted" : ""}">${esc(label)}${active ? dir : ""}</th>`;
  };

  area.innerHTML = `
    <div class="table-wrap" id="se-table">
      <table class="data">
        <thead><tr>
          ${th("name", t("se.col.name"))}
          ${th("type", t("se.col.type"))}
          ${th("terr", t("se.col.terr"))}
          <th>${esc(t("se.col.pos"))}</th>
          ${th("status", t("se.col.status"))}
          <th>${esc(t("se.col.prog"))}</th>
        </tr></thead>
        <tbody>
          ${page.map((s) => `
            <tr data-id="${s.id}" style="cursor:pointer">
              <td>
                <a href="#/station/${s.id}" data-station="${s.id}">${esc(s.name || "—")}</a>
                <span class="sub mono">${esc(s.wigos || "")}</span>
              </td>
              <td class="dim">${esc(tv(s.type) || "—")}</td>
              <td class="dim">${esc(tv(s.terr) || "—")}</td>
              <td class="mono">${esc(fmtCoord(s.lat, s.lon))}<span class="sub">${s.elev != null ? `${fmtNum(s.elev)} m` : ""}</span></td>
              <td>
                <span class="tag ${s.decl === "Operational" ? "ok" : s.decl === "Closed" ? "bad" : "warn"}">${esc(tv(s.decl) || "—")}</span>
                ${s.ass && s.ass !== "Unknown" ? `<span class="sub">${L === "zh" ? "评估" : "assessed"}: ${esc(tv(s.ass))}</span>` : ""}
              </td>
              <td>${(s.prog || []).slice(0, 3).map((p) => `<span class="tag">${esc(p.n)}</span>`).join(" ")}
                ${(s.prog || []).length > 3 ? `<span class="sub">+${(s.prog || []).length - 3}</span>` : ""}</td>
            </tr>`).join("")}
        </tbody>
      </table>
    </div>
    <div class="pager">
      <button class="sm" id="pg-prev" ${S.c.page <= 1 ? "disabled" : ""}>‹</button>
      <span>${S.c.page} / ${pages} · ${fmtNum(total)}</span>
      <button class="sm" id="pg-next" ${S.c.page >= pages ? "disabled" : ""}>›</button>
      <select id="pg-size">
        ${[25, 50, 100].map((n) => `<option value="${n}" ${S.c.size === n ? "selected" : ""}>${n}</option>`).join("")}
      </select>
    </div>`;

  area.querySelectorAll("tr[data-id]").forEach((tr) => {
    tr.addEventListener("click", () => { location.hash = `#/station/${tr.dataset.id}`; });
  });

  const prev = area.querySelector("#pg-prev");
  const next = area.querySelector("#pg-next");
  prev?.addEventListener("click", () => { S.c.page--; renderResults(node); location.hash = buildHash("search", null, criteriaToParams(S.c)); });
  next?.addEventListener("click", () => { S.c.page++; renderResults(node); location.hash = buildHash("search", null, criteriaToParams(S.c)); });
  area.querySelector("#pg-size")?.addEventListener("change", (ev) => {
    S.c.size = Number(ev.target.value); S.c.page = 1; renderResults(node);
  });
  area.querySelectorAll("th[data-sort]").forEach((h) => h.addEventListener("click", () => {
    const key = h.dataset.sort;
    S.c.sort = S.c.sort === key ? `-${key}` : key;
    S.c.page = 1;
    S.rows = search(S.c);
    renderResults(node);
  }));
}

function renderMapResults(area) {
  area.innerHTML = `<div class="map-box" style="height:560px">
    <div class="map-ui tr"><button class="sm" id="mm-reset">${esc(t("mp.reset"))}</button></div>
    <div class="map-ui bl"><div class="map-legend" id="mm-legend"></div></div>
  </div>
  <div class="pager"><span>${esc(t("se.results.n", { n: fmtNum(S.rows.length) }))}</span></div>`;
  const box = area.querySelector(".map-box");
  S.map = createMap(box, {
    onPointClick: (p) => { location.hash = `#/station/${p.id}`; },
  });
  S.map.setBasemap(store.basemap);
  S.map.setPoints(S.rows);
  S.map.setColorMode("type");
  const legend = area.querySelector("#mm-legend");
  legend.innerHTML = `<div class="ttl">${esc(t("mp.legend"))}</div>`
    + S.map.legend().slice(0, 8).map(([k, c]) => `<div class="row"><span class="dot" style="background:${c}"></span>${esc(tv(k) || k)}</div>`).join("");
  area.querySelector("#mm-reset").addEventListener("click", () => S.map.reset());
}

export function setBBox(bbox) {
  S.c.bbox = bbox;
  S.rows = search(S.c);
}
