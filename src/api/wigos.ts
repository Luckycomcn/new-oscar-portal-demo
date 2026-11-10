/**
 * Client for the WMO Resource Catalogue (WIS2) OGC API Features endpoint that publishes
 * WIGOS observing facility metadata (WMDR2 records).
 *
 * Live collection:
 *   https://wmo-resource-catalogue.labs.wis2dev.io/collections/wigos-observing-facility-metadata
 *
 * The service is anonymous (CORS `*`), so the browser can call it directly. Override the host
 * with `VITE_WIGOS_API_BASE` when deploying against another catalogue instance.
 */
import type { Station, StationDomain, StationStatus } from '../data/stations'
import {
  facilityTypeDomain,
  facilityTypeIdByTitle,
  facilityTypeTitle,
  facilityTypes,
  findTerritoryId,
  programIdByTitle,
  programTitle,
  territoryById,
  variableInfo,
  wmoRegionTitle,
  wmoRegions,
} from '../data/wmdrCodes'

export const WIGOS_DEFAULT_BASE = 'https://wmo-resource-catalogue.labs.wis2dev.io'
export const WIGOS_COLLECTION = 'wigos-observing-facility-metadata'

const envBase = (import.meta.env as Record<string, string | undefined>).VITE_WIGOS_API_BASE
export const WIGOS_API_BASE = (envBase?.trim() || WIGOS_DEFAULT_BASE).replace(/\/+$/, '')
export const WIGOS_COLLECTION_URL = `${WIGOS_API_BASE}/collections/${WIGOS_COLLECTION}`
export const WIGOS_ITEMS_URL = `${WIGOS_COLLECTION_URL}/items`

export interface WigosCodeRef {
  id?: string
  url?: string
  title?: string
}

export interface WigosContact {
  roles?: string[]
  name?: string
  position?: string
  organization?: string
  identifier?: string
  emails?: { value?: string }[]
  phones?: { value?: string }[]
  addresses?: {
    deliveryPoint?: string[]
    city?: string
    administrativeArea?: string
    postalCode?: string
    country?: string
  }[]
  contactInstructions?: string
  hoursOfService?: string
}

export interface WigosConfiguration {
  id?: string
  time?: { interval?: string[] }
  observingMethod?: WigosCodeRef
}

export interface WigosObservation {
  programAffiliations?: { programAffiliation?: WigosCodeRef; reportingStatus?: WigosCodeRef }[]
  configurations?: WigosConfiguration[]
  observedGeometry?: WigosCodeRef
  observedProperty?: WigosCodeRef
}

export interface WigosProperties {
  type?: string
  title?: string
  description?: string
  created?: string
  updated?: string
  facilityType?: WigosCodeRef
  wmoRegion?: WigosCodeRef
  territories?: { territory?: WigosCodeRef; dates?: string[] }[]
  observations?: WigosObservation[]
  contacts?: WigosContact[]
}

export interface WigosFeature {
  id: string
  type: string
  geometry?: { type: string; coordinates?: number[] } | null
  properties: WigosProperties
  time?: { interval?: string[] }
  conformsTo?: string[]
  links?: { rel?: string; type?: string; title?: string; href: string }[]
}

export interface WigosFeatureCollection {
  type: string
  features: WigosFeature[]
  numberMatched: number
  numberReturned: number
  timeStamp?: string
  links?: { rel?: string; href?: string; title?: string; type?: string }[]
}

export type WigosBbox = [number, number, number, number]

export interface WigosItemsQuery {
  limit?: number
  offset?: number
  /** lonMin, latMin, lonMax, latMax in CRS84 (WGS84 lon/lat). */
  bbox?: WigosBbox
  /** Free-text search. The catalogue matches whole title tokens, not substrings. */
  q?: string
  datetime?: string
  /** Only scalar top-level fields are accepted by the service: title, created, updated. */
  properties?: string[]
  skipGeometry?: boolean
  /** e.g. `title`, `-created`, `-updated`. */
  sortby?: string
  /** Queryable field name -> equality value, e.g. { 'facilityType.id': 'landFixed' }. */
  filters?: Record<string, string | undefined>
  signal?: AbortSignal
  timeoutMs?: number
}

export const WIGOS_MAX_LIMIT = 1000
const DEFAULT_TIMEOUT_MS = 25000
const LIST_TTL_MS = 3 * 60 * 1000
const FEATURE_TTL_MS = 10 * 60 * 1000

export function buildItemsUrl(query: WigosItemsQuery = {}): string {
  const params = new URLSearchParams({ f: 'json' })
  if (query.limit != null) params.set('limit', String(Math.min(WIGOS_MAX_LIMIT, Math.max(1, Math.round(query.limit)))))
  if (query.offset != null && query.offset > 0) params.set('offset', String(Math.round(query.offset)))
  if (query.bbox) params.set('bbox', query.bbox.map((v) => Number(v.toFixed(6))).join(','))
  if (query.q?.trim()) params.set('q', query.q.trim())
  if (query.datetime?.trim()) params.set('datetime', query.datetime.trim())
  if (query.properties?.length) params.set('properties', query.properties.join(','))
  if (query.skipGeometry) params.set('skipGeometry', 'true')
  if (query.sortby) params.set('sortby', query.sortby)
  for (const [key, value] of Object.entries(query.filters ?? {})) {
    if (value != null && String(value).trim() !== '') params.set(key, String(value).trim())
  }
  return `${WIGOS_ITEMS_URL}?${params.toString()}`
}

async function requestJson<T>(url: string, signal?: AbortSignal, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const forwardAbort = () => controller.abort()
  signal?.addEventListener('abort', forwardAbort)
  if (signal?.aborted) controller.abort()
  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: { Accept: 'application/geo+json, application/json;q=0.9, */*;q=0.5' },
    })
    if (!res.ok) throw new Error(`WIGOS catalogue request failed (${res.status} ${res.statusText})`)
    return (await res.json()) as T
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', forwardAbort)
  }
}

interface CacheEntry<T> {
  expires: number
  promise: Promise<T>
}

const listCache = new Map<string, CacheEntry<WigosFeatureCollection>>()
const featureCache = new Map<string, CacheEntry<WigosFeature | null>>()

export function clearWigosCache() {
  listCache.clear()
  featureCache.clear()
}

/** GET /collections/{collectionId}/items with a short-lived in-memory cache. */
export async function queryFeatures(query: WigosItemsQuery = {}): Promise<WigosFeatureCollection> {
  const url = buildItemsUrl(query)
  // A caller's cancellation must not cancel a request shared by other views.
  if (query.signal) return requestJson<WigosFeatureCollection>(url, query.signal, query.timeoutMs)
  const cached = listCache.get(url)
  if (cached && cached.expires > Date.now()) return cached.promise
  const promise = requestJson<WigosFeatureCollection>(url, query.signal, query.timeoutMs).catch((error) => {
    listCache.delete(url)
    throw error
  })
  listCache.set(url, { expires: Date.now() + LIST_TTL_MS, promise })
  return promise
}

/** Accumulates pages of `pageSize` until `maxItems` is reached. */
export async function queryFeaturesPaged(
  query: WigosItemsQuery,
  maxItems: number,
  pageSize = 250,
): Promise<WigosFeatureCollection> {
  const first = await queryFeatures({ ...query, limit: Math.min(pageSize, maxItems), offset: 0 })
  const features = [...first.features]
  let offset = first.features.length
  while (features.length < Math.min(maxItems, first.numberMatched) && first.features.length > 0) {
    const page = await queryFeatures({
      ...query,
      limit: Math.min(pageSize, maxItems - features.length),
      offset,
    })
    if (!page.features.length) break
    features.push(...page.features)
    offset += page.features.length
  }
  return { ...first, features, numberReturned: features.length }
}

/** GET /collections/{collectionId}/items/{featureId}; resolves to null on 404. */
export async function getFeature(id: string, signal?: AbortSignal): Promise<WigosFeature | null> {
  const key = id.trim()
  if (!key) return null
  if (signal) {
    try {
      return await requestJson<WigosFeature>(`${WIGOS_ITEMS_URL}/${encodeURIComponent(key)}?f=json`, signal)
    } catch (error) {
      if (error instanceof Error && /\(404 /.test(error.message)) return null
      throw error
    }
  }
  const cached = featureCache.get(key)
  if (cached && cached.expires > Date.now()) return cached.promise
  const url = `${WIGOS_ITEMS_URL}/${encodeURIComponent(key)}?f=json`
  const promise = requestJson<WigosFeature>(url, signal).catch((error) => {
    featureCache.delete(key)
    if (error instanceof Error && /\(404 /.test(error.message)) return null
    throw error
  })
  featureCache.set(key, { expires: Date.now() + FEATURE_TTL_MS, promise })
  return promise
}

export async function countFeatures(filters: WigosItemsQuery['filters'] = {}, signal?: AbortSignal): Promise<number> {
  const result = await queryFeatures({ limit: 1, properties: ['title'], filters, signal })
  return result.numberMatched
}

/** Count populated WMDR facility types, excluding the unknown code. Fail as a whole on request errors. */
export async function getPopulatedFacilityTypeCount(signal?: AbortSignal): Promise<number> {
  const types = facilityTypes.filter((type) => type.id !== 'unknown')
  const counts: number[] = []
  // Bound concurrency to avoid flooding the catalogue alongside map requests.
  for (let start = 0; start < types.length; start += 3) {
    counts.push(...await Promise.all(types.slice(start, start + 3).map((type) =>
      countFeatures({ 'facilityType.id': type.id }, signal))))
  }
  return counts.filter((count) => count > 0).length
}

export interface CatalogueStats {
  totalFacilities: number
  lastCreated?: string
  catalogueTimeStamp?: string
}

export async function getCatalogueStats(signal?: AbortSignal): Promise<CatalogueStats> {
  const [all, latest] = await Promise.all([
    queryFeatures({ limit: 1, properties: ['title'], signal }),
    queryFeatures({ limit: 1, properties: ['title', 'created'], sortby: '-created', signal }),
  ])
  return {
    totalFacilities: all.numberMatched,
    lastCreated: latest.features[0]?.properties.created?.slice(0, 10),
    catalogueTimeStamp: all.timeStamp ?? latest.timeStamp,
  }
}

// ---------------------------------------------------------------------------
// WMDR2 -> application view models
// ---------------------------------------------------------------------------

export function featureCoordinates(feature: WigosFeature): { lon: number; lat: number; elevation?: number } | null {
  const coords = feature.geometry?.coordinates
  if (!coords || coords.length < 2) return null
  const [lon, lat, elevation] = coords
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null
  return { lon, lat, elevation: Number.isFinite(elevation) ? elevation : undefined }
}

export function featureProgramIds(feature: WigosFeature): string[] {
  const ids = new Set<string>()
  for (const observation of feature.properties.observations ?? []) {
    for (const affiliation of observation.programAffiliations ?? []) {
      const id = affiliation.programAffiliation?.id
      if (id) ids.add(id)
    }
  }
  return [...ids]
}

function isoDate(value?: string): string {
  if (!value) return ''
  return value.slice(0, 10)
}

export function featureEstablished(feature: WigosFeature): string {
  return isoDate(feature.time?.interval?.[0])
}

export function featureClosed(feature: WigosFeature): string {
  const end = feature.time?.interval?.[1]
  if (!end || end === '..') return ''
  const date = isoDate(end)
  return date && date <= new Date().toISOString().slice(0, 10) ? date : ''
}

export function featureStatus(feature: WigosFeature): StationStatus {
  return featureClosed(feature) ? 'Closed' : 'Operational'
}

export function featureTerritoryIds(feature: WigosFeature): string[] {
  return [...new Set((feature.properties.territories ?? []).map((t) => t.territory?.id).filter(Boolean) as string[])]
}

export function featureTerritoryNames(feature: WigosFeature): string[] {
  return featureTerritoryIds(feature).map((id) => territoryById[id] ?? id)
}

export function featurePrograms(feature: WigosFeature): { id: string; title: string; status: StationStatus }[] {
  const status = featureStatus(feature)
  return featureProgramIds(feature).map((id) => ({ id, title: programTitle(id), status }))
}

export function featureToStation(feature: WigosFeature): Station | null {
  const coords = featureCoordinates(feature)
  const typeId = feature.properties.facilityType?.id
  if (!coords || !typeId) return null
  const territories = featureTerritoryNames(feature)
  const status = featureStatus(feature)
  return {
    id: feature.id,
    name: feature.properties.title || feature.id,
    wigosId: feature.id,
    lon: coords.lon,
    lat: coords.lat,
    type: facilityTypeTitle(typeId),
    domain: facilityTypeDomain(typeId),
    status,
    programs: featureProgramIds(feature)
      .map((id) => `${programTitle(id)}:${status}`)
      .join(', '),
    established: featureEstablished(feature),
    country: territories[0] ?? '',
    className: feature.properties.observations?.length
      ? variableInfo(feature.properties.observations[0].observedProperty?.id)?.category ?? ''
      : '',
  }
}

export interface FacilityRow {
  id: string
  name: string
  wigosId: string
  country: string
  type: string
  status: StationStatus
  lat: number
  lon: number
  elevation?: number
  programs: string[]
  established: string
  closed: string
  domain: StationDomain
  facilityTypeId: string
}

export function featureToRow(feature: WigosFeature): FacilityRow | null {
  const coords = featureCoordinates(feature)
  if (!coords) return null
  const typeId = feature.properties.facilityType?.id ?? ''
  return {
    id: feature.id,
    name: feature.properties.title || feature.id,
    wigosId: feature.id,
    country: featureTerritoryNames(feature).join(', '),
    type: facilityTypeTitle(typeId) || typeId,
    status: featureStatus(feature),
    lat: coords.lat,
    lon: coords.lon,
    elevation: coords.elevation,
    programs: featureProgramIds(feature).map((id) => programTitle(id)),
    established: featureEstablished(feature),
    closed: featureClosed(feature),
    domain: facilityTypeDomain(typeId),
    facilityTypeId: typeId,
  }
}

export interface ReportContact {
  roles: string[]
  name?: string
  position?: string
  organization?: string
  emails: string[]
  phones: string[]
  address?: string
}

export interface ReportObservationConfiguration {
  id?: string
  from?: string
  to?: string
  method?: string
}

export interface ReportObservation {
  variableId?: number
  variable: string
  category: string
  geometry?: string
  programs: { id: string; title: string }[]
  configurations: ReportObservationConfiguration[]
}

export interface WigosReport {
  id: string
  name: string
  description?: string
  facilityTypeId: string
  facilityType: string
  wmoRegionId?: string
  wmoRegion: string
  territoryIds: string[]
  territories: string[]
  territoryAssignments: { id: string; title: string; from?: string; to?: string }[]
  lon?: number
  lat?: number
  elevation?: number
  established?: string
  closed?: string
  status: StationStatus
  created?: string
  programs: { id: string; title: string; status: StationStatus }[]
  observations: ReportObservation[]
  contacts: ReportContact[]
  links: { rel?: string; title?: string; type?: string; href: string }[]
  conformsTo: string[]
  feature: WigosFeature
}

function formatAddress(address: NonNullable<WigosContact['addresses']>[number]): string {
  const parts = [
    ...(address.deliveryPoint ?? []),
    address.city,
    address.administrativeArea,
    address.postalCode,
    address.country ? territoryById[address.country] ?? address.country : undefined,
  ]
  return parts.filter(Boolean).join(', ')
}

export function featureToReport(feature: WigosFeature): WigosReport {
  const coords = featureCoordinates(feature)
  const status = featureStatus(feature)
  const territories = featureTerritoryNames(feature)
  const observations: ReportObservation[] = (feature.properties.observations ?? []).map((observation) => {
    const rawId = observation.observedProperty?.id
    const numericId = rawId != null && Number.isFinite(Number(rawId)) ? Number(rawId) : undefined
    const info = variableInfo(numericId)
    return {
      variableId: numericId,
      variable: info?.name ?? (rawId ? `Variable ${rawId}` : 'unknown'),
      category: info?.category ?? '',
      geometry: observation.observedGeometry?.id,
      programs: (observation.programAffiliations ?? [])
        .map((affiliation) => affiliation.programAffiliation?.id)
        .filter(Boolean)
        .map((id) => ({ id: id as string, title: programTitle(id) })),
      configurations: (observation.configurations ?? []).map((configuration) => ({
        id: configuration.id,
        from: isoDate(configuration.time?.interval?.[0]),
        to: configuration.time?.interval?.[1] === '..' ? '..' : isoDate(configuration.time?.interval?.[1]),
        method: configuration.observingMethod?.id,
      })),
    }
  })
  return {
    id: feature.id,
    name: feature.properties.title || feature.id,
    description: feature.properties.description,
    facilityTypeId: feature.properties.facilityType?.id ?? '',
    facilityType: facilityTypeTitle(feature.properties.facilityType?.id) || feature.properties.facilityType?.id || '',
    wmoRegionId: feature.properties.wmoRegion?.id,
    wmoRegion: wmoRegionTitle(feature.properties.wmoRegion?.id),
    territoryIds: featureTerritoryIds(feature),
    territories,
    territoryAssignments: (feature.properties.territories ?? []).map((entry) => ({
      id: entry.territory?.id ?? '',
      title: entry.territory?.title || territoryById[entry.territory?.id ?? ''] || entry.territory?.id || '—',
      from: entry.dates?.[0],
      to: entry.dates?.[1],
    })),
    lon: coords?.lon,
    lat: coords?.lat,
    elevation: coords?.elevation,
    established: featureEstablished(feature) || undefined,
    closed: featureClosed(feature) || undefined,
    status,
    created: feature.properties.created,
    programs: featurePrograms(feature),
    observations,
    contacts: (feature.properties.contacts ?? []).map((contact) => ({
      roles: contact.roles ?? [],
      name: contact.name,
      position: contact.position,
      organization: contact.organization,
      emails: (contact.emails ?? []).map((email) => email.value).filter(Boolean) as string[],
      phones: (contact.phones ?? []).map((phone) => phone.value).filter(Boolean) as string[],
      address: contact.addresses?.map(formatAddress).filter(Boolean).join(' | '),
    })),
    links: (feature.links ?? []).filter((link) => Boolean(link.href)),
    conformsTo: feature.conformsTo ?? [],
    feature,
  }
}

// ---------------------------------------------------------------------------
// High-level search used by the UI
// ---------------------------------------------------------------------------

export interface FacilitySearchParams {
  /** Free text; passed to the catalogue `q` parameter (whole-word match). */
  q?: string
  /** Facility type ids (landFixed) or titles (Land (fixed)). */
  types?: string[]
  /** Program affiliation ids (GBON) or titles. */
  programs?: string[]
  /** Territory ISO3 codes (CHE) or names (Switzerland). */
  territories?: string[]
  /** Observed property ids. */
  variables?: (string | number)[]
  /** WMO region ids (europe) or titles. */
  regions?: string[]
  bbox?: WigosBbox
  limit?: number
  offset?: number
  sortby?: string
  signal?: AbortSignal
  /** Load the full WMDR2 properties (needed for the results table); defaults to true. */
  full?: boolean
}

export interface FacilitySearchResult {
  features: WigosFeature[]
  /** Total number of matches reported by the server for the server-side filters. */
  numberMatched: number
  numberReturned: number
  timeStamp?: string
  /** Features remaining after client-side refinement of multi-value filters. */
  filteredFeatures: WigosFeature[]
}

export function resolveFacilityTypeId(value: string): string | undefined {
  return facilityTypeIdByTitle(value)
}

export function resolveProgramId(value: string): string | undefined {
  return programIdByTitle(value) ?? programIdByTitle(value.replace(/\s*\/.*$/, ''))
}

export function resolveTerritoryId(value: string): string | undefined {
  return findTerritoryId(value) ?? (/^[A-Za-z]{3}$/.test(value.trim()) ? value.trim().toUpperCase() : undefined)
}

function resolveRegionId(value: string): string | undefined {
  const needle = value.trim().toLowerCase()
  return wmoRegions.find((region) => region.id.toLowerCase() === needle || region.title.toLowerCase() === needle)?.id
}

function firstServerValue<T>(values: T[] | undefined, resolve: (value: T) => string | undefined): string | undefined {
  for (const value of values ?? []) {
    const resolved = resolve(value)
    if (resolved) return resolved
  }
  return undefined
}

function featureMatches(
  feature: WigosFeature,
  types: string[],
  programs: string[],
  territories: string[],
  variables: string[],
  regions: string[],
): boolean {
  const typeId = feature.properties.facilityType?.id?.toLowerCase()
  if (types.length && !types.some((t) => resolveFacilityTypeId(t)?.toLowerCase() === typeId)) return false
  if (programs.length) {
    const ids = featureProgramIds(feature).map((id) => id.toLowerCase())
    const wanted = programs
      .map((program) => resolveProgramId(program)?.toLowerCase())
      .filter(Boolean) as string[]
    if (!wanted.some((id) => ids.includes(id))) return false
  }
  if (territories.length) {
    const ids = featureTerritoryIds(feature)
    if (!territories.some((t) => ids.includes(resolveTerritoryId(t) ?? t))) return false
  }
  if (variables.length) {
    const ids = new Set(
      (feature.properties.observations ?? []).map((o) => String(o.observedProperty?.id ?? '')).filter(Boolean),
    )
    if (!variables.some((v) => ids.has(String(v)))) return false
  }
  if (regions.length) {
    const id = feature.properties.wmoRegion?.id?.toLowerCase()
    if (!regions.some((r) => resolveRegionId(r)?.toLowerCase() === id)) return false
  }
  return true
}

export async function searchFacilities(params: FacilitySearchParams = {}): Promise<FacilitySearchResult> {
  const types = params.types?.filter(Boolean) ?? []
  const programs = params.programs?.filter(Boolean) ?? []
  const territories = params.territories?.filter(Boolean) ?? []
  const variables = (params.variables ?? []).map(String).filter(Boolean)
  const regions = params.regions?.filter(Boolean) ?? []

  // Identifiers are feature ids, not indexed title tokens.
  const candidate = params.q?.trim()
  if (candidate && /^\d+-\d+-\d+-\S+$/.test(candidate)) {
    const feature = await getFeature(candidate, params.signal)
    const coordinates = feature ? featureCoordinates(feature) : null
    const inBbox = !params.bbox || (coordinates != null &&
      coordinates.lon >= params.bbox[0] && coordinates.lat >= params.bbox[1] &&
      coordinates.lon <= params.bbox[2] && coordinates.lat <= params.bbox[3])
    const matches = feature && inBbox && featureMatches(feature, types, programs, territories, variables, regions)
      ? [feature] : []
    const features = matches.slice(params.offset ?? 0, (params.offset ?? 0) + (params.limit ?? 25))
    return { features, filteredFeatures: features, numberMatched: matches.length, numberReturned: features.length }
  }

  const filters: Record<string, string | undefined> = {
    'facilityType.id': firstServerValue(types, resolveFacilityTypeId),
    'observations.programAffiliations.programAffiliation.id': firstServerValue(programs, resolveProgramId),
    'territories.territory.id': firstServerValue(territories, resolveTerritoryId),
    'observations.observedProperty.id': variables[0],
    'wmoRegion.id': firstServerValue(regions, resolveRegionId),
  }

  const result = await queryFeatures({
    limit: params.limit ?? 25,
    offset: params.offset,
    bbox: params.bbox,
    q: params.q,
    sortby: params.sortby ?? 'title',
    properties: params.full === false ? ['title'] : undefined,
    filters,
    signal: params.signal,
    timeoutMs: 40000,
  })

  return {
    features: result.features,
    numberMatched: result.numberMatched,
    numberReturned: result.numberReturned,
    timeStamp: result.timeStamp,
    filteredFeatures: result.features.filter((feature) =>
      featureMatches(feature, types, programs, territories, variables, regions),
    ),
  }
}

/** Fetches one map tile worth of compact points for every facility type in a bounding box. */
export async function fetchMapFacilities(
  bbox: WigosBbox,
  options: {
    limitPerType?: number
    types?: string[]
    signal?: AbortSignal
    full?: boolean
    filters?: Record<string, string | undefined>
  } = {},
): Promise<WigosFeature[]> {
  const typeIds = options.types?.length
    ? options.types.map((t) => resolveFacilityTypeId(t)).filter(Boolean) as string[]
    : ['landFixed', 'landMobile', 'landOnIce', 'seaFixed', 'seaMobile', 'seaOnIce', 'lakeRiverFixed', 'lakeRiverMobile', 'underwaterFixed', 'underwaterMobile', 'airFixed', 'airMobile']
  const limit = options.limitPerType ?? 60
  const results = await Promise.all(
    typeIds.map((typeId) =>
      queryFeatures({
        bbox,
        limit,
        properties: options.full ? undefined : ['title'],
        filters: { ...options.filters, 'facilityType.id': typeId },
        signal: options.signal,
        timeoutMs: 30000,
      }).catch(() => null),
    ),
  )
  const seen = new Set<string>()
  const features: WigosFeature[] = []
  for (const [index, result] of results.entries()) {
    const typeId = typeIds[index]
    for (const feature of result?.features ?? []) {
      if (seen.has(feature.id)) continue
      seen.add(feature.id)
      // Compact responses only carry `title`; the request told us the facility type.
      if (!feature.properties.facilityType?.id) {
        feature.properties.facilityType = { id: typeId }
      }
      features.push(feature)
    }
  }
  return features
}

/** Read all viewport pages independently of list pagination. */
export async function loadMapPages(query: FacilitySearchParams, progress: (features: WigosFeature[], total: number) => void) {
  const features: WigosFeature[] = []
  const seen = new Set<string>()
  let offset = 0
  while (true) {
    query.signal?.throwIfAborted()
    const page = await searchFacilities({ ...query, limit: 500, offset, sortby: 'title', full: true })
    for (const feature of page.features) if (!seen.has(feature.id)) { seen.add(feature.id); features.push(feature) }
    offset += page.features.length
    progress([...features], page.numberMatched)
    if (offset >= page.numberMatched) return
    if (!page.features.length) throw new Error('Incomplete catalogue pagination')
  }
}

/** XYZ source templates must put the row (y) before the column (x). */
export const WIGOS_TILES_URL = WIGOS_COLLECTION_URL + '/tiles/WebMercatorQuad/{z}/{y}/{x}?f=pbf'
export function useMapTiles(query: FacilitySearchParams): boolean {
  return !query.q?.trim() && ![query.types, query.programs, query.territories, query.variables, query.regions].some(values => values?.length)
}
