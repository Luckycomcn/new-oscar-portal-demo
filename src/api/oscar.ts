/**
 * OSCAR-compatible data access layer.
 *
 * Facility queries use the WIS2 WMO Resource Catalogue. Reference vocabularies and
 * legacy numeric contact links retain bundled snapshots. Name/list compatibility
 * helpers retain offline fallback; reports and exports require a real facility.
 */
import stationNameRaw from '../data/stationName.json'
import wigosIdsRaw from '../data/wigosIds.json'
import countryRaw from '../data/country.json'
import stationsRaw from '../data/stations.json'
import stationClassRaw from '../data/StationClassRef.json'
import contactsRaw from '../data/contacts.json'
import { stations as demoStations } from '../data/stations'
import { facilityTypeTitle, facilityTypes, territoryById, variableInfo } from '../data/wmdrCodes'
import { territories } from '../data/wmdrTerritories'
import {
  featureCoordinates,
  featureProgramIds,
  featureStatus,
  featureTerritoryIds,
  featureToRow,
  getFeature,
  queryFeatures,
  searchFacilities,
  type WigosFeature,
} from './wigos'

export interface OscarOption {
  id: string
  text: string
  group?: string
}

export interface OscarPage {
  items: OscarOption[]
  more: boolean
}

export interface StationReport {
  id: number
  name: string
  typeName?: string
  wmoRaName?: string
  dateEstablished?: string
  declaredStatusName?: string
  operatingStatusName?: string
  stationClasses?: string
  lastModifiedOn?: string
  territories?: { territoryName: string }[]
  locations?: { latitude: number; longitude: number; elevation?: number }[]
  wigosIds?: { wid: string; primary?: boolean }[]
  stationPrograms?: { program: string; approvalStatus?: string; stationProgramStatuses?: { declaredStatusName: string }[] }[]
  organizations?: { organizationName: string }[]
}

const PAGE_SIZE = 10

interface StationNameRow { total?: string; id: string | number; text: string }
interface WigosRaw { total?: number; resultList?: { id: string | number; wigosStationIdentifier: string }[] }

function localStationNames(): OscarOption[] {
  const seen = new Set<string>()
  const out: OscarOption[] = []
  const push = (id: string, text: string) => {
    const key = `${id}@@${text}`
    if (seen.has(key)) return
    seen.add(key)
    out.push({ id, text })
  }
  for (const s of demoStations) push(s.wigosId, `${s.name} (${s.wigosId})`)
  for (const row of stationNameRaw as StationNameRow[]) push(String(row.id), row.text)
  return out
}

function localWigosIds(): OscarOption[] {
  const seen = new Set<string>()
  const out: OscarOption[] = []
  const push = (id: string, text: string) => {
    if (seen.has(text)) return
    seen.add(text)
    out.push({ id, text })
  }
  for (const s of demoStations) push(s.wigosId, s.wigosId)
  const raw = wigosIdsRaw as WigosRaw
  for (const row of raw.resultList ?? []) push(String(row.id), row.wigosStationIdentifier)
  return out
}

let _stationNames: OscarOption[] | null = null
let _wigosIds: OscarOption[] | null = null

function paginateLocal(list: OscarOption[], q: string, page: number, pageSize = PAGE_SIZE): OscarPage {
  const needle = q.toLowerCase()
  const filtered = needle ? list.filter((item) => item.text.toLowerCase().includes(needle)) : list
  const start = (page - 1) * pageSize
  return { items: filtered.slice(start, start + pageSize), more: start + pageSize < filtered.length }
}

/** Station-name suggestions: live `q` search on the catalogue, local snapshot on failure. */
export async function searchApprovedStationNames(q: string, page: number): Promise<OscarPage> {
  const offset = (page - 1) * PAGE_SIZE
  try {
    const result = await queryFeatures({
      q,
      limit: PAGE_SIZE,
      offset,
      properties: ['title'],
      sortby: 'title',
      timeoutMs: 15000,
    })
    const items = result.features.map((feature) => ({
      id: feature.id,
      text: `${feature.properties.title ?? feature.id} (${feature.id})`,
    }))
    return { items, more: offset + items.length < result.numberMatched }
  } catch {
    if (!_stationNames) _stationNames = localStationNames()
    return paginateLocal(_stationNames, q, page)
  }
}

/**
 * WIGOS identifier suggestions. OGC API Features cannot search identifiers, so a complete
 * identifier is resolved through `/items/{id}` and partial text is matched against the
 * bundled identifier snapshot.
 */
export async function searchApprovedWigosIds(q: string, page: number): Promise<OscarPage> {
  if (!_wigosIds) _wigosIds = localWigosIds()
  const local = paginateLocal(_wigosIds, q, page)
  const candidate = q.trim()
  if (!candidate) {
    const offset = (page - 1) * PAGE_SIZE
    const result = await queryFeatures({ limit: PAGE_SIZE, offset, properties: ['title'] })
    return {
      items: result.features.map((feature) => ({ id: feature.id, text: feature.id })),
      more: offset + result.numberReturned < result.numberMatched,
    }
  }
  if (page > 1) return local
  if (!/^0-\d+-\d+-[A-Za-z0-9]+$/.test(candidate)) return local
  try {
    const feature = await getFeature(candidate)
    if (!feature) return local
    return {
      items: [{ id: feature.id, text: `${feature.properties.title ?? feature.id} (${feature.id})` }],
      more: false,
    }
  } catch {
    return local
  }
}

export interface StationSearchParams {
  term?: string
  country?: string
  types?: string[]
  classes?: string[]
  operation?: string
}

export interface StationSearchRow {
  id: string | number
  name: string
  wigosId: string
  country: string
  type: string
  status: string
  lat: number
  lon: number
  elevation?: number
  programs?: string[]
}

export interface StationSearchPage {
  rows: StationSearchRow[]
  total: number
  timeStamp?: string
}

/**
 * Advanced station search. Uses the catalogue queryables:
 * `q`, `facilityType.id`, `territories.territory.id`, `observations.programAffiliations…`,
 * `observations.observedProperty.id`, `wmoRegion.id`, `bbox`, `limit` and `offset`.
 */
export async function searchStationsPage(
  params: StationSearchParams & { limit?: number; offset?: number; bbox?: [number, number, number, number]; signal?: AbortSignal },
): Promise<StationSearchPage> {
  const result = await searchFacilities({
    q: params.term,
    types: params.types,
    territories: params.country ? [params.country] : [],
    bbox: params.bbox,
    limit: params.limit ?? 50,
    offset: params.offset ?? 0,
    sortby: 'title',
    signal: params.signal,
  })
  const rows: StationSearchRow[] = []
  for (const feature of result.filteredFeatures) {
    const row = featureToRow(feature)
    if (row) {
      rows.push({
        id: row.id,
        name: row.name,
        wigosId: row.wigosId,
        country: row.country,
        type: row.type,
        status: row.status,
        lat: row.lat,
        lon: row.lon,
        elevation: row.elevation,
        programs: row.programs,
      })
    }
  }
  return { rows, total: result.numberMatched, timeStamp: result.timeStamp }
}

export async function searchStations(params: StationSearchParams): Promise<StationSearchRow[]> {
  try {
    return (await searchStationsPage(params)).rows
  } catch {
    return searchStationsLocal(params)
  }
}

function searchStationsLocal(params: StationSearchParams): StationSearchRow[] {
  const rows = stationsRaw as {
    id: number; name: string; wigos?: string; terr?: string;
    lat?: number; lon?: number; type?: string; decl?: string
  }[]
  const q = (params.term ?? '').trim().toLowerCase()
  const country = (params.country ?? '').trim().toLowerCase()
  const list = rows.map((r) => ({
    id: r.id,
    name: r.name,
    wigosId: r.wigos ?? String(r.id),
    country: r.terr ?? '',
    type: r.type ?? '',
    status: r.decl ?? '',
    lat: Number(r.lat ?? 0),
    lon: Number(r.lon ?? 0),
  }))
  if (!q && !country && !params.types?.length) return list
  return list.filter((s) => {
    const checks: boolean[] = []
    if (q) checks.push(`${s.name} ${s.wigosId} ${s.country} ${s.type}`.toLowerCase().includes(q))
    if (country) checks.push(s.country.toLowerCase().includes(country))
    if (params.types?.length) {
      const needles = params.types.map((t) => t.toLowerCase())
      checks.push(needles.some((t) => s.type.toLowerCase().includes(t) || t.includes(s.type.toLowerCase())))
    }
    const op = (params.operation ?? 'AND').toUpperCase()
    return checks.length ? (op === 'OR' ? checks.some(Boolean) : checks.every(Boolean)) : true
  })
}

function featureToReport(feature: WigosFeature): StationReport {
  const coords = featureCoordinates(feature)
  const status = featureStatus(feature)
  const territories = featureTerritoryIds(feature).map((id) => ({ territoryName: territoryById[id] ?? id }))
  const categories = [
    ...new Set(
      (feature.properties.observations ?? [])
        .map((o) => variableInfo(o.observedProperty?.id)?.category)
        .filter(Boolean) as string[],
    ),
  ]
  return {
    id: Number(feature.id.split('-').pop()) || 0,
    name: feature.properties.title ?? feature.id,
    typeName: facilityTypeTitle(feature.properties.facilityType?.id) || feature.properties.facilityType?.id,
    wmoRaName: feature.properties.wmoRegion?.id,
    dateEstablished: feature.time?.interval?.[0]?.slice(0, 10),
    declaredStatusName: status,
    operatingStatusName: status,
    stationClasses: categories.join(', '),
    lastModifiedOn: (feature.properties.updated ?? feature.properties.created)?.slice(0, 10),
    territories,
    locations: coords
      ? [{ latitude: coords.lat, longitude: coords.lon, elevation: coords.elevation }]
      : [],
    wigosIds: [{ wid: feature.id, primary: true }],
    stationPrograms: featureProgramIds(feature).map((id) => ({
      program: id,
      approvalStatus: 'Affiliated',
      stationProgramStatuses: [{ declaredStatusName: status }],
    })),
    organizations: [
      ...new Set(
        (feature.properties.contacts ?? [])
          .map((c) => c.organization)
          .filter(Boolean) as string[],
      ),
    ].map((organizationName) => ({ organizationName })),
  }
}

export async function getStationReport(id: string): Promise<StationReport> {
  const feature = await getFeature(id)
  if (!feature) throw new Error('WIGOS facility not found: ' + id)
  return featureToReport(feature)
}

export async function downloadStationReport(id: string, format: 'xml' | 'json' | 'csv'): Promise<Blob> {
  const feature = await getFeature(id)
  if (!feature) throw new Error(`WIGOS facility not found: ${id}`)
  const report = featureToReport(feature)
  if (format === 'json') {
    return new Blob([JSON.stringify(feature, null, 2)], { type: 'application/geo+json;charset=utf-8' })
  }
  if (format === 'csv') {
    return new Blob([stationToCsv(report)], { type: 'text/csv;charset=utf-8' })
  }
  return new Blob([stationToXml(report)], { type: 'application/xml;charset=utf-8' })
}

function escXml(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function stationToXml(s: StationReport): string {
  const wigos = (s.wigosIds ?? []).map((w) => `    <wigosId primary="${w.primary ? 'true' : 'false'}">${escXml(w.wid)}</wigosId>`).join('\n')
  const loc = s.locations?.[0]
  return `<?xml version="1.0" encoding="UTF-8"?>\n<stationReport>\n  <name>${escXml(s.name)}</name>\n  <type>${escXml(s.typeName)}</type>\n  <wmoRegion>${escXml(s.wmoRaName)}</wmoRegion>\n  <declaredStatus>${escXml(s.declaredStatusName)}</declaredStatus>\n  <operatingStatus>${escXml(s.operatingStatusName)}</operatingStatus>\n  <dateEstablished>${escXml(s.dateEstablished)}</dateEstablished>\n  <territory>${escXml(s.territories?.[0]?.territoryName)}</territory>\n  <latitude>${escXml(loc?.latitude)}</latitude>\n  <longitude>${escXml(loc?.longitude)}</longitude>\n  <elevation>${escXml(loc?.elevation)}</elevation>\n${wigos}\n</stationReport>\n`
}

function stationToCsv(s: StationReport): string {
  const loc = s.locations?.[0]
  const rows: [string, string][] = [
    ['name', s.name],
    ['wigosId', (s.wigosIds ?? []).map((w) => w.wid).join(';')],
    ['territory', s.territories?.[0]?.territoryName ?? ''],
    ['wmoRegion', s.wmoRaName ?? ''],
    ['type', s.typeName ?? ''],
    ['class', s.stationClasses ?? ''],
    ['declaredStatus', s.declaredStatusName ?? ''],
    ['operatingStatus', s.operatingStatusName ?? ''],
    ['dateEstablished', s.dateEstablished ?? ''],
    ['latitude', String(loc?.latitude ?? '')],
    ['longitude', String(loc?.longitude ?? '')],
    ['elevation', String(loc?.elevation ?? '')],
  ]
  return `key,value\n${rows.map(([k, v]) => `${k},"${String(v).replace(/"/g, '""')}"`).join('\n')}\n`
}

interface RefItem {
  id: number
  name: string
  parentId?: number
}

export interface ContactInfo {
  id: number | string
  surnameNameTitle?: string
  surnameName?: string
  name?: string
  surname?: string
  email?: string
  countryName?: string
  organization?: string
  organisation?: string
}

let _countries: OscarOption[] | null = null
let _stationClasses: OscarOption[] | null = null

function localCountries(): OscarOption[] {
  return (countryRaw as RefItem[]).map((row) => ({
    id: String(row.id),
    text: row.name,
    group: row.parentId === 1 ? 'WMO Member State' : row.parentId === 2 ? 'WMO Member Territory' : 'Other',
  }))
}

function localStationClasses(): OscarOption[] {
  return (stationClassRaw as RefItem[]).map((row) => ({ id: String(row.id), text: row.name }))
}

/** Countries/territories now come from the WMDR territory code list (ISO3 ids). */
export async function searchCountries(q: string, page: number): Promise<OscarPage> {
  if (!_countries) {
    _countries = territories.length
      ? territories.map((territory) => ({ id: territory.id, text: territory.title }))
      : localCountries()
  }
  return paginateLocal(_countries, q, page, 30)
}

/** Facility types come from the WMDR FacilityType code list used by the catalogue. */
export async function searchStationTypes(q: string, page: number): Promise<OscarPage> {
  return paginateLocal(
    facilityTypes.map((type) => ({ id: type.id, text: type.title, group: type.domain })),
    q,
    page,
    30,
  )
}

export async function searchStationClasses(q: string, page: number): Promise<OscarPage> {
  if (!_stationClasses) _stationClasses = localStationClasses()
  return paginateLocal(_stationClasses, q, page)
}

/** Contacts are embedded in facilities; there is no independent contacts endpoint. */
export async function searchContacts(q: string, page: number): Promise<OscarPage> {
  const offset = (page - 1) * PAGE_SIZE
  const result = await queryFeatures({
    limit: PAGE_SIZE,
    offset,
    filters: q.trim() ? { 'contacts.name': q.trim() } : {},
  })
  return {
    items: result.features.flatMap((feature) => (feature.properties.contacts ?? []).flatMap((contact, index) => {
      const text = contact.name || contact.organization
      return text ? [{ id: `${feature.id}#${index}`, text }] : []
    })),
    more: offset + result.numberReturned < result.numberMatched,
  }
}

export async function getContact(id: string): Promise<ContactInfo> {
  const separator = id.lastIndexOf('#')
  if (separator > 0) {
    const feature = await getFeature(id.slice(0, separator))
    const contact = feature?.properties.contacts?.[Number(id.slice(separator + 1))]
    if (!contact) throw new Error(`WIGOS contact not found: ${id}`)
    const country = contact.addresses?.[0]?.country
    return {
      id,
      name: contact.name,
      organization: contact.organization,
      email: contact.emails?.map((email) => email.value).filter(Boolean).join('; '),
      countryName: country ? territoryById[country] ?? country : undefined,
    }
  }
  const hit = (contactsRaw as ContactInfo[]).find((row) => String(row.id) === String(id))
  if (hit) return hit
  throw new Error(`Contact not found: ${id}`)
}

