import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
import ts from 'typescript'
import Feature from 'ol/Feature.js'
import Point from 'ol/geom/Point.js'
import Style from 'ol/style/Style.js'
import CircleStyle from 'ol/style/Circle.js'
import { fromLonLat } from 'ol/proj.js'

const source = await readFile('src/components/OscarMap.vue', 'utf8')
const start = source.indexOf('function clusterFeaturesByDistance(')
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
const landGroup=cloud.find(f=>f.get('domain')==='land-ocean')
assert.equal(landGroup.get('count'), 100)
assert.equal(landGroup.get('cluster'), true)
assert.equal(landGroup.getStyle().getImage().getRadius(), 2.5, 'large groups retain homepage point size')
assert.deepEqual(landGroup.getGeometry().getCoordinates(), [1,1], 'cluster must stay on an actual station')
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

// Circular distance, not square-cell membership, determines the groups.
const point = (id,x,y,domain='land-ocean') => new Feature({geometry:new Point([x,y]),wigosId:id,domain})
let input=[point('a',9,5),point('b',11,5)]
let groups=context.clusterFeaturesByDistance(input,10)
assert.equal(groups.length,1,'near neighbours across cell borders must merge')
assert.equal(groups[0].get('count'),2)
assert.equal(groups[0].get('representativeId'),'a')
assert.equal(input[0].get('count'),undefined,'clustering must not mutate original station metadata')
assert.deepEqual(groups[0].getGeometry().getCoordinates(),[9,5])
groups=context.clusterFeaturesByDistance([point('a',0,0),point('b',9,9)],10)
assert.equal(groups.length,2,'distant diagonal points in the same cell must not merge')
input=[point('a',0,0),point('b',8,0),point('c',16,0)]
groups=context.clusterFeaturesByDistance(input,10)
assert.equal(groups.length,2,'a chain must not drag distant stations into a single group')
assert.equal(groups.reduce((n,f)=>n+(f.get('count')??1),0),3)
const reversed=context.clusterFeaturesByDistance([point('c',16,0),point('b',8,0),point('a',0,0)],10)
assert.deepEqual(groups.map(f=>[f.get('representativeId')??f.get('wigosId'),f.get('count')??1]),reversed.map(f=>[f.get('representativeId')??f.get('wigosId'),f.get('count')??1]))
console.log('PASS: fixed-size distance clusters use real station positions, preserve counts, cross grid boundaries and remain deterministic')

const manifest=JSON.parse(await readFile('src/data/stationOverview.json','utf8'))
const rows=JSON.parse(await readFile(`public/${manifest.pointFiles.landFixed.path}`,'utf8'))
context.props.visibleStations=rows.map(([id,lon,lat])=>({...station(id,'land-ocean',lon),lat}))
zoom=2.2;resolution=156543.03392804097/(2**zoom)
const realCoordinates=new Set(rows.map(([,lon,lat])=>fromLonLat([lon,lat]).join(',')))
// The production adapter takes longitude and latitude separately.
context.mapCoordinate=(lon,lat)=>fromLonLat([lon,lat])
const began=Date.now()
cloud=context.buildCloud()
assert.equal(cloud.reduce((sum,f)=>sum+(f.get('count')??1),0),rows.length)
assert.ok(cloud.every(f=>realCoordinates.has(f.getGeometry().getCoordinates().join(','))))
assert.ok(cloud.every(f=>f.getStyle().getImage().getRadius()===2.5))
console.log(`PASS: ${rows.length} real stations form ${cloud.length} groups in ${Date.now()-began}ms; every representative is a real coordinate`)
