import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import ts from 'typescript'
const source = await readFile('src/components/OscarMap.vue', 'utf8')
const start = source.indexOf('function selectStationSource(')
const end = source.indexOf('\nfunction tileFinished', start)
const code = ts.transpileModule(source.slice(start, end), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
let zoom = 2, selected
const local = {}, remote = {}
const context = {
  tilesActive: { value: true }, overviewUnavailable: false,
  mapRef: { value: { getView: () => ({ getZoom: () => zoom }) } },
  DEFAULT_ZOOM: 2.2, overview: { maxZoom: 5 }, overviewActive: { value: false },
  overviewTileSource: local, realtimeTileSource: remote, tileSource: local,
  pendingTiles: new Set(), stationTiles: { setSource: value => { selected = value } },
  hoverRequestVersion: 0, hover: { value: null }, hoverKey: '', mapError: { value: '' }, loading: { value: false },
  popupPinned: { value: false }, isOverPopup: { value: false },
}
vm.createContext(context); vm.runInContext(code, context)
context.selectStationSource(); assert.equal(context.overviewActive.value, true)
context.pendingTiles.add('obsolete-local-tile')
zoom = 6; context.selectStationSource()
assert.equal(selected, remote); assert.equal(context.overviewActive.value, false)
assert.equal(context.pendingTiles.size, 0)
zoom = 5; context.selectStationSource()
assert.equal(selected, local); assert.equal(context.overviewActive.value, true)
context.tilesActive.value = false; context.selectStationSource()
assert.equal(context.overviewActive.value, false)
context.tilesActive.value = true; context.overviewUnavailable = true; context.selectStationSource()
assert.equal(context.tileSource, remote)
console.log('PASS: overview/live zoom boundary, filtered mode and local failure fallback')
