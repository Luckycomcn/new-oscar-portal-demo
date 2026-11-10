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
const csv = downloads.recordToCsv({ ...sample, properties: { ...sample.properties, title: '=1+1' } })
assert.ok(csv.includes('properties.contacts.0.name'))
assert.ok(csv.includes("'=1+1"))
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
