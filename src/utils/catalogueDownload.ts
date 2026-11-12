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

export async function downloadCatalogueRecord(id: string, format: 'json' | 'xml') {
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
  const content = JSON.stringify(record, null, 2)
  saveCatalogueFile(new Blob([content], {
    type: 'application/geo+json;charset=utf-8',
  }), id, format)
}

