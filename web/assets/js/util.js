/* 通用工具：DOM、格式化、导出、度量采集 */

export function esc(v) {
  if (v == null) return "";
  return String(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export function el(html) {
  const tpl = document.createElement("template");
  tpl.innerHTML = html.trim();
  return tpl.content.firstElementChild;
}

export function fmtNum(n) {
  if (n == null || Number.isNaN(n)) return "—";
  return Number(n).toLocaleString("en-US");
}

export function fmtCoord(lat, lon) {
  if (lat == null || lon == null) return "—";
  const ns = lat >= 0 ? "N" : "S";
  const ew = lon >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(3)}°${ns}, ${Math.abs(lon).toFixed(3)}°${ew}`;
}

export function fmtDate(s) {
  if (!s) return "—";
  return String(s).slice(0, 10);
}

export function debounce(fn, ms = 260) {
  let timer;
  return (...a) => { clearTimeout(timer); timer = setTimeout(() => fn(...a), ms); };
}

let toastTimer;
export function toast(msg) {
  const node = document.getElementById("toast");
  if (!node) return;
  node.textContent = msg;
  node.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { node.hidden = true; }, 2200);
}

export function download(filename, text, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function toCSV(rows, headers) {
  const cell = (v) => {
    if (v == null) return "";
    const s = String(v).replace(/"/g, '""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
  };
  const head = headers.map((h) => cell(h.label)).join(",");
  const body = rows.map((r) => headers.map((h) => cell(h.get(r))).join(",")).join("\n");
  return `${head}\n${body}\n`;
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/* -------------------------------------------------------------- 运行度量采集 */
/* 仅采集浏览器端可观测的量：检索次数、耗时分位、缓存命中、错误数（NF-6） */

export const metrics = {
  queries: 0,
  durations: [],
  cacheHits: 0,
  cacheMiss: 0,
  errors: 0,
  record(ms) {
    this.queries += 1;
    this.durations.push(ms);
    if (this.durations.length > 300) this.durations.shift();
  },
  hit() { this.cacheHits += 1; },
  miss() { this.cacheMiss += 1; },
  fail() { this.errors += 1; },
  summary() {
    const d = [...this.durations].sort((a, b) => a - b);
    const avg = d.length ? d.reduce((a, b) => a + b, 0) / d.length : 0;
    const p95 = d.length ? d[Math.min(d.length - 1, Math.floor(d.length * 0.95))] : 0;
    const total = this.cacheHits + this.cacheMiss;
    return {
      queries: this.queries,
      avg,
      p95,
      hitRatio: total ? this.cacheHits / total : 1,
      errors: this.errors,
    };
  },
};

/* -------------------------------------------------------------- URL 查询串 */

export function parseHash() {
  const raw = location.hash.replace(/^#\/?/, "");
  const [path, query = ""] = raw.split("?");
  const params = Object.fromEntries(new URLSearchParams(query));
  const segs = path.split("/").filter(Boolean);
  return { route: segs[0] || "overview", id: segs[1] || null, params };
}

export function buildHash(route, id, params) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params || {})) {
    if (v == null || v === "" || (Array.isArray(v) && !v.length)) continue;
    q.set(k, Array.isArray(v) ? v.join("|") : v);
  }
  const base = id ? `#/${route}/${id}` : `#/${route}`;
  const qs = q.toString();
  return qs ? `${base}?${qs}` : base;
}
