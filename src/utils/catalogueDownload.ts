import { WIGOS_ITEMS_URL, type WigosFeature } from '../api/wigos'

/** Always refetch the full record: downloads must not use demo data or view caches. */
export async function fetchDownloadRecord(id: string): Promise<WigosFeature> {
  const response = await fetch(`${WIGOS_ITEMS_URL}/${encodeURIComponent(id)}?f=json`, {
    headers: { Accept: 'application/geo+json, application/json' },
    cache: 'no-store',
    signal: AbortSignal.timeout(30000),
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const record = await response.json() as WigosFeature
  if (record.type !== 'Feature' || record.id !== id || !record.properties) {
    throw new Error('Invalid catalogue record')
  }
  return record
}

/** Preserve every field, including nested observations, contacts and territory dates. */
export function recordToCsv(record: WigosFeature): string {
  const rows: string[][] = [['field', 'value']]
  function visit(value: unknown, path: string) {
    if (value !== null && typeof value === 'object' && Object.keys(value).length) {
      for (const [key, child] of Object.entries(value)) visit(child, path ? `${path}.${key}` : key)
    } else {
      const text = value !== null && typeof value === 'object' ? JSON.stringify(value) : String(value ?? '')
      // Prevent spreadsheet applications from evaluating source strings as formulas.
      rows.push([path, /^[=+@\-\t\r\n]/.test(text) ? `'${text}` : text])
    }
  }
  visit(record, '')
  return '\uFEFF' + rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\r\n')
}

export function saveCatalogueFile(blob: Blob, id: string, extension: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${id.replace(/[^\w-]/g, '_')}.${extension}`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 10000)
}

export async function downloadCatalogueRecord(id: string, format: 'json' | 'csv' | 'xml' | 'pdf') {
  if (format === 'pdf') {
    const lookup = await fetch(`/oscar-station?wmoIndex=${encodeURIComponent(id)}`, {
      headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(30000),
    })
    if (!lookup.ok) throw new Error(`OSCAR station HTTP ${lookup.status}`)
    const station = await lookup.json()
    if (!Number.isSafeInteger(station.stationId) || station.stationId <= 0) {
      throw new Error('No OSCAR station found for this WIGOS identifier')
    }
    const response = await fetch('/oscar-pdf?registration=false', {
      method: 'POST', headers: { Accept: 'application/pdf' },
      body: new URLSearchParams({ data: JSON.stringify({ id: station.stationId, imageUrl: '' }) }),
      signal: AbortSignal.timeout(60000),
    })
    if (!response.ok) throw new Error(`PDF HTTP ${response.status}`)
    const blob = await response.blob()
    if (!(await blob.slice(0, 5).text()).startsWith('%PDF-')) throw new Error('OSCAR did not return a PDF file')
    const record = await fetchDownloadRecord(id)
    const { renderStationMap, appendStationMap } = await import('./reportMap')
    const image = await renderStationMap(record)
    const bytes = await appendStationMap(await blob.arrayBuffer(), image, id)
    saveCatalogueFile(new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }), id, 'pdf')
    return
  }
  const record = await fetchDownloadRecord(id)
  if (format === 'xml') {
    const link = record.links?.find((item) => item.rel === 'original' && /xml/i.test(item.type ?? ''))
    if (!link) throw new Error('No original WMDR XML link provided')
    const source = new URL(link.href)
    // The fixed proxy handles OSCAR's XML source without relying on browser CORS.
    if (source.origin !== 'https://oscar.wmo.int' || source.pathname !== '/oai/provider') {
      throw new Error('Unsupported WMDR source')
    }
    const response = await fetch(`/wmdr-source${source.search}`, { signal: AbortSignal.timeout(30000) })
    if (!response.ok) throw new Error(`XML HTTP ${response.status}`)
    const text = await response.text()
    const document = new DOMParser().parseFromString(text, 'application/xml')
    if (document.getElementsByTagName('parsererror').length ||
        document.getElementsByTagNameNS('*', 'error').length) throw new Error('Invalid XML source response')
    const metadata = document.getElementsByTagNameNS('*', 'metadata')[0]?.firstElementChild
    if (!metadata) throw new Error('WMDR metadata missing in source response')
    const xml = '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(metadata)
    saveCatalogueFile(new Blob([xml], { type: 'application/xml;charset=utf-8' }), id, 'xml')
    return
  }
  const content = format === 'json' ? JSON.stringify(record, null, 2) : recordToCsv(record)
  saveCatalogueFile(new Blob([content], {
    type: format === 'json' ? 'application/geo+json;charset=utf-8' : 'text/csv;charset=utf-8',
  }), id, format)
}

