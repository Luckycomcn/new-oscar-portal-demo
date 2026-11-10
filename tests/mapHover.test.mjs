import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import ts from 'typescript'
const source = await readFile('src/components/OscarMap.vue', 'utf8')
const start = source.indexOf('function onPointerMove(')
const end = source.indexOf('\nfunction clampPopup', start)
const code = ts.transpileModule(source.slice(start, end), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
const ref = value => ({ value })
let callback, requested, resolveDetail
const hit = { get: key => ({ id: '0-test', 'properties.title': 'Tile station', 'properties.facilityType.id': 'landFixed' })[key] }
const context = {
  mapRef: ref({ forEachFeatureAtPixel(pixel, visit, options) { assert.equal(options.hitTolerance, 6); return visit(hit) }, getTargetElement: () => ({ style: {} }) }),
  isOverPopup: ref(false), lastMove: 0, pendingTimer: 0, hideTimer: 0,
  window: { setTimeout(fn) { callback = fn; return 1 }, clearTimeout() {} },
  Date, hover: ref(null), hoverKey: '', popupPos: ref({}),
  detailCache: {}, liveFeatures: ref([]), downloadError: ref(''),
  clampPopup: (x,y) => ({x,y}), facilityTypeTitle: () => 'Land fixed',
  getFeature(id) { requested = id; return new Promise(resolve => { resolveDetail = resolve }) },
  hoverFromFeature: feature => ({ title: feature.properties.title, wigosId: feature.id }),
  stationToHover() { throw Error('Unexpected branch') }, popupPinned: ref(false), locale: ref('zh'),
  stationTiles: { async getFeatures() { return [hit] } }, tilesActive: ref(true), hoverRequestVersion: 0, vectorRef: ref({}),
}
vm.createContext(context);vm.runInContext(code,context)
context.onPointerMove({ pixel: [10,20] }); await callback()
assert.equal(context.hover.value.title, 'Tile station')
assert.equal(requested, '0-test')
resolveDetail({ id: '0-test', properties: {title: 'Full station'} }); await new Promise(resolve=>setImmediate(resolve))
assert.equal(context.hover.value.title, 'Full station')
console.log('PASS: uncached vector tile immediately opens summary and receives full details')
