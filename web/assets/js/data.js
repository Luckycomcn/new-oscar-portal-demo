/* 数据层：载入本地缓存的目录数据，构造检索索引与分面，按需加载详情分片。
   对应架构中的"只读缓存 + 规范化记录索引"：站点级数据全部来自缓存，不产生任何写操作。 */

import { metrics } from "./util.js";

const BASE = "../data";

export const store = {
  meta: null,
  overview: null,
  stations: [],
  reference: null,
  basemap: null,
  shardIndex: {},
  enrich: {},
  byId: new Map(),
  facets: null,
  _shards: new Map(),
  _pending: new Map(),
};

async function getJSON(path) {
  const res = await fetch(path, { cache: "no-cache" });
  if (!res.ok) throw new Error(`${path} -> HTTP ${res.status}`);
  return res.json();
}

export async function loadAll() {
  const [meta, overview, stations, reference, basemap, shardIndex, enrich] = await Promise.all([
    getJSON(`${BASE}/meta.json`),
    getJSON(`${BASE}/overview.json`),
    getJSON(`${BASE}/stations.json`),
    getJSON(`${BASE}/reference.json`),
    getJSON(`${BASE}/basemap.json`),
    getJSON(`${BASE}/details/index.json`),
    getJSON(`${BASE}/enrich.json`),
  ]);
  Object.assign(store, { meta, overview, stations, reference, basemap, shardIndex, enrich });
  store.byId = new Map(stations.map((s) => [String(s.id), s]));
  store.facets = buildFacets(stations, reference, enrich);
  return store;
}

function buildFacets(stations, reference, enrich) {
  const countBy = (fn) => {
    const m = new Map();
    for (const s of stations) {
      const k = fn(s);
      if (!k) continue;
      m.set(k, (m.get(k) || 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };
  const programs = new Map();
  for (const s of stations) {
    for (const p of s.prog || []) {
      if (!p.n) continue;
      programs.set(p.n, (programs.get(p.n) || 0) + 1);
    }
  }
  const classes = new Map();
  const variables = new Map();
  for (const [id, e] of Object.entries(enrich || {})) {
    if (e.c) classes.set(e.c, (classes.get(e.c) || 0) + 1);
    for (const v of e.v || []) variables.set(v, (variables.get(v) || 0) + 1);
  }
  const sorted = (m) => [...m.entries()].sort((a, b) => b[1] - a[1]);
  return {
    types: countBy((s) => s.type),
    classes: sorted(classes),
    regions: countBy((s) => s.ra),
    territories: countBy((s) => s.terr),
    declared: countBy((s) => s.decl),
    assessed: countBy((s) => s.ass),
    programs: [...programs.entries()].sort((a, b) => b[1] - a[1]),
    programNames: [...programs.keys()].sort(),
    variables: sorted(variables),
    variableCount: variables.size,
    refLists: (reference && reference.lists) || {},
    programTree: (reference && reference.programTree) || [],
    variableTree: (reference && reference.variableTree) || [],
  };
}

/* -------------------------------------------------------------- 详情分片按需加载 */

export async function getDetail(id) {
  const key = String(id);
  if (store._shards.has(key)) return store._shards.get(key);
  if (store._pending.has(key)) return store._pending.get(key);

  const shard = store.shardIndex[key];
  if (!shard) return null;

  const task = (async () => {
    try {
      const data = await getJSON(`${BASE}/details/${shard}`);
      metrics.miss();
      for (const [k, v] of Object.entries(data)) store._shards.set(k, v);
      return store._shards.get(key) || null;
    } catch (err) {
      metrics.fail();
      return null;
    } finally {
      store._pending.delete(key);
    }
  })();
  store._pending.set(key, task);
  return task;
}

export function peekDetail(id) {
  return store._shards.get(String(id)) || null;
}

/* -------------------------------------------------------------- 检索 */

export const EMPTY_CRITERIA = {
  q: "",
  match: "all",
  types: [],
  classes: [],
  programs: [],
  variables: [],
  regions: [],
  territories: [],
  declared: [],
  assessed: [],
  gbon: false,
  bbox: null,
  sort: "name",
  page: 1,
  size: 25,
};

export function criteriaFromParams(params) {
  const c = { ...EMPTY_CRITERIA };
  const list = (v) => (v ? String(v).split("|").filter(Boolean) : []);
  c.q = params.q || "";
  c.match = params.match === "any" ? "any" : "all";
  c.types = list(params.types);
  c.classes = list(params.classes);
  c.programs = list(params.programs);
  c.variables = list(params.variables);
  c.regions = list(params.regions);
  c.territories = list(params.territories);
  c.declared = list(params.declared);
  c.assessed = list(params.assessed);
  c.gbon = params.gbon === "1";
  if (params.bbox) {
    const n = params.bbox.split(",").map(Number);
    if (n.length === 4 && n.every((x) => Number.isFinite(x))) c.bbox = n;
  }
  c.sort = params.sort || "name";
  c.page = Math.max(1, Number(params.page) || 1);
  c.size = Number(params.size) || 25;
  return c;
}

export function criteriaToParams(c) {
  return {
    q: c.q,
    match: c.match === "any" ? "any" : "",
    types: c.types,
    classes: c.classes,
    programs: c.programs,
    variables: c.variables,
    regions: c.regions,
    territories: c.territories,
    declared: c.declared,
    assessed: c.assessed,
    gbon: c.gbon ? "1" : "",
    bbox: c.bbox ? c.bbox.map((n) => n.toFixed(3)).join(",") : "",
    sort: c.sort === "name" ? "" : c.sort,
    page: c.page > 1 ? String(c.page) : "",
    size: c.size !== 25 ? String(c.size) : "",
  };
}

export function activeCriteriaCount(c) {
  let n = 0;
  if (c.q) n += 1;
  n += c.types.length + c.classes.length + c.programs.length + c.variables.length
    + c.regions.length + c.territories.length + c.declared.length + c.assessed.length;
  if (c.gbon) n += 1;
  if (c.bbox) n += 1;
  return n;
}

/** 在缓存索引上执行检索；返回结果数组（含耗时记录，供运行度量使用） */
export function search(criteria) {
  const t0 = performance.now();
  const c = { ...EMPTY_CRITERIA, ...criteria };
  const q = c.q.trim().toLowerCase();
  const has = (v, arr) => !arr.length || arr.includes(v);

  let rows = store.stations.filter((s) => {
    const checks = [];
    if (q) {
      const name = (s.name || "").toLowerCase();
      const wid = (s.wigos || "").toLowerCase();
      const terr = (s.terr || "").toLowerCase();
      checks.push(name.includes(q) || wid.includes(q) || terr.includes(q));
    }
    const e = store.enrich[String(s.id)] || {};
    checks.push(has(s.type, c.types));
    checks.push(has(e.c || s.cls, c.classes));
    checks.push(has(s.ra, c.regions));
    checks.push(has(s.terr, c.territories));
    checks.push(has(s.decl, c.declared));
    checks.push(has(s.ass, c.assessed));

    if (c.programs.length) {
      const names = new Set((s.prog || []).map((p) => p.n));
      checks.push(c.programs.some((p) => names.has(p)));
    }
    if (c.variables.length) {
      const vars = new Set(e.v || []);
      checks.push(c.variables.some((v) => vars.has(v)));
    }
    if (c.gbon) {
      checks.push((s.prog || []).some((p) => p.n === "GBON" && p.d === "Operational"));
    }
    if (c.bbox) {
      const [minLon, minLat, maxLon, maxLat] = c.bbox;
      checks.push(s.lat != null && s.lon != null
        && s.lon >= minLon && s.lon <= maxLon && s.lat >= minLat && s.lat <= maxLat);
    }
    return c.match === "any" ? checks.some(Boolean) : checks.every(Boolean);
  });

  const dir = c.sort.startsWith("-") ? -1 : 1;
  const key = c.sort.replace(/^-/, "");
  const value = (s) => (key === "name" ? (s.name || "").toLowerCase()
    : key === "wigos" ? (s.wigos || "")
      : key === "terr" ? (s.terr || "")
        : key === "type" ? (s.type || "")
          : key === "status" ? (s.decl || "") : 0);
  rows.sort((a, b) => {
    const va = value(a), vb = value(b);
    return va < vb ? -dir : va > vb ? dir : 0;
  });

  metrics.record(performance.now() - t0);
  return rows;
}

export function paginate(rows, page, size) {
  const start = (page - 1) * size;
  return { page: rows.slice(start, start + size), total: rows.length, pages: Math.max(1, Math.ceil(rows.length / size)) };
}

/** 邻近站点：同类型、距离最近（用于详情页多站同屏） */
export function nearby(station, n = 5) {
  if (!station || station.lat == null) return [];
  const d2 = (a, b) => (a.lat - b.lat) ** 2 + ((a.lon - b.lon) ** 2);
  return store.stations
    .filter((s) => s.id !== station.id && s.lat != null)
    .map((s) => ({ s, d: d2(s, station) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, n)
    .map((x) => x.s);
}
