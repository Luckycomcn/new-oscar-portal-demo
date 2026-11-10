/* 标注层（?anno=<集合名>）：在页面上叠加编号框与图内说明，供技术方案插图使用。
   标注目标用 CSS 选择器定位，渲染后按实际位置绘制，随字号与布局自动跟随。 */

const SETS = {
  overview: [
    { n: 1, sel: "#ov-kpi", label: "全球规模指标：全量索引 62 134 条、本地只读缓存 2 000 条，口径分别标注" },
    { n: 2, sel: "#ov-arch", label: "三组件读写域：节点为唯一写入口，目录与门户只读" },
    { n: 3, sel: "#ov-dist", label: "按 WMO 区域、站点类型、计划网络与申报状态的分布" },
    { n: 4, sel: "#ov-mvp", label: "MVP 二十二项功能需求的门户参与方式逐项对照" },
  ],
  search: [
    { n: 1, sel: "#se-filters", label: "条件面板：关键词与 WIGOS 标识符直达、AND/OR 组合" },
    { n: 2, sel: "#se-filters .field:nth-of-type(4)", label: "站点类型分面，括号内为命中计数" },
    { n: 3, sel: "#se-filters .field:nth-of-type(5)", label: "站点分级（源自完整记录，独立派生索引）" },
    { n: 4, sel: "#se-filters .field:nth-of-type(6)", label: "计划 / 网络隶属多选" },
    { n: 5, sel: "#se-active", label: "已启用条件摘要，随地址栏序列化，可分享复现" },
    { n: 6, sel: "#se-table", label: "结果列表：支持排序与分页，行内显示 WIGOS 标识、坐标与状态" },
  ],
  map: [
    { n: 1, sel: "#mp-canvas", label: "Web 墨卡托投影底图，境界要素独立管理，底图按访问来源分域配置" },
    { n: 2, sel: "#mp-legend", label: "图例：按站点类型着色，虚线框为框选检索范围" },
    { n: 3, sel: "#mp-toolbar", label: "底图与着色维度切换、框选模式、视窗计数" },
  ],
  station: [
    { n: 1, sel: "#st-head", label: "记录头：WIGOS 标识、类型、站点分级与运行 / 评估状态" },
    { n: 2, sel: "#st-id", label: "标识要素（3-03、3-06）" },
    { n: 3, sel: "#st-loc", label: "位置要素（3-07）：坐标、海拔、气压表高度、定位方法与历史位置" },
    { n: 4, sel: "#st-prog", label: "计划与网络隶属（2-02）：审批、申报与评估状态及评估中心" },
    { n: 5, sel: "#st-obs", label: "观测要素（1-01、1-04）：变量、几何与所属计划" },
    { n: 6, sel: "#st-cov", label: "必备要素覆盖度校验（F-9、F-20），缺失项显式标注" },
  ],
  export: [
    { n: 1, sel: "#ex-bulk", label: "结果集批量导出 CSV / JSON，字段可选必备要素集" },
    { n: 2, sel: "#ex-wmdr", label: "单条记录 WMDR V2（JSON）下载，V1（XML）仅导入" },
    { n: 3, sel: "#ex-m2m", label: "机器用户取数指南：业务接口由目录按 OGC API - Records 提供" },
  ],
  ops: [
    { n: 1, sel: "#op-ep", label: "多目录端点与健康探测，实测时延作为切换阈值基线" },
    { n: 2, sel: "#op-cache", label: "只读缓存与周期对账：缓存可由目录重建" },
    { n: 3, sel: "#op-metrics", label: "浏览器端实测度量，生产替换为 OpenMetrics + Prometheus" },
    { n: 4, sel: "#op-nf", label: "非功能需求 NF-1 ~ NF-7 逐项落实情况" },
  ],
};

let current = null;
let showNotes = false;

function clear() {
  if (current) { current.remove(); current = null; }
}

function draw(setName) {
  clear();
  const items = SETS[setName];
  if (!items) return;
  const layer = document.createElement("div");
  layer.className = "anno-layer";
  document.body.appendChild(layer);

  for (const it of items) {
    const target = document.querySelector(it.sel);
    if (!target) continue;
    const r = target.getBoundingClientRect();
    if (!r.width || !r.height) continue;

    const box = document.createElement("div");
    box.className = "anno-box";
    box.style.left = `${r.left - 3}px`;
    box.style.top = `${r.top - 3}px`;
    box.style.width = `${r.width + 6}px`;
    box.style.height = `${r.height + 6}px`;
    layer.appendChild(box);

    const badge = document.createElement("div");
    badge.className = "anno-badge";
    badge.textContent = it.n;
    badge.style.left = `${Math.max(2, r.left - 15)}px`;
    badge.style.top = `${Math.max(2, r.top - 15)}px`;
    layer.appendChild(badge);

    if (!showNotes) continue;
    const note = document.createElement("div");
    note.className = "anno-note";
    note.textContent = `${it.n}　${it.label}`;
    note.style.left = `${Math.min(r.left + 4, window.innerWidth - 350)}px`;
    note.style.top = `${r.width < 520 ? r.bottom + 8 : Math.max(4, r.top + 4)}px`;
    layer.appendChild(note);
  }
  current = layer;
}

export function applyAnno(name) {
  if (!name || !SETS[name]) { clear(); return; }
  requestAnimationFrame(() => requestAnimationFrame(() => draw(name)));
}

export function setNotes(on) { showNotes = !!on; }

export const ANNO_SETS = Object.keys(SETS);
