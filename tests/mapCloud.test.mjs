import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
import ts from 'typescript'
import Feature from 'ol/Feature.js'
import Point from 'ol/geom/Point.js'
import Style from 'ol/style/Style.js'
import CircleStyle from 'ol/style/Circle.js'

const source = await readFile('src/components/OscarMap.vue', 'utf8')
const start = source.indexOf('function buildCloud(')
const end = source.indexOf('\nfunction stationToHover', start)
const code = ts.transpileModule(source.slice(start, end), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
let zoom = 2, resolution = 10
const station = (id, domain = 'land-ocean', lon = 1) => ({ id, wigosId: id, lon, lat: 1, domain })
const stations = Array.from({ length: 100 }, (_, i) => station(`s${i}`))
stations.push(station('air', 'air'))
const context = {
  props: {}, liveFeatures: { value: stations }, featureToStation: s => s,
  Feature, Point, mapCoordinate: (x,y) => [x,y], DEFAULT_ZOOM: 2.2,
  mapRef: { value: { getView: () => ({ getZoom: () => zoom, getResolution: () => resolution }) } },
  tileStyles: Object.fromEntries(['land-ocean', 'air'].map(d => [d, new Style({ image: new CircleStyle({ radius: 2.5 }) })])),
}
vm.createContext(context);vm.runInContext(code, context)
let cloud = context.buildCloud()
assert.equal(cloud.length, 2, 'different colour domains must not merge')
assert.equal(cloud[0].get('count'), 100)
assert.equal(cloud[0].get('cluster'), true)
assert.equal(cloud[0].getStyle().getImage().getRadius(), 2.5, 'large groups retain homepage point size')
zoom = 6
cloud = context.buildCloud()
assert.equal(cloud.length, stations.length)
assert.ok(cloud.every(f => f.getStyle().getImage().getRadius() === 2.5))
zoom = 2
context.props.visibleStations = stations
assert.equal(context.buildCloud().length, 2, 'provided station lists also aggregate')
context.props.visibleStations = [station('left', 'air', 1), station('right', 'air', 100)]
assert.equal(context.buildCloud().length, 1)
resolution = 1
assert.equal(context.buildCloud().length, 2, 'zooming in separates screen-space cells')
console.log('PASS: search points keep fixed size, aggregate by domain, and separate when zoomed')
