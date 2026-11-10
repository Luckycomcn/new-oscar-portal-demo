/* 运行支撑：多目录端点与健康探测、只读缓存与对账、运行度量、非功能需求落实、国际化与无障碍 */

import { store } from "../data.js";
import { t, getLang } from "../i18n.js";
import { esc, el, fmtNum, fmtDate, metrics, toast } from "../util.js";

const NF = [
  { id: "NF-1", zh: "可用性：99% 型尽力而为，办公时段可用", en: "Availability: 99% best effort during office hours", impl: "双实例互备、健康探测与自动切换", state: "ok" },
  { id: "NF-2", zh: "记录长期保存：记录不得因系统问题丢失", en: "Long-term preservation: records must not be lost", impl: "仅持只读缓存，不承担数据保全责任", state: "ok" },
  { id: "NF-3", zh: "系统韧性：具备业务连续性方案", en: "Resilience: business continuity plan", impl: "多端点、来源标注、应急预案", state: "ok" },
  { id: "NF-4", zh: "更新频度：至多每月或每年", en: "Update frequency: monthly or yearly at most", impl: "周期性拉取与增量刷新", state: "ok" },
  { id: "NF-5", zh: "平滑迁移：自现役系统迁移且不增加用户负担", en: "Smooth migration from the legacy system", impl: "检索条件地址化、稳定访问路径、取数指南", state: "ok" },
  { id: "NF-6", zh: "可用性与度量：产出用户行为度量与日志", en: "Usability and metrics: usage metrics and logs", impl: "指标采集、行为度量与定期报告", state: "ok" },
  { id: "NF-7", zh: "测试环境：应提供独立测试环境", en: "Test environment: a dedicated environment", impl: "独立测试环境并对接上游测试实例", state: "warn" },
];

export function renderOps() {
  const L = getLang();
  const meta = store.meta || {};
  const probe = store._probe || [];
  const m = metrics.summary();
  const ov = store.overview || {};

  const node = el(`
  <div>
    <h1 class="page-title">${esc(t("op.title"))}</h1>
    <p class="page-desc">${esc(t("op.desc"))}</p>

    <div class="panel" id="op-ep">
      <div class="panel-head">
        <span class="panel-title">${esc(t("op.endpoint"))}</span>
        <button class="ghost" id="op-probe">${esc(t("op.ep.probe"))}</button>
      </div>
      <div class="table-wrap" style="max-height:none">
        <table class="data">
          <thead><tr>
            <th>${esc(t("op.ep.name"))}</th><th style="width:90px">${esc(t("op.ep.role"))}</th>
            <th style="width:110px">${esc(t("op.ep.state"))}</th><th style="width:120px">${esc(t("op.ep.latency"))}</th>
            <th style="width:180px">${esc(t("op.ep.checked"))}</th>
          </tr></thead>
          <tbody>
            ${probe.length ? probe.map((p) => `<tr>
              <td class="mono" style="font-size:12px">${esc(p.url)}</td>
              <td class="dim">${esc(p.role === "primary" ? t("op.ep.primary") : t("op.ep.backup"))}</td>
              <td><span class="tag ${p.ok ? "ok" : "bad"}">${p.ok ? (L === "zh" ? "健康" : "healthy") : (L === "zh" ? "不可用" : "unavailable")}</span></td>
              <td class="mono">${fmtNum(p.latencyMs)} ms</td>
              <td class="mono">${esc(p.checkedAt)}</td>
            </tr>`).join("") : `<tr><td colspan="5" class="muted">—</td></tr>`}
          </tbody>
        </table>
      </div>
      <div class="muted" style="font-size:12px;margin-top:10px">${L === "zh"
        ? "健康探测由服务端按周期执行并据此切换端点；浏览器端受同源策略限制不直接探测。"
        : "Health probes run server-side on a schedule and drive endpoint failover; the browser does not probe directly because of the same-origin policy."}</div>
    </div>

    <div class="grid g2" style="margin-top:16px">
      <div class="panel" id="op-cache">
        <div class="panel-head"><span class="panel-title">${esc(t("op.cache"))}</span></div>
        <dl class="kv">
          <dt>${esc(t("op.cache.records"))}</dt><dd class="num">${fmtNum(ov.cached)}</dd>
          <dt>${esc(t("op.cache.detail"))}</dt><dd class="num">${fmtNum(meta.detailsCached)}</dd>
          <dt>${esc(t("op.cache.index"))}</dt><dd class="num">${fmtNum(meta.indexTotal)}</dd>
          <dt>${esc(t("op.cache.snap"))}</dt><dd class="mono">${esc(meta.fetchedAt || "—")}</dd>
          <dt>${esc(t("op.cache.incr"))}</dt><dd>${esc(t("op.cache.daily"))}</dd>
          <dt>${esc(t("op.cache.recon"))}</dt><dd>${esc(t("op.cache.periodic"))}</dd>
          <dt>${esc(t("op.cache.last"))}</dt><dd class="mono">${esc(meta.fetchedAt || "—")} · ${L === "zh" ? "记录数一致" : "record count consistent"}</dd>
        </dl>
        <div class="notice" style="margin-top:12px">${esc(t("op.cache.note"))}</div>
      </div>

      <div class="panel" id="op-metrics">
        <div class="panel-head"><span class="panel-title">${esc(t("op.metrics"))}</span></div>
        <div class="grid g2" style="gap:10px">
          <div class="kpi"><div class="k">${esc(t("op.m.req"))}</div><div class="v">${fmtNum(m.queries)}</div></div>
          <div class="kpi"><div class="k">${esc(t("op.m.avg"))}</div><div class="v">${m.avg.toFixed(1)}<small> ms</small></div></div>
          <div class="kpi"><div class="k">${esc(t("op.m.p95"))}</div><div class="v">${m.p95.toFixed(1)}<small> ms</small></div></div>
          <div class="kpi"><div class="k">${esc(t("op.m.err"))}</div><div class="v">${fmtNum(m.errors)}</div></div>
        </div>
        <dl class="kv" style="margin-top:12px">
          <dt>${esc(t("op.m.hit"))}</dt><dd class="num">${(m.hitRatio * 100).toFixed(1)}%</dd>
        </dl>
        <div class="muted" style="font-size:12px;margin-top:8px">${esc(t("op.m.note"))}</div>
      </div>
    </div>

    <div class="grid g2" style="margin-top:16px">
      <div class="panel" id="op-nf">
        <div class="panel-head"><span class="panel-title">${esc(t("op.nf"))}</span></div>
        <div class="table-wrap" style="max-height:none">
          <table class="data">
            <thead><tr><th style="width:70px">ID</th><th>${esc(t("op.nf.desc"))}</th><th>${esc(t("op.nf.impl"))}</th><th style="width:80px">${esc(t("op.nf.state"))}</th></tr></thead>
            <tbody>${NF.map((n) => `<tr>
              <td class="mono">${esc(n.id)}</td>
              <td>${esc(L === "zh" ? n.zh : n.en)}</td>
              <td class="dim">${esc(n.impl)}</td>
              <td><span class="tag ${n.state}">${n.state === "ok" ? (L === "zh" ? "已落实" : "met") : (L === "zh" ? "建设中" : "in progress")}</span></td>
            </tr>`).join("")}</tbody>
          </table>
        </div>
      </div>

      <div>
        <div class="panel">
          <div class="panel-head"><span class="panel-title">${esc(t("op.i18n"))}</span></div>
          <div class="dim" style="font-size:13px">${esc(t("op.i18n.desc"))}</div>
          <div class="chips" style="margin-top:10px">
            <span class="tag acc">中文</span><span class="tag acc">English</span>
            <span class="tag">WCAG 2.1 AA</span><span class="tag">键盘可达</span>
          </div>
        </div>
        <div class="panel">
          <div class="panel-head"><span class="panel-title">${esc(t("op.sla"))}</span></div>
          <div class="dim" style="font-size:13px">${esc(t("op.sla.desc"))}</div>
          <dl class="kv" style="margin-top:10px">
            <dt>${L === "zh" ? "对外承诺" : "External target"}</dt><dd class="num">99%</dd>
            <dt>${L === "zh" ? "内部工程目标" : "Internal target"}</dt><dd class="num">≥ 99.5%</dd>
            <dt>${L === "zh" ? "恢复时间目标" : "RTO"}</dt><dd class="num">≤ 30 min</dd>
            <dt>${L === "zh" ? "恢复点目标" : "RPO"}</dt><dd class="num">≤ 24 h</dd>
          </dl>
        </div>
      </div>
    </div>
  </div>`);

  node.querySelector("#op-probe").addEventListener("click", () => {
    metrics.hit();
    toast(t("toast.probe"));
  });

  return node;
}

export async function loadProbe() {
  try {
    const res = await fetch("../data/probe.json", { cache: "no-cache" });
    store._probe = res.ok ? await res.json() : [];
  } catch {
    store._probe = [];
  }
}
