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
    // Link directly to the source (currently oscar.wmo.int) instead of proxying
    // /wmdr-source. The catalogue owns this URL: when the OAI endpoint is
    // replaced by the renewal, the record's original link moves to the new
    // archive and this code keeps working without a hardcoded host or path.
    if (source.protocol !== 'https:') throw new Error('Unsupported WMDR source')
    const anchor = document.createElement('a')
    anchor.href = source.href
    anchor.target = '_blank'
    anchor.rel = 'noopener noreferrer'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    return
  }
  const content = JSON.stringify(record, null, 2)
  saveCatalogueFile(new Blob([content], {
    type: 'application/geo+json;charset=utf-8',
  }), id, format)
}

