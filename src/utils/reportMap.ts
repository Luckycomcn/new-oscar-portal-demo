import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import type { WigosFeature } from '../api/wigos'

type Ring = number[][]
interface CountryGeometry { type: string; coordinates: Ring[] | Ring[][] }

/** Render a station-centred location map without cross-origin tiles or screenshot uploads. */
export async function renderStationMap(record: WigosFeature): Promise<string> {
  const coordinates = record.geometry?.coordinates
  if (!coordinates || !Number.isFinite(coordinates[0]) || !Number.isFinite(coordinates[1])) {
    throw new Error('Station coordinates are missing; cannot create the PDF map')
  }
  const [lon, lat] = coordinates as [number, number]
  const response = await fetch(`${import.meta.env.BASE_URL}data/world-countries.geojson`, { signal: AbortSignal.timeout(15000) })
  if (!response.ok) throw new Error(`Map boundaries HTTP ${response.status}`)
  const countries = await response.json() as { features: { geometry: CountryGeometry | null }[] }
  const canvas = document.createElement('canvas')
  canvas.width = 1200
  canvas.height = 800
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Unable to create the PDF map canvas')
  const yMercator = (value: number) => Math.log(Math.tan(Math.PI / 4 + Math.max(-85, Math.min(85, value)) * Math.PI / 360)) * 180 / Math.PI
  const centerY = yMercator(lat)
  // Keep the station centred while preserving the geographic shape in Mercator.
  const span = Math.min(160, 60 / Math.max(0.25, Math.cos(lat * Math.PI / 180)))
  const scale = 1200 / span
  const point = (x: number, y: number, shift: number): [number, number] =>
    [600 + (x + shift - lon) * scale, 390 - (yMercator(y) - centerY) * scale]
  context.fillStyle = '#dcecf2'
  context.fillRect(0, 0, 1200, 800)
  context.save()
  context.beginPath(); context.rect(0, 0, 1200, 740); context.clip()
  for (const feature of countries.features) {
    const geometry = feature.geometry
    if (!geometry || !['Polygon', 'MultiPolygon'].includes(geometry.type)) continue
    const polygons = geometry.type === 'Polygon' ? [geometry.coordinates as Ring[]] : geometry.coordinates as Ring[][]
    for (const shift of [-360, 0, 360]) for (const polygon of polygons) {
      context.beginPath()
      for (const ring of polygon) {
        ring.forEach((position, index) => {
          const [x, y] = point(position[0]!, position[1]!, shift)
          if (index === 0) context.moveTo(x, y); else context.lineTo(x, y)
        })
        context.closePath()
      }
      context.fillStyle = '#f3f4ec'; context.fill('evenodd')
      context.strokeStyle = '#8da69b'; context.lineWidth = 1.3; context.stroke()
    }
  }
  context.strokeStyle = '#b4ced7'; context.lineWidth = 1
  for (let x = Math.floor((lon - span / 2) / 10) * 10; x <= lon + span / 2; x += 10) {
    const px = point(x, lat, 0)[0]
    context.beginPath(); context.moveTo(px, 0); context.lineTo(px, 740); context.stroke()
  }
  context.beginPath(); context.arc(600, 390, 12, 0, Math.PI * 2)
  context.fillStyle = '#0b3d91'; context.fill(); context.strokeStyle = '#fff'; context.lineWidth = 4; context.stroke()
  context.fillStyle = '#fff'; context.fillRect(625, 365, 310, 45)
  context.fillStyle = '#163249'; context.font = '22px sans-serif'; context.fillText(record.id, 635, 395)
  context.restore()
  // World overview keeps offshore platforms geographically recognisable.
  context.fillStyle = '#dcecf2'; context.fillRect(860, 20, 320, 160)
  context.save(); context.beginPath(); context.rect(860, 20, 320, 160); context.clip()
  for (const feature of countries.features) {
    const geometry = feature.geometry
    if (!geometry || !['Polygon', 'MultiPolygon'].includes(geometry.type)) continue
    const polygons = geometry.type === 'Polygon' ? [geometry.coordinates as Ring[]] : geometry.coordinates as Ring[][]
    for (const polygon of polygons) {
      context.beginPath()
      for (const ring of polygon) {
        ring.forEach((position, index) => {
          const x = 860 + (position[0]! + 180) / 360 * 320
          const y = 20 + (90 - position[1]!) / 180 * 160
          if (index === 0) context.moveTo(x, y); else context.lineTo(x, y)
        })
        context.closePath()
      }
      context.fillStyle = '#f3f4ec'; context.fill('evenodd')
      context.strokeStyle = '#8da69b'; context.lineWidth = 0.5; context.stroke()
    }
  }
  context.beginPath(); context.arc(860 + (lon + 180) / 360 * 320, 20 + (90 - lat) / 180 * 160, 4, 0, 2 * Math.PI)
  context.fillStyle = '#cf2249'; context.fill()
  context.restore(); context.strokeStyle = '#718992'; context.strokeRect(860, 20, 320, 160)
  context.fillStyle = '#fff'; context.fillRect(0, 740, 1200, 60)
  context.fillStyle = '#334e5b'; context.font = '18px sans-serif'
  context.fillText(`${lat.toFixed(5)}°, ${lon.toFixed(5)}°  |  Boundaries: Natural Earth (1:110m)`, 20, 776)
  return canvas.toDataURL('image/png')
}

/** Keep every official report page intact and append an attributed map page. */
export async function appendStationMap(pdfBytes: ArrayBuffer, image: string, id: string): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(pdfBytes)
  const png = await pdf.embedPng(image)
  const page = pdf.addPage([595.28, 841.89])
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  page.drawText('Station location map', { x: 36, y: 792, size: 19, font, color: rgb(0.04, 0.24, 0.32) })
  page.drawText(id.replace(/[^\x20-\x7e]/g, '?'), { x: 36, y: 768, size: 11, font })
  page.drawImage(png, { x: 36, y: 370, width: 523.28, height: 348.85 })
  page.drawText('Location from WMO Resource Catalogue; map added by this portal.', { x: 36, y: 338, size: 9, font })
  page.drawText('Boundaries and names do not imply endorsement by WMO or the United Nations.', { x: 36, y: 320, size: 8, font })
  return pdf.save()
}
