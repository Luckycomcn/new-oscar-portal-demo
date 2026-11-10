/* 导出与互操作（MVP F-16 / F-21）
   · 结果集批量导出：CSV、JSON
   · 单条记录：WMDR V2（JSON）下载
   · 机器用户取数指南：对外业务接口由目录按 OGC API - Records 提供，门户不重复提供 */

import { store, getDetail, peekDetail } from "../data.js";
import { currentRows } from "./search.js";
import { t, tv, getLang } from "../i18n.js";
import { esc, el, fmtNum, fmtCoord, toCSV, download, toast } from "../util.js";

/* WIGOS 元数据标准必备要素集（门户必须展示与导出的最小集合） */
export const MANDATORY_FIELDS = [
  { label: "wigosId", get: (s) => s.wigos },
  { label: "name", get: (s) => s.name },
  { label: "stationType", get: (s) => s.type },
  { label: "stationClass", get: (s) => (store.enrich[String(s.id)] || {}).c || s.cls },
  { label: "latitude", get: (s) => s.lat },
  { label: "longitude", get: (s) => s.lon },
  { label: "elevation", get: (s) => s.elev },
  { label: "wmoRegion", get: (s) => s.ra },
  { label: "territory", get: (s) => s.terr },
  { label: "operatingStatus", get: (s) => s.decl },
  { label: "assessedStatus", get: (s) => s.ass },
  { label: "programAffiliation", get: (s) => (s.prog || []).map((p) => `${p.n}:${p.d || ""}`).join("; ") },
  { label: "supervisingOrganization", get: (s) => (store.enrich[String(s.id)] || {}).o },
  { label: "dateEstablished", get: (s) => s.est },
  { label: "lastModified", get: (s) => (store.enrich[String(s.id)] || {}).m },
];

const ALL_FIELDS = [
  ...MANDATORY_FIELDS,
  { label: "barometerHeight", get: (s) => s.hp },
  { label: "dateClosed", get: (s) => s.closed },
  { label: "observedVariables", get: (s) => ((store.enrich[String(s.id)] || {}).v || []).join("; ") },
];

/* ------------------------------------------------------------ WMDR V2 映射 */

export function toWMDR(station, detail) {
  const rep = (detail && detail.report) || {};
  const e = store.enrich[String(station.id)] || {};
  const loc = (rep.locations || [])[0] || {};
  const orgs = (rep.organizations || []).map((o) => o.organizationName).filter(Boolean);
  return {
    wigosMetadataRepresentation: {
      "@context": ["https://wmo.int/def/wmdr/2.0"],
      identifier: station.wigos || null,
      name: station.name || null,
      aliases: (rep.aliases || []).map((a) => a.alias || a.name).filter(Boolean),
      facilityType: station.type || null,
      stationClass: e.c || station.cls || null,
      wmoRegion: station.ra || null,
      territory: station.terr || null,
      location: {
        geometry: { type: "Point", coordinates: [station.lon, station.lat] },
        elevation: station.elev ?? null,
        barometerHeight: station.hp ?? null,
        positioningMethod: loc.geoposName || null,
        validSince: loc.validSince || null,
      },
      timeZone: ((rep.timezones || [])[0] || {}).timezoneName || null,
      operatingStatus: rep.operatingStatusName || station.decl || null,
      declaredStatus: rep.declaredStatusName || station.decl || null,
      dateEstablished: station.est || null,
      dateClosed: station.closed || null,
      programmeAffiliation: (rep.stationPrograms || []).map((p) => ({
        programme: p.program,
        approvalStatus: p.approvalStatus,
        declaredStatus: ((p.stationProgramStatuses || [])[0] || {}).declaredStatusName || null,
        assessedStatus: ((p.stationProgramAssessedStatuses || [])[0] || {}).assessedStatusName || null,
      })),
      observations: (detail?.observations || []).map((o) => ({
        observedVariable: o.variable,
        geometry: o.geometry,
        programmes: (o.programs || []).map((p) => p.n),
      })),
      environment: {
        climateZone: ((rep.climateZones || [])[0] || {}).climateZoneLongName || null,
        surfaceCover: ((rep.surfaceCovers || [])[0] || {}).surfaceCoverName || null,
        localTopography: ((rep.topographies || [])[0] || {}).localTopographyName || null,
      },
      responsibleParty: orgs,
      description: ((rep.descriptions || [])[0] || {}).description || null,
      url: rep.url || null,
      provenance: {
        source: store.meta?.source || null,
        endpoint: store.meta?.endpoints?.report || null,
        snapshot: store.meta?.fetchedAt || null,
        lastModified: e.m || rep.lastModifiedOn || null,
      },
    },
  };
}

export function downloadWMDR(station, detail) {
  const payload = toWMDR(station, detail);
  download(`wmdr2_${station.wigos || station.id}.json`, JSON.stringify(payload, null, 2), "application/json");
  toast(t("toast.exported"));
}

/* ------------------------------------------------------------------ 视图 */

export function renderExport() {
  const L = getLang();
  const rows = currentRows();
  const scopeDefault = rows.length ? "result" : "all";

  const node = el(`
  <div>
    <h1 class="page-title">${esc(t("ex.title"))}</h1>
    <p class="page-desc">${esc(t("ex.desc"))}</p>

    <div class="grid g2">
      <div class="panel" id="ex-bulk">
        <div class="panel-head"><span class="panel-title">${L === "zh" ? "结果集批量导出" : "Bulk export of result set"}</span></div>
        <label class="field"><span class="lbl">${esc(t("ex.scope"))}</span>
          <select id="ex-scope">
            <option value="result" ${scopeDefault === "result" ? "selected" : ""}>${esc(t("ex.scope.result"))}（${fmtNum(rows.length)}）</option>
            <option value="all" ${scopeDefault === "all" ? "selected" : ""}>${esc(t("ex.scope.all"))}（${fmtNum(store.stations.length)}）</option>
          </select>
        </label>
        <label class="field"><span class="lbl">${esc(t("ex.fmt"))}</span>
          <select id="ex-format">
            <option value="csv">CSV</option>
            <option value="json">JSON</option>
          </select>
        </label>
        <label class="field"><span class="lbl">${esc(t("ex.fields"))}</span>
          <select id="ex-fields">
            <option value="mand">${esc(t("ex.fields.mand"))}</option>
            <option value="all">${esc(t("ex.fields.all"))}</option>
          </select>
        </label>
        <div class="chips" style="margin-bottom:12px">
          <button class="primary" id="ex-run">${esc(t("ex.run"))}</button>
          <button id="ex-dl" disabled>${esc(t("ex.download"))}</button>
          <span class="tag" id="ex-count">${esc(t("ex.rows", { n: 0 }))}</span>
        </div>
        <div class="mono-box" id="ex-preview" style="max-height:260px">${esc(t("ex.preview"))}…</div>
      </div>

      <div class="panel" id="ex-wmdr">
        <div class="panel-head"><span class="panel-title">${esc(t("ex.wmdr"))}</span></div>
        <div class="notice" style="margin-bottom:12px">${esc(t("ex.wmdr.desc"))}</div>
        <label class="field"><span class="lbl">${esc(t("st.wigos"))}</span>
          <input type="text" id="ex-wigos" placeholder="0-20000-0-60415" value="${esc((rows[0] || store.stations[0] || {}).wigos || "")}" />
        </label>
        <div class="chips" style="margin-bottom:12px">
          <button class="primary" id="ex-wmdr-run">${esc(t("ex.run"))}</button>
          <button id="ex-wmdr-dl" disabled>${esc(t("ex.download"))}</button>
        </div>
        <div class="mono-box" id="ex-wmdr-preview">${esc(t("ex.preview"))}…</div>
      </div>
    </div>

    <div class="panel" id="ex-m2m" style="margin-top:16px">
      <div class="panel-head"><span class="panel-title">${esc(t("ex.m2m"))}</span></div>
      <div class="notice" style="margin-bottom:12px">${esc(t("ex.m2m.desc"))}</div>
      <div class="mono-box">${[
        t("ex.m2m.1", { base: "https://catalogue.example.org/oapi" }),
        t("ex.m2m.2", { base: "https://catalogue.example.org/oapi", collectionId: "wigos-stations" }),
        t("ex.m2m.3"),
        t("ex.m2m.4", { base: "https://catalogue.example.org/oapi", collectionId: "wigos-stations" }),
      ].map(esc).join("\n")}
      </div>
      <div class="muted" style="font-size:12px;margin-top:10px">${esc(t("ex.m2m.note"))}</div>
    </div>
  </div>`);

  let generated = null;

  const scopeSel = node.querySelector("#ex-scope");
  const fmtSel = node.querySelector("#ex-format");
  const fieldSel = node.querySelector("#ex-fields");
  const preview = node.querySelector("#ex-preview");
  const dlBtn = node.querySelector("#ex-dl");
  const countTag = node.querySelector("#ex-count");

  const updateCount = () => {
    const data = scopeSel.value === "result" ? rows : store.stations;
    countTag.textContent = t("ex.rows", { n: fmtNum(data.length) });
  };
  scopeSel.addEventListener("change", updateCount);
  updateCount();

  node.querySelector("#ex-run").addEventListener("click", () => {
    const data = scopeSel.value === "result" ? rows : store.stations;
    const fields = fieldSel.value === "all" ? ALL_FIELDS : MANDATORY_FIELDS;
    if (fmtSel.value === "csv") {
      generated = { name: "wigos_stations.csv", text: toCSV(data, fields), mime: "text/csv;charset=utf-8" };
    } else {
      const obj = data.map((s) => Object.fromEntries(fields.map((f) => [f.label, f.get(s)])));
      generated = { name: "wigos_stations.json", text: JSON.stringify(obj, null, 2), mime: "application/json" };
    }
    preview.textContent = generated.text.slice(0, 4000);
    dlBtn.disabled = false;
    toast(t("toast.exported"));
  });
  dlBtn.addEventListener("click", () => {
    if (generated) download(generated.name, generated.text, generated.mime);
  });

  const wigosInput = node.querySelector("#ex-wigos");
  const wmdrPreview = node.querySelector("#ex-wmdr-preview");
  const wmdrDl = node.querySelector("#ex-wmdr-dl");
  let wmdrPayload = null;

  node.querySelector("#ex-wmdr-run").addEventListener("click", async () => {
    const wigos = wigosInput.value.trim();
    const station = store.stations.find((s) => s.wigos === wigos) || store.stations.find((s) => String(s.id) === wigos);
    if (!station) {
      wmdrPreview.textContent = L === "zh" ? `未在本地缓存中找到 ${wigos}` : `Not found in cache: ${wigos}`;
      return;
    }
    const detail = peekDetail(station.id) || await getDetail(station.id);
    wmdrPayload = toWMDR(station, detail);
    wmdrPreview.textContent = JSON.stringify(wmdrPayload, null, 2).slice(0, 6000);
    wmdrDl.disabled = false;
    toast(t("toast.exported"));
  });
  wmdrDl.addEventListener("click", () => {
    if (wmdrPayload) download(`wmdr2_${wigosInput.value.trim() || "record"}.json`, JSON.stringify(wmdrPayload, null, 2), "application/json");
  });

  return node;
}
