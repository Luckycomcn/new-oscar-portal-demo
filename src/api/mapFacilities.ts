import overview from '../data/stationOverview.json'
import { facilityTypes } from '../data/wmdrCodes'
import {
  WIGOS_COLLECTION_URL, buildItemsUrl, queryFeatures, searchFacilities,
  resolveFacilityTypeId, resolveProgramId, resolveTerritoryId, resolveRegionId,
  type WigosFeature, type WigosBbox, type WigosItemsQuery, type WigosFeatureCollection, type FacilitySearchParams,
} from './wigos'

type PointRow = [id: string, lon: number, lat: number]
export interface FilteredMapResult {
  features: WigosFeature[]
  snapshotDate?: string
  unmapped: number
}
export type MapProgress = (delta: WigosFeature[], loaded: number, total: number) => void
const snapshots = new Map<string, Promise<PointRow[]>>()
const pageCache = new Map<string, { expires: number; value: WigosFeatureCollection }>()
const regionCache: { key: string; bbox?: WigosBbox; expires: number; result: FilteredMapResult }[] = []
const TTL = 3 * 60 * 1000

export function clearMapCache() { snapshots.clear(); pageCache.clear(); regionCache.length = 0 }
function abortCheck(signal?: AbortSignal) { signal?.throwIfAborted() }
function abortable<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  abortCheck(signal)
  if (!signal) return promise
  return new Promise((resolve, reject) => {
    const aborted = () => { cleanup(); reject(signal.reason) }
    const cleanup = () => signal.removeEventListener('abort', aborted)
    signal.addEventListener('abort', aborted, { once: true })
    promise.then(v => { cleanup(); resolve(v) }, e => { cleanup(); reject(e) })
  })
}
function values(input: string[] | undefined, resolve: (v: string) => string | undefined): string[] {
  return [...new Set((input ?? []).filter(Boolean).map(v => {
    const id = resolve(v)
    if (!id) throw new Error(`Unsupported map filter: ${v}`)
    return id
  }))].sort()
}
function inBbox(feature: WigosFeature, bbox?: WigosBbox) {
  const c = feature.geometry?.coordinates
  return feature.geometry?.type === 'Point' && c && Number.isFinite(c[0]) && Number.isFinite(c[1]) && Math.abs(c[0]!) <= 180 && Math.abs(c[1]!) <= 90 &&
    (!bbox || (c[0]! >= bbox[0] && c[0]! <= bbox[2] && c[1]! >= bbox[1] && c[1]! <= bbox[3]))
}
async function pool<T>(items: T[], job: (item: T) => Promise<void>, signal?: AbortSignal) {
  let next = 0
  await Promise.all(Array.from({ length: Math.min(3, items.length) }, async () => {
    while (next < items.length) { abortCheck(signal); await job(items[next++]!) }
  }))
}
async function pointRows(type: string, signal?: AbortSignal) {
  const entry = overview.pointFiles[type as keyof typeof overview.pointFiles]
  if (!entry) throw new Error(`Snapshot does not cover facility type ${type}`)
  const url = `${import.meta.env.BASE_URL ?? '/'}${entry.path}`
  let promise = snapshots.get(url)
  if (!promise) {
    promise = (async () => {
      const res = await fetch(url, { signal: AbortSignal.timeout(20000) })
      if (!res.ok) throw new Error(`Station overview HTTP ${res.status}`)
      const rows: PointRow[] = await res.json()
      if (!Array.isArray(rows) || rows.length !== entry.mapped || new Set(rows.map(r => r[0])).size !== rows.length ||
        rows.some(r => !Array.isArray(r) || typeof r[0] !== 'string' || !Number.isFinite(r[1]) || !Number.isFinite(r[2]) || Math.abs(r[1]) > 180 || Math.abs(r[2]) > 90)) throw new Error('Incomplete station overview')
      return rows
    })().catch(e => { snapshots.delete(url); throw e })
    snapshots.set(url, promise)
  }
  return abortable(promise, signal)
}
export function canUseTypeSnapshot(query: FacilitySearchParams) {
  return overview.source === WIGOS_COLLECTION_URL && !!query.types?.length && !query.q?.trim() &&
    ![query.programs, query.territories, query.variables, query.regions].some(v => v?.length)
}
async function typeSnapshot(query: FacilitySearchParams, progress: MapProgress): Promise<FilteredMapResult> {
  const types = values(query.types, resolveFacilityTypeId)
  const features: WigosFeature[] = []
  let loaded = 0, total = 0, unmapped = 0
  let failed = false
  for (const type of types) {
    const stats = overview.pointFiles[type as keyof typeof overview.pointFiles]
    if (!stats) throw new Error(`Snapshot does not cover facility type ${type}`)
    total += stats.total; unmapped += stats.unmapped
  }
  await pool(types, async type => {
    if (failed) return
    let rows: PointRow[]
    try { rows = await pointRows(type, query.signal) }
    catch (e) { failed = true; throw e }
    if (failed) return
    abortCheck(query.signal)
    const delta: WigosFeature[] = []
    for (const [id, lon, lat] of rows) {
      const box = query.bbox
      if (box && (lon < box[0] || lon > box[2] || lat < box[1] || lat > box[3])) continue
      delta.push({ id, type: 'Feature', geometry: { type: 'Point', coordinates: [lon, lat] },
        properties: { title: id, facilityType: { id: type } }, mapSummary: true })
    }
    features.push(...delta)
    loaded += overview.pointFiles[type as keyof typeof overview.pointFiles].total
    progress(delta, loaded, total)
  }, query.signal)
  return { features, snapshotDate: overview.generatedAt.slice(0, 10), unmapped }
}

// Completed pages survive caller cancellation; partial/in-flight failures do not
// become cache hits, and page memory is bounded. No full WMDR records are fetched.
async function compactPage(query: WigosItemsQuery) {
  abortCheck(query.signal)
  const key = buildItemsUrl(query)
  const cached = pageCache.get(key)
  if (cached && cached.expires > Date.now()) return cached.value
  const value = await queryFeatures({ ...query, timeoutMs: 40000 })
  abortCheck(query.signal)
  pageCache.delete(key); pageCache.set(key, { value, expires: Date.now() + TTL })
  while (pageCache.size > 100) pageCache.delete(pageCache.keys().next().value!)
  return value
}
function coverage(bbox?: WigosBbox): WigosBbox | undefined {
  if (!bbox) return undefined
  const step = Math.min(10, Math.max(0.05, 2 ** Math.floor(Math.log2(Math.max(bbox[2] - bbox[0], bbox[3] - bbox[1]) / 4))))
  return [Math.max(-180, Math.floor(bbox[0] / step) * step), Math.max(-90, Math.floor(bbox[1] / step) * step),
    Math.min(180, Math.ceil(bbox[2] / step) * step), Math.min(90, Math.ceil(bbox[3] / step) * step)]
}
function contains(outer: WigosBbox | undefined, inner: WigosBbox | undefined) {
  return !outer || (!!inner && outer[0] <= inner[0] && outer[1] <= inner[1] && outer[2] >= inner[2] && outer[3] >= inner[3])
}
async function liveMap(query: FacilitySearchParams, progress: MapProgress): Promise<FilteredMapResult> {
  // The server omits nested fields from compact responses. Partition by exact
  // type so every returned point still has its correct type/colour, even when
  // the record is new and absent from the static snapshot.
  const typeIds = query.types?.length ? values(query.types, resolveFacilityTypeId) : facilityTypes.map(t => t.id)
  const axes: [string, string[]][] = [
    ['facilityType.id', typeIds],
    ['observations.programAffiliations.programAffiliation.id', values(query.programs, resolveProgramId)],
    ['territories.territory.id', values(query.territories, resolveTerritoryId)],
    ['observations.observedProperty.id', [...new Set((query.variables ?? []).map(String))].sort()],
    ['wmoRegion.id', values(query.regions, resolveRegionId)],
  ]
  const key = JSON.stringify([WIGOS_COLLECTION_URL, query.q?.trim() ?? '', axes])
  const cached = regionCache.find(c => c.key === key && c.expires > Date.now() && contains(c.bbox, query.bbox))
  if (cached) {
    const features = cached.result.features.filter(f => inBbox(f, query.bbox))
    progress(features, features.length, features.length)
    return { ...cached.result, features }
  }
  let branches: Record<string, string>[] = [{}]
  for (const [field, ids] of axes) if (ids.length) branches = branches.flatMap(b => ids.map(id => ({ ...b, [field]: id })))
  const box = coverage(query.bbox)
  const found = new Map<string, WigosFeature>()
  let loaded = 0, total = 0
  const missing = new Set<string>()
  await pool(branches, async filters => {
    const base: WigosItemsQuery = { bbox: box, q: query.q, filters, properties: ['title'], sortby: 'title', signal: query.signal }
    const first = await compactPage({ ...base, limit: 1000 })
    const expected = first.numberMatched
    if (!Number.isInteger(expected) || expected < 0) throw new Error('Invalid catalogue map count')
    total += expected
    let offset = 0
    const ids = new Set<string>()
    let page = first
    do {
      abortCheck(query.signal)
      if (!page.features.length && offset < expected) throw new Error('Incomplete catalogue pagination')
      const delta: WigosFeature[] = []
      for (const f of page.features) {
        if (ids.has(f.id)) throw new Error('Catalogue pagination changed; retry to avoid missing stations')
        ids.add(f.id)
        if (!inBbox(f)) { missing.add(f.id); continue }
        if (!found.has(f.id)) {
          const feature = { ...f, properties: { title: f.properties.title, facilityType: { id: filters['facilityType.id']! } }, mapSummary: true }
          found.set(f.id, feature)
          if (inBbox(feature, query.bbox)) delta.push(feature)
        }
      }
      offset += page.features.length; loaded += page.features.length
      progress(delta, loaded, total)
      // Deep pages may report approximate numberMatched; never replace the
      // first-page target or stop before all expected records have arrived.
      if (offset < expected) page = await compactPage({ ...base, limit: 1000, offset })
    } while (offset < expected)
    if (offset !== expected || ids.size !== expected) throw new Error('Incomplete catalogue pagination')
  }, query.signal)
  abortCheck(query.signal)
  const result: FilteredMapResult = { features: [...found.values()], unmapped: missing.size }
  regionCache.unshift({ key, bbox: box, expires: Date.now() + TTL, result })
  while (regionCache.length > 12 || regionCache.reduce((sum, c) => sum + c.result.features.length, 0) > 150000) regionCache.pop()
  return { ...result, features: result.features.filter(f => inBbox(f, query.bbox)) }
}

async function load(query: FacilitySearchParams, progress: MapProgress): Promise<FilteredMapResult> {
  abortCheck(query.signal)
  if (canUseTypeSnapshot(query)) {
    try { return await typeSnapshot(query, progress) }
    catch { abortCheck(query.signal); return liveMap(query, progress) }
  }
  if (query.q?.trim() && /^\d+-\d+-\d+-\S+$/.test(query.q.trim())) {
    const result = await searchFacilities({ ...query, limit: 1, offset: 0 })
    progress(result.features, result.features.length, result.numberMatched)
    return { features: result.features, unmapped: 0 }
  }
  return liveMap(query, progress)
}

export async function loadFilteredMap(query: FacilitySearchParams, progress: MapProgress): Promise<FilteredMapResult> {
  abortCheck(query.signal)
  const controller = new AbortController()
  const forward = () => controller.abort(query.signal?.reason)
  query.signal?.addEventListener('abort', forward, { once: true })
  try { return await load({ ...query, signal: controller.signal }, progress) }
  catch (e) { controller.abort(e); throw e }
  finally { query.signal?.removeEventListener('abort', forward) }
}
