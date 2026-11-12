import { readFile, writeFile, mkdir, rename } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { PbfWriter } from 'pbf'
import { loadEnv } from 'vite'

// Explicit refresh, never a network dependency of npm run build.
const env = loadEnv('production', process.cwd(), 'VITE_')
const base = (process.env.VITE_WIGOS_GOFC_URL?.trim() || env.VITE_WIGOS_GOFC_URL?.trim() || 'https://wmo-resource-catalogue.labs.wis2dev.io').replace(/\/+$/, '')
const collection = `${base}/collections/wigos-observing-facility-metadata`
const codes = await readFile(new URL('../src/data/wmdrCodes.ts', import.meta.url), 'utf8')
const types = [...codes.matchAll(/\{ id: '([^']+)', title: '[^']*', domain: '([^']+)' \}/g)].map(m => ({ id: m[1], domain: m[2] }))
const cacheDir = new URL('../tmp/overview-source/', import.meta.url)
await mkdir(cacheDir, { recursive: true })
const records = new Map()
const typeStats = {}
let expected = 0, unmapped = 0
async function json(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(60000) })
      if (!res.ok) throw new Error(`${res.status}: ${url}`)
      return await res.json()
    } catch (e) { if (attempt === 2) throw e }
  }
}
async function loadType(type) {
  // Cache complete per-type downloads for resumable generation, use --refresh to renew.
  const sourceKey = createHash('sha256').update(collection).digest('hex').slice(0, 8)
  const file = new URL(`${sourceKey}-${type.id}.json`, cacheDir)
  let features, total
  if (!process.argv.includes('--refresh')) {
    try { ({ features, total } = JSON.parse(await readFile(file, 'utf8'))) } catch {}
  }
  if (!features) {
    const countUrl = `${collection}/items?${new URLSearchParams({ f: 'json', limit: '1', properties: 'title', 'facilityType.id': type.id })}`
    total = (await json(countUrl)).numberMatched
    if (!Number.isInteger(total)) throw new Error(`Invalid total for ${type.id}`)
    features = []; let offset = 0
    do {
      const params = new URLSearchParams({ f: 'json', limit: '1000', offset: String(offset), properties: 'title', sortby: 'title', 'facilityType.id': type.id })
      const page = await json(`${collection}/items?${params}`)
      // This upstream reports a lower-bound numberMatched on deep pages (e.g. 11000).
      // Use the independent count request, then verify it again after pagination.
      if (!page.features?.length && offset < total) throw new Error(`Incomplete ${type.id} at ${offset}/${total}`)
      features.push(...page.features); offset += page.features.length
      if (offset % 5000 === 0) console.log(`${type.id}: ${offset}/${total}`)
    } while (offset < total)
    if ((await json(countUrl)).numberMatched !== total) throw new Error(`Catalogue changed while reading ${type.id}; retry refresh`)
    if (features.length !== total || new Set(features.map(f => f.id)).size !== total) throw new Error(`Pagination mismatch: ${type.id}`)
    await writeFile(file, JSON.stringify({ features, total }))
  }
  if (!Number.isInteger(total) || features.length !== total || new Set(features.map(f => f.id)).size !== total) throw new Error(`Invalid cached pagination: ${type.id}`)
  expected += total
  let missing = 0
  for (const f of features) {
    const c = f.geometry?.coordinates
    if (f.geometry?.type !== 'Point' || !c || !Number.isFinite(c[0]) || !Number.isFinite(c[1]) || Math.abs(c[0]) > 180 || Math.abs(c[1]) > 90) { unmapped++; missing++; continue }
    if (records.has(f.id)) throw new Error(`Duplicate facility ${f.id}`)
    const lat = Math.max(-85.05112878, Math.min(85.05112878, c[1])) * Math.PI / 180
    records.set(f.id, { id: f.id, type: type.id, domain: type.domain, lon: c[0], lat: c[1], x: (c[0] + 180) / 360, y: (1 - Math.log(Math.tan(Math.PI / 4 + lat / 2)) / Math.PI) / 2 })
  }
  typeStats[type.id] = { total, mapped: total - missing, unmapped: missing }
  console.log(`${type.id}: ${total}`)
}
// Keep upstream load bounded.
for (let i = 0; i < types.length; i += 3) await Promise.all(types.slice(i, i + 3).map(loadType))
const all = await json(`${collection}/items?f=json&limit=1&properties=title`)
if (expected !== all.numberMatched) throw new Error(`Type coverage ${expected} differs from catalogue ${all.numberMatched}; refusing to publish partial overview`)
const points = [...records.values()].sort((a,b) => a.id.localeCompare(b.id))
if (points.length + unmapped !== expected) throw new Error('Overview accounting mismatch')
const version = createHash('sha256').update('overview-v4-exact-type-points').update(JSON.stringify(points)).update(JSON.stringify(types.map(t => typeStats[t.id]))).digest('hex').slice(0, 16)
const root = new URL(`../public/data/station-overview/${version}/`, import.meta.url)
const maxZoom = 5, extent = 4096
let bytes = 0, tileCount = 0
function tile(items) {
  const keys = ['id', 'properties.facilityType.id', 'count']
  const values = [], index = new Map()
  const valueIndex = v => {const key = `${typeof v}:${v}`; if (!index.has(key)) { index.set(key, values.length); values.push(v) } return index.get(key)}
  const features = items.map(p => ({ ...p, tags: [0, valueIndex(p.id), 1, valueIndex(p.type), 2, valueIndex(p.count)] }))
  const out = new PbfWriter()
  out.writeMessage(3, (_, p) => {
    p.writeStringField(1, 'hits')
    for (const f of features) p.writeMessage(2, (f, w) => {
      w.writePackedVarint(2, f.tags); w.writeVarintField(3, 1)
      const zigzag = n => n < 0 ? -n * 2 - 1 : n * 2
      w.writePackedVarint(4, [9, zigzag(f.px), zigzag(f.py)])
    }, f)
    for (const key of keys) p.writeStringField(3, key)
    for (const value of values) p.writeMessage(4, (value, w) => {
      if (typeof value === 'number') w.writeVarintField(5, value)
      else w.writeStringField(1, value)
    }, value)
    p.writeVarintField(5, extent); p.writeVarintField(15, 2)
  }, null)
  return out.finish()
}
for (let z = 0; z <= maxZoom; z++) {
  const n = 2 ** z, tiles = new Map()
  for (const point of points) {
    const x = Math.max(0, Math.min(n - 1, Math.floor(point.x * n)))
    const y = Math.max(0, Math.min(n - 1, Math.floor(point.y * n)))
    const px = Math.round((point.x * n - x) * extent), py = Math.round((point.y * n - y) * extent)
    const key = `${x}/${y}`; if (!tiles.has(key)) tiles.set(key, new Map())
    // Coarser global overview avoids repeatedly drawing thousands of overlapping
    // symbols while basemap tiles arrive. Regional views retain finer detail.
    const cellSize = z <= 2 ? 128 : 64 // 16px globally; 8px regionally (512px tiles).
    const cell = `${Math.floor(px / cellSize)},${Math.floor(py / cellSize)},${point.domain}`
    const old = tiles.get(key).get(cell)
    if (old) old.count++
    else tiles.get(key).set(cell, { ...point, px, py, count: 1 })
  }
  for (let x = 0; x < n; x++) {
    await mkdir(new URL(`${z}/${x}/`, root), { recursive: true })
    for (let y = 0; y < n; y++) {
      const data = tile([...(tiles.get(`${x}/${y}`)?.values() ?? [])])
      await writeFile(new URL(`${z}/${x}/${y}.pbf`, root), data)
      bytes += data.length; tileCount++
    }
  }
}
await mkdir(new URL('points/', root), { recursive: true })
const pointFiles = {}
for (const type of types) {
  // Unlike the overview representatives, these retain EVERY valid station per
  // exact type, so filtering does not lose minority types inside colour cells.
  const rows = points.filter(p => p.type === type.id).map(p => [p.id, Number(p.lon.toFixed(6)), Number(p.lat.toFixed(6))])
  await writeFile(new URL(`points/${type.id}.json`, root), JSON.stringify(rows))
  pointFiles[type.id] = { ...typeStats[type.id], path: `data/station-overview/${version}/points/${type.id}.json` }
}
const manifest = { version, generatedAt: new Date().toISOString(), source: collection, total: expected, mapped: points.length, unmapped, maxZoom, tileSize: 512, path: `data/station-overview/${version}/{z}/{x}/{y}.pbf`, tileCount, bytes, pointFiles }
const manifestFile = new URL('../src/data/stationOverview.json', import.meta.url)
await writeFile(new URL('../src/data/stationOverview.json.tmp', import.meta.url), JSON.stringify(manifest, null, 2) + '\n')
await rename(new URL('../src/data/stationOverview.json.tmp', import.meta.url), manifestFile)
console.log(JSON.stringify(manifest, null, 2))
