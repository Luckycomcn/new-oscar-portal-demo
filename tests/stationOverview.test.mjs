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
let pointTotal = 0, missingTotal = 0
const allPointIds = new Set()
for (const [type, entry] of Object.entries(manifest.pointFiles)) {
  const rows = JSON.parse(await readFile(`public/${entry.path}`, 'utf8'))
  assert.equal(rows.length, entry.mapped, `${type} must contain every valid station`)
  assert.equal(entry.total, entry.mapped + entry.unmapped)
  for (const [id, lon, lat] of rows) {
    assert.ok(!allPointIds.has(id), 'station IDs must not be duplicated across types')
    allPointIds.add(id)
    assert.ok(Number.isFinite(lon) && Number.isFinite(lat))
    assert.ok(Math.abs(lon) <= 180 && Math.abs(lat) <= 90)
  }
  pointTotal += rows.length; missingTotal += entry.unmapped
}
assert.equal(pointTotal, manifest.mapped)
assert.equal(missingTotal, manifest.unmapped)
console.log(`PASS: all overview levels preserve station counts; first view ${firstViewBytes} bytes`)
console.log(`PASS: exact per-type snapshots cover ${pointTotal} points without representative-type filtering`)
