import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import MVT from 'ol/format/MVT.js'
import { createXYZ } from 'ol/tilegrid.js'
const manifest = JSON.parse(await readFile('src/data/stationOverview.json', 'utf8'))
const format = new MVT({ layers: ['hits'] })
const grid = createXYZ({ tileSize: manifest.tileSize })
let firstViewBytes = 0, grouped = 0
for (let z = 0; z <= manifest.maxZoom; z++) {
  let count = 0
  const ids = new Set()
  for (let x = 0; x < 2 ** z; x++) for (let y = 0; y < 2 ** z; y++) {
    const path = manifest.path.replace('{z}', z).replace('{x}', x).replace('{y}', y)
    const data = await readFile(`public/${path}`)
    if (z === 1) firstViewBytes += data.length
    const features = format.readFeatures(data, { extent: grid.getTileCoordExtent([z,x,y]), featureProjection: 'EPSG:3857' })
    for (const feature of features) {
      assert.deepEqual(Object.keys(feature.getProperties()).sort(), ['count', 'id', 'layer', 'properties.facilityType.id'])
      assert.equal(feature.getType(), 'Point')
      assert.ok(feature.getFlatCoordinates().every(Number.isFinite))
      assert.ok(feature.get('id'))
      assert.ok(!ids.has(feature.get('id')), 'representative must occur only once per zoom')
      ids.add(feature.get('id'))
      const size = feature.get('count')
      assert.ok(Number.isInteger(size) && size > 0)
      count += size
      if (size > 1) grouped++
    }
  }
  assert.equal(count, manifest.mapped, `zoom ${z} must account for every mapped station`)
}
assert.equal(manifest.total, manifest.mapped + manifest.unmapped)
assert.ok(grouped > 0)
assert.ok(firstViewBytes < 700000, `global overview too large: ${firstViewBytes}`)
console.log(`PASS: all overview levels preserve station counts; first view ${firstViewBytes} bytes`)
