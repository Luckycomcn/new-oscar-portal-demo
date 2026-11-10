/* 总览：系统定位、体系架构、规模统计、MVP 落实矩阵、数据快照 */

import { store } from "../data.js";
import { t, getLang } from "../i18n.js";
import { esc, el, fmtNum, fmtDate } from "../util.js";

/* MVP 功能需求（官方最小可行产品清单），门户直接承担 F-3 / F-5 / F-16 / F-20 / F-21，
   写侧（F-1 / F-4 / F-7 / F-11 / F-12 / F-19 / F-25）以沙箱演示呈现，标注为「演示 / 后续」 */
const MVP = [
  { id: "F-1", zh: "表单", en: "Forms", comp: "节点", impl: "演示：单条修改 / 新建表单", state: "warn" },
  { id: "F-3", zh: "站点页 / 地图", en: "Station page / map", comp: "门户、节点", impl: "实现", state: "ok" },
  { id: "F-4", zh: "类表格批量界面", en: "Spreadsheet-like bulk interface", comp: "节点", impl: "演示：批量导入 / 修改 / 删除", state: "warn" },
  { id: "F-5", zh: "检索（简单与高级）", en: "Discovery (simple & advanced)", comp: "目录、门户、节点", impl: "实现", state: "ok" },
  { id: "F-6", zh: "分组 / 聚类", en: "Grouping", comp: "节点", impl: "后续阶段只读展示", state: "warn" },
  { id: "F-7", zh: "站点元数据管理", en: "Station metadata management", comp: "节点", impl: "演示：维护模块（沙箱）", state: "warn" },
  { id: "F-8", zh: "生命周期 / 历史", en: "Lifecycle / history", comp: "节点", impl: "只读展示", state: "warn" },
  { id: "F-9", zh: "数据校验", en: "Data validation", comp: "节点、目录", impl: "展示 + 演示逐行校验", state: "warn" },
  { id: "F-10", zh: "用户认证", en: "User authentication", comp: "节点", impl: "不参与", state: "" },
  { id: "F-11", zh: "台站标识符分配", en: "WSI allocation", comp: "节点", impl: "演示：WSI 分配规则", state: "warn" },
  { id: "F-12", zh: "角色与权限", en: "Roles and permissions", comp: "节点", impl: "演示：分级用户管理", state: "warn" },
  { id: "F-13", zh: "多提供者", en: "Multiple providers", comp: "节点", impl: "展示来源归属", state: "warn" },
  { id: "F-14", zh: "接口（OGC API - Records）", en: "API (OGC API - Records)", comp: "目录、节点", impl: "不参与", state: "" },
  { id: "F-15", zh: "摄取与批处理", en: "Ingestion / batch", comp: "节点", impl: "不参与", state: "" },
  { id: "F-16", zh: "导出与下载", en: "Export and download", comp: "门户、目录", impl: "实现", state: "ok" },
  { id: "F-19", zh: "网页记录编辑", en: "Web record editing", comp: "节点", impl: "演示：分区表单 + 差异对照", state: "warn" },
  { id: "F-20", zh: "元数据标准（必备要素）", en: "Metadata standard", comp: "节点、目录、门户", impl: "实现", state: "ok" },
  { id: "F-21", zh: "元数据表示 WMDR V2", en: "WMDR V2 representation", comp: "节点、目录、门户", impl: "实现导出", state: "ok" },
  { id: "F-22", zh: "模板", en: "Templates", comp: "节点", impl: "不参与", state: "" },
  { id: "F-23", zh: "受控词表", en: "Controlled vocabularies", comp: "节点", impl: "使用目录分发词表", state: "warn" },
  { id: "F-24", zh: "站点分级", en: "Station classification", comp: "节点", impl: "展示分级结果", state: "warn" },
  { id: "F-25", zh: "审批工作流", en: "Approval workflow", comp: "节点、目录", impl: "演示：变更单审批链", state: "warn" },
];

function bars(items, unit = "") {
  if (!items || !items.length) return `<div class="muted">—</div>`;
  const max = Math.max(...items.map((i) => i.v));
  return `<div class="bars">${items.map((i) => `
    <div class="bar-row">
      <span class="bl" title="${esc(i.k)}">${esc(i.k)}</span>
      <span class="bt"><span class="bf" style="width:${Math.max(2, (i.v / max) * 100).toFixed(1)}%"></span></span>
      <span class="bv">${esc(fmtNum(i.v))}${unit}</span>
    </div>`).join("")}</div>`;
}

function countNodes(tree) {
  let n = 0;
  const walk = (arr) => { for (const x of arr || []) { n++; walk(x.children); } };
  walk(tree);
  return n;
}

export function renderOverview() {
  const L = getLang();
  const ov = store.overview || {};
  const meta = store.meta || {};
  const programs = countNodes(store.facets.programTree);
  const variables = countNodes(store.facets.variableTree);

  const kpis = [
    { k: t("ov.kpi.total"), v: fmtNum(ov.total), s: "WMO OSCAR / Surface 全量索引" },
    { k: t("ov.kpi.cached"), v: fmtNum(ov.cached), s: "分层抽样 · 含完整记录" },
    { k: t("ov.kpi.terr"), v: fmtNum(ov.territories), s: "国家与属地" },
    { k: t("ov.kpi.prog"), v: fmtNum(programs), s: "计划 / 网络词表节点" },
    { k: t("ov.kpi.var"), v: fmtNum(variables), s: "观测变量词表节点" },
    { k: t("ov.kpi.snap"), v: fmtDate(meta.fetchedAt), s: meta.fetchedAt ? meta.fetchedAt.slice(11, 19) + " UTC" : "" },
  ];

  const node = el(`
  <div>
    <h1 class="page-title">${esc(t("ov.title"))}</h1>
    <p class="page-desc">${esc(t("ov.desc"))}</p>

    <div class="grid g3" id="ov-kpi">
      ${kpis.map((x) => `<div class="kpi"><div class="k">${esc(x.k)}</div><div class="v">${esc(x.v)}</div><div class="s">${esc(x.s)}</div></div>`).join("")}
    </div>

    <div class="panel" id="ov-arch" style="margin-top:16px">
      <div class="panel-head"><span class="panel-title">${esc(t("ov.arch"))}</span></div>
      <div class="arch">
        <div class="node">
          <b>${esc(t("ov.arch.node"))}</b>
          <div class="m">${esc(t("ov.arch.node.m"))}</div>
        </div>
        <div class="arrow"><span>${esc(t("ov.arch.pub"))}</span></div>
        <div class="node ro">
          <b>${esc(t("ov.arch.cat"))}</b>
          <div class="m">${esc(t("ov.arch.cat.m"))}</div>
        </div>
        <div class="arrow"><span>${esc(t("ov.arch.harvest"))}</span></div>
        <div class="node ro">
          <b>${esc(t("ov.arch.portal"))}</b>
          <div class="m">${esc(t("ov.arch.portal.m"))}</div>
        </div>
      </div>
      <div class="notice" style="margin-top:12px">${esc(t("app.readonly"))}：${esc(t("footer.note"))}</div>
    </div>

    <div class="grid g2" id="ov-dist" style="margin-top:16px">
      <div class="panel">
        <div class="panel-head"><span class="panel-title">${esc(t("ov.dist.region"))}</span></div>
        ${bars(ov.byRegion)}
      </div>
      <div class="panel">
        <div class="panel-head"><span class="panel-title">${esc(t("ov.dist.type"))}</span></div>
        ${bars(ov.byType)}
      </div>
      <div class="panel">
        <div class="panel-head"><span class="panel-title">${esc(t("ov.dist.prog"))}</span></div>
        ${bars(ov.byProgram)}
      </div>
      <div class="panel">
        <div class="panel-head"><span class="panel-title">${esc(t("ov.dist.status"))}</span></div>
        ${bars(ov.byStatus)}
      </div>
    </div>

    <div class="panel" id="ov-mvp" style="margin-top:16px">
      <div class="panel-head">
        <span class="panel-title">${esc(t("ov.mvp"))} <small>${esc(t("ov.mvp.desc"))}</small></span>
      </div>
      <div class="table-wrap" style="max-height:420px">
        <table class="data">
          <thead><tr>
            <th style="width:70px">ID</th>
            <th>${L === "zh" ? "需求名称" : "Requirement"}</th>
            <th style="width:170px">${L === "zh" ? "归属组件" : "Component"}</th>
            <th style="width:190px">${L === "zh" ? "门户参与方式" : "Portal participation"}</th>
            <th style="width:80px">${esc(t("op.nf.state"))}</th>
          </tr></thead>
          <tbody>
            ${MVP.map((m) => `<tr>
              <td class="mono">${esc(m.id)}</td>
              <td>${esc(L === "zh" ? m.zh : m.en)}</td>
              <td class="dim">${esc(m.comp)}</td>
              <td class="dim">${esc(m.impl)}</td>
              <td>${m.state ? `<span class="tag ${m.state}">${m.state === "ok" ? (L === "zh" ? "已实现" : "Implemented") : (L === "zh" ? "只读 / 沙箱演示 / 后续" : "Read-only / sandbox / later")}</span>` : ""}</td>
            </tr>`).join("")}
          </tbody>
        </table>
      </div>
    </div>

    <div class="panel" style="margin-top:16px">
      <div class="panel-head"><span class="panel-title">${esc(t("ov.snap"))}</span></div>
      <dl class="kv">
        <dt>${esc(t("footer.source"))}</dt><dd><a href="https://oscar.wmo.int/surface/" target="_blank" rel="noopener">oscar.wmo.int/surface</a> · ${esc(meta.source || "")}</dd>
        <dt>${L === "zh" ? "索引端点" : "Index endpoint"}</dt><dd class="mono" style="font-size:12px">${esc((meta.endpoints && meta.endpoints.index) || "")}</dd>
        <dt>${L === "zh" ? "完整记录端点" : "Record endpoint"}</dt><dd class="mono" style="font-size:12px">${esc((meta.endpoints && meta.endpoints.report) || "")}</dd>
        <dt>${L === "zh" ? "备用端点" : "Fallback endpoint"}</dt><dd class="mono" style="font-size:12px">${esc(meta.fallbackEndpoint || "")}</dd>
        <dt>${L === "zh" ? "底图" : "Basemap"}</dt><dd>${esc(meta.basemap || "")}</dd>
        <dt>${L === "zh" ? "脱敏说明" : "Redaction"}</dt><dd>${esc(meta.privacy || "")}</dd>
      </dl>
      <div class="notice" style="margin-top:12px">${esc(t("ov.hint"))}</div>
    </div>
  </div>`);
  return node;
}
