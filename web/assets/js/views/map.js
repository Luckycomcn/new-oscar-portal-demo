/* 地图与空间能力（MVP F-3、F-5）
   底图分域策略、视口裁剪与聚合、框选空间检索、要素着色与图例。 */

import { store } from "../data.js";
import { setBBox } from "./search.js";
import { t, tv, getLang } from "../i18n.js";
import { esc, el, fmtNum, toast } from "../util.js";
import { createMap } from "../map.js";

const MS = { color: "type", basemapStyle: "intl", mode: "pan", bbox: null };

export function renderMap() {
  const L = getLang();
  const node = el(`
  <div>
    <h1 class="page-title">${esc(t("mp.title"))}</h1>
    <p class="page-desc">${esc(t("mp.desc"))}</p>

    <div class="panel">
      <div class="panel-head">
        <span class="panel-title">
          <span id="mp-count">${esc(t("mp.total", { n: fmtNum(store.stations.length) }))}</span>
          <small id="mp-visible"></small>
        </span>
        <span class="chips" id="mp-toolbar">
          <select id="mp-basemap" style="width:auto">
            <option value="intl" ${MS.basemapStyle === "intl" ? "selected" : ""}>${esc(t("mp.bm.intl"))}</option>
            <option value="cn" ${MS.basemapStyle === "cn" ? "selected" : ""}>${esc(t("mp.bm.cn"))}</option>
          </select>
          <select id="mp-color" style="width:auto">
            <option value="type" ${MS.color === "type" ? "selected" : ""}>${esc(t("mp.color.type"))}</option>
            <option value="status" ${MS.color === "status" ? "selected" : ""}>${esc(t("mp.color.status"))}</option>
          </select>
          <span class="chip ${MS.mode === "pan" ? "on" : ""}" data-mode="pan">${esc(t("mp.mode.pan"))}</span>
          <span class="chip ${MS.mode === "bbox" ? "on" : ""}" data-mode="bbox">${esc(t("mp.mode.bbox"))}</span>
          <button class="sm" id="mp-reset">${esc(t("mp.reset"))}</button>
        </span>
      </div>

      <div class="map-box" id="mp-canvas" style="height:600px">
        <div class="map-ui tl">
          <div class="map-legend">
            <div class="ttl">${esc(t("mp.legend"))}</div>
            <div id="mp-legend"></div>
          </div>
        </div>
        <div class="map-ui br">
          <button class="sm" id="mp-zin">＋</button>
          <button class="sm" id="mp-zout">－</button>
        </div>
      </div>

      <div class="chips" style="margin-top:12px">
        <span class="tag" id="mp-bbox-tag">${esc(t("mp.bbox"))}：${MS.bbox ? esc(MS.bbox.join(", ")) : "—"}</span>
        <button class="sm" id="mp-apply" ${MS.bbox ? "" : "disabled"}>${esc(t("mp.apply"))}</button>
        <button class="sm" id="mp-clear" ${MS.bbox ? "" : "disabled"}>${esc(t("mp.clear"))}</button>
      </div>
      <div class="muted" style="font-size:12px;margin-top:8px">${esc(t("mp.bm.note"))}</div>
    </div>
  </div>`);

  const box = node.querySelector("#mp-canvas");
  const legend = node.querySelector("#mp-legend");
  const visibleTag = node.querySelector("#mp-visible");
  const bboxTag = node.querySelector("#mp-bbox-tag");
  const applyBtn = node.querySelector("#mp-apply");
  const clearBtn = node.querySelector("#mp-clear");

  const map = createMap(box, {
    onPointClick: (p) => { location.hash = `#/station/${p.id}`; },
    onBbox: (bbox) => {
      MS.bbox = bbox;
      bboxTag.textContent = `${t("mp.bbox")}：${bbox.join(", ")}`;
      applyBtn.disabled = false;
      clearBtn.disabled = false;
      toast(t("toast.bbox"));
    },
    onView: ({ visible }) => {
      visibleTag.textContent = t("mp.count", { n: fmtNum(visible) });
    },
  });
  map.setBasemap(store.basemap);
  map.setPoints(store.stations);
  map.setColorMode(MS.color);
  map.setBasemapStyle(MS.basemapStyle);
  map.setMode(MS.mode);
  if (MS.bbox) map.setBBox(MS.bbox);

  const paintLegend = () => {
    legend.innerHTML = map.legend().slice(0, 9)
      .map(([k, c]) => `<div class="row"><span class="dot" style="background:${c}"></span>${esc(tv(k) || k)}</div>`).join("");
  };
  paintLegend();

  node.querySelector("#mp-color").addEventListener("change", (ev) => {
    MS.color = ev.target.value;
    map.setColorMode(MS.color);
    paintLegend();
  });
  node.querySelector("#mp-basemap").addEventListener("change", (ev) => {
    MS.basemapStyle = ev.target.value;
    map.setBasemapStyle(MS.basemapStyle);
  });
  node.querySelectorAll("[data-mode]").forEach((c) => c.addEventListener("click", () => {
    MS.mode = c.dataset.mode;
    node.querySelectorAll("[data-mode]").forEach((x) => x.classList.toggle("on", x === c));
    map.setMode(MS.mode);
  }));
  node.querySelector("#mp-reset").addEventListener("click", () => map.reset());
  node.querySelector("#mp-zin").addEventListener("click", () => map.setZoom(map.getZoom() * 1.6));
  node.querySelector("#mp-zout").addEventListener("click", () => map.setZoom(map.getZoom() / 1.6));

  clearBtn.addEventListener("click", () => {
    MS.bbox = null;
    map.clearBBox();
    bboxTag.textContent = `${t("mp.bbox")}：—`;
    applyBtn.disabled = true;
    clearBtn.disabled = true;
  });
  applyBtn.addEventListener("click", () => {
    setBBox(MS.bbox);
    location.hash = "#/search";
  });

  return node;
}
