/* 应用入口：数据载入、路由、语言与主题切换 */

import { loadAll, store } from "./data.js";
import { t, setLang, getLang, applyStatic } from "./i18n.js";
import { parseHash, esc, el, fmtDate } from "./util.js";
import { renderOverview } from "./views/overview.js";
import { renderSearch } from "./views/search.js";
import { renderMap } from "./views/map.js";
import { renderStation } from "./views/station.js";
import { renderExport } from "./views/export.js";
import { renderOps, loadProbe } from "./views/ops.js";
import { renderEdit } from "./views/edit.js";
import { renderUsers } from "./views/users.js";
import { session, ROLE_BY_ID } from "./auth.js";
import { applyAnno, setNotes } from "./anno.js";

const app = document.getElementById("app");
const nav = document.getElementById("nav");

const THEME_KEY = "wigos-portal-theme";
const LANG_KEY = "wigos-portal-lang";
const QUERY = new URLSearchParams(location.search);
const DOC_MODE = QUERY.get("doc") === "1";
const ANNO = QUERY.get("anno") || "";
const NOTES = QUERY.get("notes") === "1";
const ONLY = QUERY.get("only") || "";
const ROUTE = QUERY.get("route") || "";     // 插图模式：直接指定路由，避免 hash 触发二次渲染
const ONLY_DELAY = Number(QUERY.get("delay")) || 1500;   // 等待异步详情渲染完成再搬取区块

/** 目标区块常含异步填充内容（观测、校验结果等），轮询至高度稳定后再搬取 */
function waitAndApplyOnly(tries = 0) {
  const node = document.querySelector(ONLY);
  const h = node ? node.getBoundingClientRect().height : 0;
  if (h > 110 || tries > 60) { applyOnly(); return; }
  setTimeout(() => waitAndApplyOnly(tries + 1), 100);
}

/** 搬取区块后冻结后续路由重渲染，避免视图重建把已搬出的内容换回 */
function freezeRoute() {
  window.addEventListener("hashchange", (ev) => { ev.stopImmediatePropagation(); }, true);
}

/** 仅保留指定区块，用于生成技术方案插图的小幅局部图。
    保留节点本体并移出其余内容，避免视图异步回调写入已搬空的容器。 */
function applyOnly(sel = ONLY) {
  const node = document.querySelector(sel);
  if (!node) return;
  const holder = document.createElement("div");
  holder.id = "only-holder";
  holder.appendChild(node);
  document.body.appendChild(holder);
  document.body.classList.add("only-mode");
}

function setTheme(theme) {
  document.body.dataset.theme = theme;
  localStorage.setItem(THEME_KEY, theme);
  // 主题切换后地图需重绘（底图配色随主题变化）
  window.dispatchEvent(new CustomEvent("themechange"));
}

function setActiveNav(route) {
  nav.querySelectorAll("a").forEach((a) => a.classList.toggle("active", a.dataset.route === route));
}

/** 顶栏显示当前演示身份（分级用户管理的可切换入口） */
function syncIdentity() {
  const node = document.getElementById("whoami");
  if (!node) return;
  const u = session.user;
  const r = ROLE_BY_ID.get(u.role);
  node.textContent = `L${r.lvl} ${getLang() === "zh" ? r.zh : r.en} · ${u.acct}`;
  node.title = `${u.name} · ${u.org}`;
  node.onclick = () => { location.hash = "#/users"; };
}

function render(route, id, params) {
  setActiveNav(route);
  syncIdentity();
  window.scrollTo({ top: 0 });
  switch (route) {
    case "search": app.replaceChildren(renderSearch(params)); break;
    case "map": app.replaceChildren(renderMap()); break;
    case "station": app.replaceChildren(renderStation(id)); break;
    case "export": app.replaceChildren(renderExport()); break;
    case "ops": app.replaceChildren(renderOps()); break;
    case "edit": app.replaceChildren(renderEdit()); break;
    case "users": app.replaceChildren(renderUsers()); break;
    default: app.replaceChildren(renderOverview());
  }
  applyStatic(document);
  if (ONLY) { freezeRoute(); waitAndApplyOnly(); }
  applyAnno(ANNO);
}

function route() {
  if (ROUTE) {                    // 插图模式：单一渲染，无 hash 参与
    const [name, id] = ROUTE.split("|");
    render(name, id || null, Object.fromEntries(new URLSearchParams(location.search)));
    return;
  }
  const { route: r, id, params } = parseHash();
  render(r, id, params);
}

async function boot() {
  const query = QUERY;
  session.restore();
  syncIdentity();
  const theme = DOC_MODE ? "light" : (query.get("theme") || localStorage.getItem(THEME_KEY) || "dark");
  document.body.dataset.theme = theme;
  if (DOC_MODE) document.body.classList.add("doc-mode");
  setNotes(NOTES);
  setLang(query.get("lang") || localStorage.getItem(LANG_KEY) || "zh");
  applyStatic(document);

  try {
    await loadAll();
    await loadProbe();
  } catch (err) {
    app.replaceChildren(el(`<div class="panel"><div class="empty-state">${esc(t("err.load"))}<div class="mono" style="margin-top:10px">${esc(String(err))}</div></div></div>`));
    return;
  }

  document.getElementById("foot-snapshot").textContent =
    `${t("common.updated")} ${fmtDate(store.meta?.fetchedAt)} · ${store.stations.length} ${t("ov.kpi.cached")}`;

  document.getElementById("btn-lang").addEventListener("click", () => {
    const next = getLang() === "zh" ? "en" : "zh";
    setLang(next);
    localStorage.setItem(LANG_KEY, next);
    applyStatic(document);
    route();
  });

  document.getElementById("btn-theme").addEventListener("click", () => {
    setTheme(document.body.dataset.theme === "dark" ? "light" : "dark");
    route();
  });

  window.addEventListener("hashchange", route);
  window.addEventListener("themechange", () => { /* 视图在重渲染时按新主题绘制地图 */ });
  if (!location.hash && !ROUTE) location.hash = "#/overview";
  route();
}

boot();
