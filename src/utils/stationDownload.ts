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
  /** Extended fields used by the CSV and WMDR V2 exports. */
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

function escPdf(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/[^\x20-\x7E]/g, '?')
    .slice(0, 110)
}

function escXml(s: string): string {
  return (s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function wrapLine(s: string, max = 95): string[] {
  const out: string[] = []
  let rest = s
  while (rest.length > max) {
    let cut = rest.lastIndexOf(' ', max)
    if (cut < 20) cut = max
    out.push(rest.slice(0, cut))
    rest = rest.slice(cut).trimStart()
  }
  out.push(rest)
  return out
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

/** Station report as PDF — fully generated locally so dist/file:// always works. */
export function downloadStationPdf(meta: StationDownloadMeta) {
  const wid = meta.wigosId || '0-22000-0-0000000'
  const shortId = meta.shortId || meta.name || wid.split('-').pop() || wid
  const today = new Date().toISOString().slice(0, 10)
  const raw: { text: string; size: number }[] = []
  const progList = parsePrograms(meta)
  const H = (t: string) => raw.push({ text: t, size: 14 })
  const S = (t: string) => raw.push({ text: t, size: 12 })
  const B = (t: string) => raw.push({ text: t, size: 10 })
  H(`${shortId} (${meta.type || 'station'})  Last updated: ${today} by Demo DC`)
  B('')
  S('Station characteristics')
  B(`Station name: ${meta.name || shortId}`)
  B(`Station alias: ${shortId}`)
  B(`Date established: ${meta.established || '(unknown)'}`)
  B(`Date closed: ${meta.closed || '(still operational)'}`)
  B(`Declared reporting status: ${meta.status || '(unknown)'}`)
  B('Assessed reporting status: Unknown')
  B(`Station type: ${meta.type || '(unknown)'}`)
  B(`WIGOS Station Identifier(s): ${wid} (Primary)`)
  if (meta.lon !== undefined && meta.lat !== undefined) B(`Coordinates: ${meta.lat.toFixed(4)}, ${meta.lon.toFixed(4)} (demo)`)
  B('Supervising organization: (demo)')
  B('')
  S('Programs / network affiliations')
  progList.forEach((p) => {
    B(`Program: ${p} | Affiliation: Approved | Declared: ${meta.status || 'Operational'} | Assessed: Unknown`)
  })
  B('')
  S('Observations / measurements (demo)')
  B(`Programs / network affiliations: ${progList.map((p) => p.split(':')[0]).join(', ') || 'GOS'}`)
  B(`Last updated: On ${today} by Demo DC`)
  B('')
  B(`Exported from local OSCAR/Surface demo at ${new Date().toISOString()}`)

  const lines: { text: string; size: number }[] = []
  raw.forEach((l) => wrapLine(l.text).forEach((t) => lines.push({ text: t, size: l.size })))

  const PER_PAGE = 52
  const pages: { text: string; size: number }[][] = []
  for (let i = 0; i < lines.length; i += PER_PAGE) pages.push(lines.slice(i, i + PER_PAGE))
  const pageCount = pages.length
  const pageObjNums: number[] = []
  const contentObjNums: number[] = []
  let next = 3
  pages.forEach(() => {
    pageObjNums.push(next)
    contentObjNums.push(next + 1)
    next += 2
  })
  const fontObj = next
  const kids = pageObjNums.map((n) => `${n} 0 R`).join(' ')
  const objects: string[] = []
  objects[0] = '<< /Type /Catalog /Pages 2 0 R >>'
  objects[1] = `<< /Type /Pages /Kids [${kids}] /Count ${pageCount} >>`
  const streams: string[] = pages.map((pl, pi) => {
    let c = 'BT '
    let y = 800
    pl.forEach((l) => {
      const lh = l.size > 12 ? 20 : l.size > 10 ? 17 : 14
      c += `/F1 ${l.size} Tf 1 0 0 1 50 ${y} Tm (${escPdf(l.text || ' ')}) Tj `
      y -= lh
    })
    c += `ET BT /F1 9 Tf 1 0 0 1 450 30 Tm (-- ${pi + 1} of ${pageCount} --) Tj ET`
    return c
  })
  pages.forEach((_, i) => {
    objects[pageObjNums[i] - 1] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontObj} 0 R >> >> /Contents ${contentObjNums[i]} 0 R >>`
    objects[contentObjNums[i] - 1] = `<< /Length ${streams[i].length} >>\nstream\n${streams[i]}\nendstream`
  })
  objects[fontObj - 1] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
  let pdf = '%PDF-1.4\n'
  const offsets: number[] = []
  objects.forEach((obj, i) => {
    offsets.push(pdf.length)
    pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`
  })
  const xref = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  offsets.forEach((o) => {
    pdf += `${String(o).padStart(10, '0')} 00000 n \n`
  })
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  saveBlob(new Blob([pdf], { type: 'application/pdf' }), `${fileBase(wid)}.pdf`)
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

const CSV_HEADER = [
  'wigosId',
  'name',
  'stationType',
  'stationClass',
  'latitude',
  'longitude',
  'elevation',
  'wmoRegion',
  'territory',
  'operatingStatus',
  'assessedStatus',
  'programmeAffiliation',
  'supervisory',
  'dateEstablished',
  'lastModified',
  'dateClosed',
  'observedVariables',
]

function csvCell(value: unknown): string {
  const s = String(value ?? '')
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Station as CSV — one data row following the WMDR V2 element set. */
export function downloadStationCsv(meta: StationDownloadMeta) {
  const wid = meta.wigosId || '0-22000-0-0000000'
  const today = new Date().toISOString().slice(0, 10)
  const row = [
    wid,
    meta.name || meta.shortId || wid,
    meta.type ?? '',
    meta.className ?? '',
    meta.lat ?? '',
    meta.lon ?? '',
    meta.elevation ?? '',
    meta.wmoRegion ?? '',
    meta.country ?? '',
    meta.status ?? '',
    meta.assessedStatus ?? '',
    parsePrograms(meta).join(';'),
    meta.org ?? '',
    meta.established ?? '',
    today,
    meta.closed ?? '',
    (meta.observedVariables ?? []).join(';'),
  ]
  // BOM keeps non-ASCII station names readable when the file is opened in Excel.
  const csv = `\ufeff${CSV_HEADER.join(',')}\r\n${row.map(csvCell).join(',')}\r\n`
  saveBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `${fileBase(wid)}.csv`)
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
