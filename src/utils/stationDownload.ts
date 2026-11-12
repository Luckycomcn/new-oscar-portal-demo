export interface StationDownloadMeta {
  wigosId: string
  shortId?: string
  name?: string
  type?: string
  status?: string
  assessedStatus?: string
  programs?: string
  established?: string
  closed?: string
  lon?: number
  lat?: number
  /** Extended fields used by the WMDR V2 exports. */
  country?: string
  className?: string
  wmoRegion?: string
  elevation?: number
  timeZone?: string
  org?: string
  observedVariables?: string[]
}

function parsePrograms(meta: StationDownloadMeta): string[] {
  return (meta.programs || 'GOS:Operational')
    .split(/[\n;,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function escXml(s: string): string {
  return (s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function saveBlob(blob: Blob, filename: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(a.href), 2000)
}

function fileBase(wigosId: string): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  return `${date}_${(wigosId || 'station').replace(/-/g, '_')}`
}

/** Station as WMDR XML — demo-shaped WIGOS Metadata Record generated locally. */
export function downloadStationXml(meta: StationDownloadMeta) {
  const wid = meta.wigosId || '0-22000-0-0000000'
  const shortId = meta.shortId || meta.name || wid.split('-').pop() || wid
  const today = new Date().toISOString().slice(0, 10)
  const progList = parsePrograms(meta)
  const programsXml = progList
    .map((p) => {
      const [name, st] = p.split(':').map((s) => (s ?? '').trim())
      return [
        '    <wmdr:programAffiliation>',
        `      <wmdr:program>${escXml(name || 'GOS')}</wmdr:program>`,
        `      <wmdr:affiliationStatus>Approved</wmdr:affiliationStatus>`,
        `      <wmdr:declaredStatus>${escXml(st || meta.status || 'Operational')}</wmdr:declaredStatus>`,
        '    </wmdr:programAffiliation>',
      ].join('\n')
    })
    .join('\n')
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<wmdr:WIGOSMetadataRecord xmlns:wmdr="http://def.wmo.int/wmdr/2017" xmlns:gml="http://www.opengis.net/gml/3.2">',
    '  <wmdr:headerInformation>',
    `    <wmdr:fileIdentifier>wmdr-${escXml(wid)}</wmdr:fileIdentifier>`,
    `    <wmdr:dateStamp>${today}</wmdr:dateStamp>`,
    '    <wmdr:description>Demo WIGOS Metadata Record exported from local OSCAR/Surface demo (not authoritative).</wmdr:description>',
    '  </wmdr:headerInformation>',
    '  <wmdr:facility>',
    `    <wmdr:name>${escXml(meta.name || shortId)}</wmdr:name>`,
    `    <wmdr:alias>${escXml(shortId)}</wmdr:alias>`,
    `    <wmdr:wigosStationIdentifier primary="true">${escXml(wid)}</wmdr:wigosStationIdentifier>`,
    `    <wmdr:facilityType>${escXml(meta.type || 'unknown')}</wmdr:facilityType>`,
    `    <wmdr:declaredStatus>${escXml(meta.status || 'unknown')}</wmdr:declaredStatus>`,
    `    <wmdr:dateEstablished>${escXml(meta.established || 'unknown')}</wmdr:dateEstablished>`,
    meta.closed ? `    <wmdr:dateClosed>${escXml(meta.closed)}</wmdr:dateClosed>` : '',
    meta.lon !== undefined && meta.lat !== undefined
      ? [
          '    <wmdr:geospatialLocation>',
          `      <gml:pos>${meta.lat.toFixed(5)} ${meta.lon.toFixed(5)}</gml:pos>`,
          '    </wmdr:geospatialLocation>',
        ].join('\n')
      : '',
    programsXml,
    '  </wmdr:facility>',
    '</wmdr:WIGOSMetadataRecord>',
    '',
  ]
    .filter((l) => l !== '')
    .join('\n')
  saveBlob(new Blob([xml], { type: 'application/xml' }), `${fileBase(wid)}.xml`)
}

/** Station as WMDR V2 (JSON) — WIGOS Metadata Representation v2 record. */
export function downloadJsonRecord(record: unknown, wigosId: string, suffix = 'record') {
  saveBlob(
    new Blob([JSON.stringify(record, null, 2)], { type: 'application/json;charset=utf-8' }),
    `${fileBase(wigosId)}_${suffix}.json`,
  )
}

export function downloadStationWmdrV2(meta: StationDownloadMeta) {
  const wid = meta.wigosId || '0-22000-0-0000000'
  const shortId = meta.shortId || meta.name || wid.split('-').pop() || wid
  const today = new Date().toISOString().slice(0, 10)
  const affiliation = parsePrograms(meta).map((p) => {
    const [programme, declared] = p.split(':').map((s) => (s ?? '').trim())
    return {
      programme: programme || 'GOS',
      approvalStatus: 'Approved',
      declaredStatus: declared || meta.status || 'Operational',
      assessedStatus: meta.assessedStatus ?? null,
    }
  })
  const record = {
    wigosMetadataRepresentation: {
      '@context': ['https://wmo.int/def/wmdr/2.0'],
      identifier: wid,
      name: meta.name || shortId,
      aliases: [shortId].filter((v, i, a) => a.indexOf(v) === i),
      facilityType: meta.type ?? null,
      stationClass: meta.className ?? null,
      wmoRegion: meta.wmoRegion ?? null,
      territory: meta.country ?? null,
      location: {
        geometry:
          meta.lat !== undefined && meta.lon !== undefined
            ? { type: 'Point', coordinates: [meta.lon, meta.lat] }
            : null,
        elevation: meta.elevation ?? null,
        positioningMethod: null,
        validSince: today,
      },
      timeZone: meta.timeZone ?? 'UTC',
      operatingStatus: meta.status ?? null,
      declaredStatus: meta.status ?? null,
      assessedStatus: meta.assessedStatus ?? null,
      dateEstablished: meta.established ?? null,
      dateClosed: meta.closed ?? null,
      programmeAffiliation: affiliation,
      responsibleParty: meta.org ? [meta.org] : [],
      observations: (meta.observedVariables ?? []).map((variable) => ({
        observedVariable: variable,
        geometry: 'Point',
        programmes: affiliation.map((a) => a.programme),
      })),
    },
  }
  saveBlob(
    new Blob([JSON.stringify(record, null, 2)], { type: 'application/json;charset=utf-8' }),
    `${fileBase(wid)}.json`,
  )
}
