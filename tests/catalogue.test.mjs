import { readFile } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import vm from 'node:vm'
import assert from 'node:assert/strict'
import ts from 'typescript'

// Execute the real TypeScript clients with fetch replaced at the HTTP boundary.
const modules = new Map()
const loading = new Map()
function load(path) {
  if (!loading.has(path)) loading.set(path, createModule(path))
  return loading.get(path)
}
async function createModule(path) {
  const source = await readFile(path, 'utf8')
  let module
  if (path.endsWith('.json')) {
    module = new vm.SyntheticModule(['default'], function () {
      this.setExport('default', JSON.parse(source))
    }, { identifier: path })
  } else {
    const code = ts.transpileModule(source, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
    }).outputText
    module = new vm.SourceTextModule(code, {
      identifier: path,
      initializeImportMeta(meta) { meta.env = {} },
    })
  }
  modules.set(path, module)
  await module.link((specifier) => load(resolve(dirname(path),
    /\.(json|ts)$/.test(specifier) ? specifier : `${specifier}.ts`)))
  return module
}
const entry = await load(resolve('src/api/oscar.ts'))
await entry.evaluate()
const api = modules.get(resolve('src/api/wigos.ts')).namespace
const oscar = entry.namespace
const downloadModule = await load(resolve('src/utils/catalogueDownload.ts'))
await downloadModule.evaluate()
const downloads = downloadModule.namespace
const processModule = await load(resolve('src/api/wmdrProcesses.ts'))
await processModule.evaluate()
const sample = {
  type: 'Feature', id: '0-20000-0-89056',
  geometry: { type: 'Point', coordinates: [10, 20, 5] },
  properties: { title: 'Station', facilityType: { id: 'landFixed' }, contacts: [{ name: 'Operator' }] },
}
let calls = []
globalThis.fetch = async (url, options) => {
  calls.push(String(url))
  if (options.signal.aborted) throw new DOMException('Aborted', 'AbortError')
  return new Response(JSON.stringify(sample), { headers: { 'Content-Type': 'application/geo+json' } })
}
const url = new URL(api.buildItemsUrl({
  limit: 2000, offset: 20, bbox: [1, 2, 3, 4], datetime: '2020-01-01/..',
  filters: { 'territories.territory.id': 'CHE' },
}))
assert.equal(url.searchParams.get('limit'), '1000')
assert.equal(url.searchParams.get('datetime'), '2020-01-01/..')
assert.equal(url.searchParams.get('territories.territory.id'), 'CHE')
assert.equal((await api.searchFacilities({ q: sample.id })).features[0].id, sample.id)
assert.ok(calls[0].includes(`/items/${sample.id}?f=json`))
assert.equal((await api.searchFacilities({ q: sample.id, bbox: [0, 0, 1, 1] })).numberMatched, 0)
const controller = new AbortController()
controller.abort()
await assert.rejects(api.getFeature(sample.id, controller.signal), { name: 'AbortError' })
const blob = await oscar.downloadStationReport(sample.id, 'json')
assert.deepEqual(JSON.parse(await blob.text()), sample)
assert.equal((await oscar.getContact(`${sample.id}#0`)).name, 'Operator')
const report = api.featureToReport({ ...sample, properties: { ...sample.properties,
  territories: [{ territory: { id: 'USA', title: 'United States' }, dates: ['2024-08-09T00:00:00Z', '..'] }],
  observations: [{ observedProperty: { id: '216' }, configurations: [{ time: { interval: ['2024-08-09', '..'] } }] }],
} })
assert.equal(report.territoryAssignments[0].title, 'United States')
assert.equal(report.territoryAssignments[0].from, '2024-08-09T00:00:00Z')
assert.equal(report.territoryAssignments[0].to, '..')
assert.equal(report.observations[0].variableId, 216)
assert.equal(report.observations[0].configurations[0].to, '..')
assert.equal((await downloads.fetchDownloadRecord(sample.id)).id, sample.id)
assert.deepEqual(await downloads.fetchDownloadRecord(sample.id), sample)
api.clearWigosCache()
globalThis.fetch = async () => new Response('<html>not found</html>', { status: 404 })
await assert.rejects(oscar.downloadStationReport('missing', 'json'), /not found/)
await assert.rejects(downloads.fetchDownloadRecord(sample.id), /HTTP 404/)
assert.ok(calls.every((url) => !url.includes('/rest/')))
api.clearWigosCache()
let typeRequests = 0
globalThis.fetch = async (url) => {
  typeRequests++
  const type = new URL(url).searchParams.get('facilityType.id')
  assert.notEqual(type, 'unknown')
  return new Response(JSON.stringify({ features: [], numberMatched: type === 'landFixed' ? 1 : 0, numberReturned: 0 }))
}
assert.equal(await api.getPopulatedFacilityTypeCount(), 1)
assert.ok(typeRequests > 1)
api.clearWigosCache()
globalThis.fetch = async () => new Response('unavailable', { status: 503 })
await assert.rejects(api.getPopulatedFacilityTypeCount(), /503/)
globalThis.fetch = async (url, options) => {
  const body = JSON.parse(options.body)
  assert.equal(options.method, 'POST')
  assert.deepEqual(body.inputs.record, sample)
  assert.equal(body.response, 'raw')
  return new Response(JSON.stringify({ summary: { PASSED: 0, FAILED: 2 }, tests: [] }))
}
const validationResult = await processModule.namespace.executeWmdrProcess('pywmdr-wigos-wmdr2-ets', sample)
assert.equal(validationResult.summary.FAILED, 2)
globalThis.fetch = async () => new Response(JSON.stringify(sample))
assert.equal((await processModule.namespace.executeWmdrProcess('pywmdr-wmdr2-migrate', '<xml/>')).id, sample.id)
globalThis.fetch = async () => new Response('{}', { status: 202 })
await assert.rejects(processModule.namespace.executeWmdrProcess('pywmdr-wigos-wmdr2-ets', sample), /asynchronous/)
console.log('PASS: query parameters, exact ID, bbox, cancellation, GeoJSON export, contacts, 404 handling, no legacy REST calls')


// Map pagination is independent from the table and propagates partial failures.
api.clearWigosCache()
const offsets = []
let lastProgress
const mapSample = (id) => ({ ...sample, id: String(id) })
globalThis.fetch = async (url) => {
  const params = new URL(url).searchParams
  assert.equal(params.get('limit'), '500')
  assert.equal(params.get('bbox'), '-180,-80,180,80')
  assert.equal(params.get('territories.territory.id'), 'CHE')
  const offset = Number(params.get('offset') || 0)
  offsets.push(offset)
  const features = Array.from({ length: offset ? 1 : 500 }, (_, i) => mapSample(offset + i))
  return new Response(JSON.stringify({ features, numberMatched: 501, numberReturned: features.length }))
}
await api.loadMapPages({ bbox: [-180,-80,180,80], territories: ['CHE'] }, (features, total) => { lastProgress = [features.length, total] })
assert.deepEqual(offsets, [0, 500])
assert.deepEqual(lastProgress, [501, 501])
globalThis.fetch = async () => new Response('failure', { status: 503 })
await assert.rejects(api.loadMapPages({}, () => {}), /503/)
const mapCancel = new AbortController()
mapCancel.abort()
await assert.rejects(api.loadMapPages({ signal: mapCancel.signal }, () => {}), { name: 'AbortError' })
globalThis.fetch = async () => new Response(JSON.stringify({ features: [], numberMatched: 3, numberReturned: 0 }))
await assert.rejects(api.loadMapPages({}, () => {}), /Incomplete/)
console.log('PASS: map pages, viewport filters, progress, failure and cancellation')

assert.equal(api.useMapTiles({}), true)
assert.equal(api.useMapTiles({ q: '  ', types: [], territories: [] }), true)
for (const query of [{q:'test'}, {types:['landFixed']}, {programs:['GBON']}, {territories:['CHE']}, {variables:[210]}, {regions:['europe']}]) {
  assert.equal(api.useMapTiles(query), false)
}
assert.ok(api.WIGOS_TILES_URL.endsWith('/tiles/WebMercatorQuad/{z}/{y}/{x}?f=pbf'))
console.log('PASS: unfiltered tiles, every search filter switches to JSON, tile row/column order')

const mapsModule = await load(resolve('src/api/mapFacilities.ts'))
await mapsModule.evaluate()
const maps = mapsModule.namespace
const manifest = JSON.parse(await readFile('src/data/stationOverview.json', 'utf8'))
let pointRequests = 0
globalThis.fetch = async url => {
  pointRequests++
  assert.ok(String(url).startsWith('/data/station-overview/'))
  return new Response(await readFile('public' + url, 'utf8'))
}
let mapProgress
const typeResult = await maps.loadFilteredMap({ types: ['Land (fixed)'], bbox: [-180,-90,180,90] }, (delta, loaded, total) => { mapProgress = [delta.length, loaded, total] })
assert.equal(typeResult.features.length, manifest.pointFiles.landFixed.mapped)
assert.equal(typeResult.snapshotDate, manifest.generatedAt.slice(0,10))
assert.ok(typeResult.features.every(f => f.properties.facilityType.id === 'landFixed' && f.mapSummary))
assert.deepEqual(mapProgress, [manifest.pointFiles.landFixed.mapped,manifest.pointFiles.landFixed.total,manifest.pointFiles.landFixed.total])
await maps.loadFilteredMap({ types: ['landFixed'], bbox: [0,0,10,10] }, () => {})
assert.equal(pointRequests, 1, 'panning must reuse the complete type dataset')
const mixedTypes = await maps.loadFilteredMap({ types: ['landFixed','landMobile'], bbox: [-180,-90,180,90] }, () => {})
assert.equal(mixedTypes.features.length, manifest.pointFiles.landFixed.mapped + manifest.pointFiles.landMobile.mapped)
assert.equal(mixedTypes.unmapped, manifest.pointFiles.landMobile.unmapped)
assert.equal(pointRequests, 2)
console.log('PASS: exact type snapshot completeness, multi-type union and zero-request viewport reuse')

maps.clearMapCache(); api.clearWigosCache()
let active = 0, peak = 0, compactCalls = []
globalThis.fetch = async url => {
  compactCalls.push(String(url)); active++; peak = Math.max(peak, active)
  await new Promise(resolve => setTimeout(resolve, 5)); active--
  const p = new URL(url).searchParams
  assert.equal(p.get('properties'), 'title')
  assert.equal(p.get('limit'), '1000')
  assert.equal(p.get('territories.territory.id'), 'CHE')
  const type = p.get('facilityType.id'), program = p.get('observations.programAffiliations.programAffiliation.id')
  const offset = Number(p.get('offset') || 0)
  const ids = type === 'landFixed'
    ? (offset ? [`land-${program}`] : Array.from({length:1000},(_,i)=>`land-${i}`))
    : ['sea-shared',`sea-${program}`]
  return new Response(JSON.stringify({ features: ids.map(id => ({id,type:'Feature',geometry:{type:'Point',coordinates:[0.2,0.2]},properties:{title:id}})),
    numberMatched: type === 'landFixed' ? (offset ? 1 : 1001) : 2, numberReturned: ids.length }))
}
const combined = { types:['landFixed','seaFixed'], programs:['GBON','GUAN'], territories:['CHE'], bbox:[0,0,1,1] }
const compact = await maps.loadFilteredMap(combined,()=>{})
assert.equal(compact.features.length,1005,'multi-select axes must union all branches and deduplicate overlaps')
assert.equal(compact.features.filter(f=>f.properties.facilityType.id==='landFixed').length,1002)
assert.equal(compactCalls.length,6)
assert.ok(peak<=3)
await maps.loadFilteredMap({...combined,bbox:[0.1,0.1,0.9,0.9]},()=>{})
assert.equal(compactCalls.length,6,'completed regions must satisfy contained viewport queries without HTTP')
console.log('PASS: compact server filtering, OR branches, deduplication, stable pagination target, bounded concurrency and region cache')

maps.clearMapCache(); api.clearWigosCache()
globalThis.fetch=async url=>{
  const offset=Number(new URL(url).searchParams.get('offset')||0)
  return new Response(JSON.stringify({features:offset?[]:Array.from({length:1000},(_,i)=>({...sample,id:String(i)})),numberMatched:1001}))
}
await assert.rejects(maps.loadFilteredMap({q:'test',types:['landFixed']},()=>{}),/Incomplete/)
maps.clearMapCache(); api.clearWigosCache()
globalThis.fetch=async()=>new Response('failure',{status:503})
await assert.rejects(maps.loadFilteredMap({q:'test',types:['landFixed']},()=>{}),/503/)
const cancelMap=new AbortController();cancelMap.abort()
await assert.rejects(maps.loadFilteredMap({types:['landFixed'],signal:cancelMap.signal},()=>{}),{name:'AbortError'})
maps.clearMapCache();api.clearWigosCache()
globalThis.fetch=async url=>String(url).startsWith('/data/')?new Response('missing',{status:404}):new Response(JSON.stringify({features:[sample],numberMatched:1}))
assert.equal((await maps.loadFilteredMap({types:['landFixed']},()=>{})).features.length,1,'missing snapshot must fall back to live compact queries')
globalThis.fetch=async()=>new Response(JSON.stringify(sample))
assert.equal((await maps.loadFilteredMap({q:sample.id,types:['landFixed']},()=>{})).features.length,1)
assert.equal((await maps.loadFilteredMap({q:sample.id,types:['seaFixed']},()=>{})).features.length,0)
console.log('PASS: no truncated completion, failures/cancellation, snapshot fallback and exact-ID combined filters')

maps.clearMapCache(); api.clearWigosCache()
const lateDeltas=[]
globalThis.fetch=async url=>{
  if(String(url).endsWith('/landFixed.json'))return new Response('missing',{status:404})
  if(String(url).endsWith('/landMobile.json')){
    await new Promise(resolve=>setTimeout(resolve,60))
    return new Response(JSON.stringify([['late-snapshot',0.2,0.2]]))
  }
  const type=new URL(url).searchParams.get('facilityType.id')
  return new Response(JSON.stringify({features:[{...sample,id:`live-${type}`}],numberMatched:1}))
}
await maps.loadFilteredMap({types:['landFixed','landMobile']},delta=>lateDeltas.push(...delta.map(f=>f.id)))
await new Promise(resolve=>setTimeout(resolve,90))
assert.ok(lateDeltas.length===2 && lateDeltas.every(id=>id.startsWith('live-')),'abandoned snapshot workers must not emit stale points after live fallback completes')
console.log('PASS: delayed snapshot responses cannot corrupt completed live fallback')
