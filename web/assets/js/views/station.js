/* 站点记录展示（MVP F-3、F-20、F-21；只读展示 F-8 生命周期、F-13 来源归属、F-9 校验结果）
   按 WIGOS 元数据标准必备要素分节；未在上游发布的段落显式标注，不臆造内容。 */

import { store, getDetail, peekDetail, nearby } from "../data.js";
import { t, tv, getLang } from "../i18n.js";
import { esc, el, fmtNum, fmtCoord, fmtDate, download, toCSV, copyText, toast } from "../util.js";
import { createMap } from "../map.js";
import { MANDATORY_FIELDS, downloadWMDR } from "./export.js";

function kv(rows) {
  const filled = rows.filter(([, v]) => v != null && v !== "" && !(Array.isArray(v) && !v.length));
  if (!filled.length) {
    return `<div class="muted" style="font-size:12px">${esc(t("st.missing"))}</div>`;
  }
  return `<dl class="kv">${filled.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join("")}</dl>`;
}

function section(idx, title, body, id) {
  return `<div class="section"${id ? ` id="${id}"` : ""}><h3><span class="idx">${esc(idx)}</span>${esc(title)}</h3>${body}</div>`;
}

function statusTag(v) {
  if (!v) return "";
  const cls = v === "Operational" ? "ok" : v === "Closed" ? "bad" : "warn";
  return `<span class="tag ${cls}">${esc(tv(v))}</span>`;
}

function coverage(station, detail) {
  const rep = (detail && detail.report) || {};
  const e = store.enrich[String(station.id)] || {};
  const items = [
    [t("se.col.name"), !!station.name],
    [t("st.wigos"), !!station.wigos],
    [t("se.col.type"), !!station.type],
    [t("st.loc"), station.lat != null && station.lon != null],
    [t("se.col.status"), !!station.decl],
    [t("st.progs"), (station.prog || []).length > 0 || (rep.stationPrograms || []).length > 0],
    [t("st.obs"), (detail?.observations || []).length > 0],
    [t("st.org.name"), (rep.organizations || []).length > 0 || !!e.o],
    [t("st.instr"), (rep.instruments || []).length > 0],
    [t("st.life"), !!station.est || !!rep.dateEstablished],
  ];
  const n = items.filter(([, ok]) => ok).length;
  return {
    html: `<div class="chips" style="margin-bottom:8px">${items.map(([k, ok]) =>
      `<span class="tag ${ok ? "ok" : "warn"}">${ok ? "✓" : "○"} ${esc(k)}</span>`).join("")}</div>`,
    ratio: n / items.length,
    n, total: items.length,
  };
}

export function renderStation(id) {
  const station = store.byId.get(String(id));
  const L = getLang();

  if (!station) {
    return el(`<div class="panel"><div class="empty-state">${esc(t("st.notfound"))}</div></div>`);
  }

  const e = store.enrich[String(station.id)] || {};
  const node = el(`
  <div>
    <div class="panel" id="st-head">
      <div class="panel-head" id="st-title">
        <span>
          <h1 class="page-title" style="margin-bottom:6px">${esc(station.name || "—")}</h1>
          <div class="chips">
            <span class="tag mono">${esc(station.wigos || "—")}</span>
            <span class="tag">${esc(tv(station.type) || "—")}</span>
            ${station.cls || e.c ? `<span class="tag acc">${esc(station.cls || e.c)}</span>` : ""}
            ${statusTag(station.decl)}
            ${station.ass && station.ass !== "Unknown" ? `<span class="tag">${esc(t("se.ass"))}: ${esc(tv(station.ass))}</span>` : ""}
          </div>
        </span>
        <span class="chips">
          <button class="sm" id="st-csv">${esc(t("st.export.csv"))}</button>
          <button class="sm" id="st-wmdr">${esc(t("st.export.wmdr"))}</button>
          <button class="sm" id="st-copy">${esc(t("st.copy"))}</button>
          <a class="btn sm" href="#/edit" title="${esc(t("st.edit"))}">${esc(t("st.edit"))}</a>
        </span>
      </div>
      <div class="grid g-2-1">
        <div id="st-body"><div class="skel" style="height:320px"></div></div>
        <div>
          <div class="panel" id="st-nearpanel" style="background:transparent">
            <div class="panel-head"><span class="panel-title">${esc(t("st.nearby"))}</span></div>
            <div class="map-box" id="st-map" style="height:230px"></div>
          </div>
          <div class="panel" id="st-covpanel" style="background:transparent">
            <div class="panel-head"><span class="panel-title">${esc(t("st.coverage"))}</span></div>
            <div id="st-cov" data-static="1"></div>
          </div>
        </div>
      </div>
    </div>
  </div>`);

  const bodySlot = node.querySelector("#st-body");

  node.querySelector("#st-csv").addEventListener("click", () => {
    download(`station_${station.wigos || station.id}.csv`, toCSV([station], MANDATORY_FIELDS), "text/csv;charset=utf-8");
    toast(t("toast.exported"));
  });
  node.querySelector("#st-wmdr").addEventListener("click", async () => {
    const detail = peekDetail(station.id) || await getDetail(station.id);
    downloadWMDR(station, detail);
  });
  node.querySelector("#st-copy").addEventListener("click", async () => {
    const ok = await copyText(location.href);
    toast(ok ? t("toast.copied") : location.href);
  });

  // 地图：本站点与邻近站点同屏
  const mapBox = node.querySelector("#st-map");
  const nb = nearby(station, 6);
  const map = createMap(mapBox, { onPointClick: (p) => { location.hash = `#/station/${p.id}`; } });
  map.setBasemap(store.basemap);
  map.setPoints([station, ...nb]);
  map.setSelected(station.id);
  map.focus(station.lon, station.lat, 22);

  const render = async () => {
    const detail = peekDetail(station.id) || await getDetail(station.id);
    const rep = (detail && detail.report) || {};
    const obs = (detail && detail.observations) || [];
    const cov = coverage(station, detail);
    node.querySelector("#st-cov").innerHTML = cov.html
      + `<div class="muted" style="font-size:12px">${cov.n} / ${cov.total} · ${(cov.ratio * 100).toFixed(0)}%</div>`;

    const loc = (rep.locations || [])[0] || {};
    const tz = (rep.timezones || [])[0] || {};
    const topo = (rep.topographies || [])[0] || {};
    const cover = (rep.surfaceCovers || [])[0] || {};
    const cz = (rep.climateZones || [])[0] || {};
    const rough = (rep.surfaceRoughnesses || [])[0] || {};
    const pop = (rep.populations || [])[0] || {};

    const programs = (rep.stationPrograms || []).length ? rep.stationPrograms : (station.prog || []).map((p) => ({
      program: p.n, approvalStatus: p.ap, stationProgramStatuses: [{ declaredStatusName: p.d }],
      stationProgramAssessedStatuses: [{ assessedStatusName: p.a }],
    }));

    bodySlot.innerHTML = [
      section("3-03 / 3-06", t("st.id"), kv([
        [t("st.wigos"), (rep.wigosIds || []).map((w) => `<span class="mono">${esc(w.wid)}${w.primary ? " · primary" : ""}</span>`).join("<br>") || esc(station.wigos)],
        [t("st.alias"), (rep.aliases || []).map((a) => esc(a.alias || a.name)).filter(Boolean).join("<br>")],
        [t("se.col.type"), esc(tv(station.type))],
        ["GAW ID", rep.gawStation?.gawId ? esc(rep.gawStation.gawId) : ""],
        [t("st.progid"), programs.filter((p) => p.programSpecificId).map((p) => `${esc(p.program)}: ${esc(p.programSpecificId)}`).join("<br>")],
        [L === "zh" ? "网址" : "URL", rep.url ? `<a href="${esc(rep.url)}" target="_blank" rel="noopener">${esc(rep.url)}</a>` : ""],
      ]), "st-id"),

      section("3-07", t("st.loc"), kv([
        [t("st.latlon"), `<span class="mono">${esc(fmtCoord(station.lat, station.lon))}</span>`],
        [t("st.elev"), station.elev != null ? `${fmtNum(station.elev)} m` : ""],
        [t("st.baro"), station.hp != null ? `${fmtNum(station.hp)} m` : ""],
        [t("st.geopos"), esc(tv(loc.geoposName))],
        [t("st.tz"), esc(tz.timezoneName)],
        [t("st.loc") + (L === "zh" ? "（历史）" : " (history)"),
          (rep.locations || []).length > 1
            ? (rep.locations || []).map((l) => `<span class="mono">${esc(fmtCoord(l.latitude, l.longitude))}</span> · ${l.elevation ?? "—"} m · ${esc(fmtDate(l.validSince))}`).join("<br>")
            : ""],
      ]), "st-loc"),

      section("2-02", t("st.progs"), programs.length ? `
        <div class="table-wrap" style="max-height:none">
          <table class="data">
            <thead><tr>
              <th>${esc(t("st.prog.name"))}</th><th>${esc(t("st.prog.approv"))}</th>
              <th>${esc(t("st.prog.decl"))}</th><th>${esc(t("st.prog.ass"))}</th><th>${esc(t("st.prog.center"))}</th>
            </tr></thead>
            <tbody>${programs.map((p) => {
        const d = (p.stationProgramStatuses || [])[0] || {};
        const a = (p.stationProgramAssessedStatuses || [])[0] || {};
        return `<tr>
                <td>${esc(p.program)}</td>
                <td>${statusTag(p.approvalStatus) || "—"}</td>
                <td>${statusTag(d.declaredStatusName) || "—"}<span class="sub">${esc(fmtDate(d.memberSince))}${(d.memberTill && d.memberTill !== d.memberSince) ? ` → ${esc(fmtDate(d.memberTill))}` : ""}</span></td>
                <td>${statusTag(a.assessedStatusName) || "—"}<span class="sub">${esc(fmtDate(a.sinceDt))}${a.tillDt ? ` → ${esc(fmtDate(a.tillDt))}` : ""}</span></td>
                <td class="dim">${esc(a.dataCenterName || "—")}</td>
              </tr>`;
      }).join("")}</tbody>
          </table>
        </div>` : `<div class="muted" style="font-size:12px">${esc(t("st.missing"))}</div>`, "st-prog"),

      section("1-01 / 1-04", `${t("st.obs")} · ${t("st.obs.n", { n: obs.length })}`, obs.length ? `
        <div class="table-wrap" style="max-height:320px">
          <table class="data">
            <thead><tr><th>${esc(t("st.obs.var"))}</th><th>${esc(t("st.obs.geo"))}</th><th>${esc(t("st.progs"))}</th><th>${esc(t("common.updated"))}</th></tr></thead>
            <tbody>${obs.map((o) => `<tr>
              <td>${esc(tv(o.variable) || o.variable)}</td>
              <td class="dim">${esc(tv(o.geometry))}</td>
              <td>${(o.programs || []).map((p) => `<span class="tag">${esc(p.n)}</span>`).join(" ")}</td>
              <td class="mono">${esc(fmtDate(o.modified))}</td>
            </tr>`).join("")}</tbody>
          </table>
        </div>
        <div class="muted" style="font-size:12px;margin-top:8px">${L === "zh" ? "观测时间表与国际交换时间表由节点维护，本条记录上游未发布该要素。" : "Observation and international exchange schedules are maintained in the Node and are not published for this record."}</div>`
        : `<div class="muted" style="font-size:12px">${esc(t("st.missing"))}</div>`, "st-obs"),

      section("5-01 / 5-02", t("st.instr"), `<div class="muted" style="font-size:12px">${L === "zh"
        ? "仪器与观测方法元数据由 WIGOS 节点维护并发布至目录；本条记录的仪器段未在目录侧发布，按标准以「未记录」显式标注。"
        : "Instrument and method metadata are maintained in the WIGOS Node; the instrument section is not published for this record and is explicitly flagged."}</div>`, "st-instr"),

      section("4-01 … 4-07", t("st.env"), kv([
        [L === "zh" ? "气候带" : "Climate zone", esc(cz.climateZoneLongName)],
        [L === "zh" ? "下垫面" : "Surface cover", cover.surfaceCoverName ? `${esc(cover.surfaceCoverName)}<span class="sub">${esc(cover.surfaceCoverSchemeName || "")}</span>` : ""],
        [L === "zh" ? "地表粗糙度" : "Surface roughness", esc(rough.surfaceRoughnessName)],
        [L === "zh" ? "局地地形" : "Local topography", esc(topo.localTopographyName)],
        [L === "zh" ? "相对海拔" : "Relative elevation", esc(topo.relativeElevationName)],
        [L === "zh" ? "地形背景" : "Topographical context", esc(topo.topographicalContextName)],
        [L === "zh" ? "10 km / 50 km 人口（千）" : "Population 10 km / 50 km (k)", pop.pop10km != null || pop.pop50km != null ? `${pop.pop10km ?? "—"} / ${pop.pop50km ?? "—"}` : ""],
      ]), "st-env"),

      section("9-01 / 10-01", t("st.org"), kv([
        [t("st.org.name"), (rep.organizations || []).map((o) => esc(o.organizationName)).join("<br>") || (e.o ? esc(e.o) : "")],
        [t("st.org.contact"), (rep.contacts || []).length
          ? (rep.contacts || []).map((c) => `${esc(c.org || "—")} · ${esc(c.country || "—")}${(c.functions || []).length ? ` · ${(c.functions || []).map(esc).join(" / ")}` : ""}`).join("<br>")
          : ""],
        [L === "zh" ? "数据政策与使用限制" : "Data policy and use conditions", `<span class="tag warn">${L === "zh" ? "上游未发布" : "not published upstream"}</span>`],
      ]) + `<div class="muted" style="font-size:12px;margin-top:8px">${esc(t("st.contact.privacy"))}</div>`, "st-org"),

      section("F-8", t("st.life"), kv([
        [t("st.life.est"), esc(fmtDate(rep.dateEstablished || station.est))],
        [t("st.life.closed"), esc(fmtDate(rep.dateClosed || station.closed))],
        [t("st.life.event"), (rep.events || []).map((ev) => `${esc(ev.eventName || ev.event || "")} ${esc(fmtDate(ev.fromDt || ev.validSince))}${ev.toDt ? ` → ${esc(fmtDate(ev.toDt))}` : ""}`).filter(Boolean).join("<br>")],
        [t("st.desc"), (rep.descriptions || []).map((d) => `<div style="margin-bottom:6px">${esc(d.description)}<span class="sub">${esc(fmtDate(d.validSince))}</span></div>`).join("")],
      ]), "st-life"),

      section("F-9 / F-13", t("st.prov"), kv([
        [t("st.prov.src"), `<span class="mono" style="font-size:12px">${esc(store.meta?.endpoints?.report || "")}</span>`],
        [t("st.prov.node"), esc(store.meta?.source || "")],
        [t("st.prov.cache"), `${esc(store.meta?.fetchedAt || "")} · ${L === "zh" ? "只读缓存，可由目录重建" : "read-only cache, rebuildable from the Catalogue"}`],
        [t("st.lastmod"), esc(fmtDate(rep.lastModifiedOn || e.m))],
      ]), "st-prov"),
    ].join("");
  };

  render();
  return node;
}
