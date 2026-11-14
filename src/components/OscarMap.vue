<template>
  <div class="oscar-map-shell">
    <p v-if="downloadError" class="map-download-error" role="alert">{{ downloadError }}</p>
    <div v-show="identifying" class="oscar-map-wait">{{ $t('map.identifying') }}</div>
    <div class="oscar-ol-wrap" ref="wrapEl">
      <div ref="amapEl" class="oscar-amap" :style="{ visibility: basemap === 'amap' ? 'visible' : 'hidden' }"></div>
      <div ref="mapEl" class="map oscar-ol-map"></div>

      <div
        v-if="hover"
        class="identify-popup"
        :style="{ left: popupPos.x + 'px', top: popupPos.y + 'px' }"
        @mouseenter="onPopupEnter"
        @mouseleave="onPopupLeave"
      >
        <a
          v-if="!hover.count && hover.wigosId"
          class="identify-popup__title identify-popup__title-link"
          :href="reportHref(hover.wigosId)"
          target="_blank"
          rel="noopener noreferrer"
        >{{ hover.title }}</a>
        <div v-else class="identify-popup__title">{{ hover.title }}</div>
        <div v-if="hover.count" class="identify-popup__body">{{ t('map.overviewZoomHint') }}</div>
        <div v-else class="identify-popup__body">
          <div><b>{{ $t('map.wigosId') }}:</b><br />{{ hover.wigosId }}</div>
          <div><b>{{ $t('map.stationType') }}:</b><br />{{ hover.type }}</div>
          <div><b>{{ $t('map.declaredStatus') }}:</b><br />{{ hover.status }}</div>
          <div v-if="hover.programs"><b>{{ $t('map.programStatuses') }}:</b><br />{{ hover.programs }}</div>
          <div><b>{{ $t('map.dateEstablished') }}:</b><br />{{ hover.established }}</div>
          <div v-if="hover.closed"><b>{{ $t('map.dateClosed') }}:</b><br />{{ hover.closed }}</div>
        </div>
        <div v-if="!hover.count" class="identify-popup__actions">
          <span class="dl-wrap">
            <button type="button" class="btn btn-default btn-xs" :disabled="downloading" @click="dlOpen = !dlOpen">
              <svg class="legacy-replacement-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" /></svg> {{ downloading ? $t('common.generating') : $t('common.download') }} ▾
            </button>
            <span v-show="dlOpen" class="dl-menu">
              <button type="button" @click="downloadXml">{{ $t('stationReport.xml') }}</button>
              <button type="button" @click="downloadWmdrV2">{{ $t('stationReport.wmdrV2') }}</button>
            </span>
          </span>
          <a
            class="btn btn-default btn-xs"
            :href="reportHref(hover.wigosId)"
            target="_blank"
            rel="noopener noreferrer"
          >{{ $t('map.stationReport') }}</a>
        </div>
      </div>

      <div class="oscar-legend">
        <div v-for="item in legend" :key="item.labelKey" class="oscar-legend__item">
          <span class="oscar-legend__dot" :style="{ background: item.color }"></span>
          {{ $t(item.labelKey) }}
        </div>
      </div>

      <div class="oscar-map-tools">
        <button type="button" :title="$t('map.zoomIn')" @click="zoomBy(1)">+</button>
        <button type="button" :title="$t('map.zoomOut')" @click="zoomBy(-1)">–</button>
        <button type="button" :title="$t('map.resetView')" class="oscar-map-tools__icon" @click="resetView">
          <svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 4.5A7.5 7.5 0 1 1 4.5 12H6a6 6 0 1 0 2.1-4.5L10 10H4V4l2.2 2.2A7.47 7.47 0 0 1 12 4.5z"/></svg>
        </button>
      </div>

      <div class="oscar-map-layers">
        <select :value="basemap" :aria-label="$t('map.basemap')" @change="selectBasemap">
          <option value="osm">{{ $t('map.basemapOsm') }}</option>
          <option value="amap">{{ $t('map.basemapAmap') }}</option>
          <option value="tianditu">{{ $t('map.basemapTianditu') }}</option>
        </select>
        <span v-if="basemapStatus" role="status">{{ $t(basemapStatus) }}</span>
      </div>

      <div v-if="loading || mapError || (!tilesActive && !matchedCount)" class="map-data-status" role="status" aria-live="polite">
        <span v-if="loading">{{ $t('common.loading') }}<span v-if="mapLoadTotal"> {{ mapLoaded.toLocaleString() }} / {{ mapLoadTotal.toLocaleString() }}</span></span>
        <span v-if="!tilesActive && !loading && !mapError && !matchedCount">{{ locale === 'zh' ? '无匹配站点' : 'No matching stations' }}</span>
        <span v-if="mapError" role="alert"> · {{ locale === 'zh' ? '加载失败，结果不完整：' : 'Loading failed; results incomplete: ' }}{{ mapError }} <button @click="loadViewport">{{ $t('common.retry') }}</button></span>
      </div>
    </div>

    <p v-if="overviewActive" class="overview-note" role="status">{{ t('map.overviewSnapshot', { date: overview.generatedAt.slice(0, 10) }) }}<span v-if="overview.unmapped"> · {{ t('map.overviewUnmapped', { count: overview.unmapped }) }}</span></p>
    <p v-else-if="filteredSnapshotDate" class="overview-note" role="status">{{ t('map.filteredSnapshot', { date: filteredSnapshotDate, count: matchedCount.toLocaleString() }) }}<span v-if="filteredUnmapped"> · {{ t('map.overviewUnmapped', { count: filteredUnmapped }) }}</span></p>
    <div v-if="selected" class="oscar-infobox">
      <strong><a :href="reportHref(selected.wigosId)" target="_blank" rel="noopener noreferrer">{{ selected.name }}</a></strong>
      <div>{{ selected.wigosId }} · {{ selected.type }}</div>
      <a :href="reportHref(selected.wigosId)" target="_blank" rel="noopener noreferrer">{{ $t('map.openStationReport') }}</a>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { filterCountry, filterType, filterPrograms, filterStatuses, focusedStation } from '../stores/quickFilter'
import Map from 'ol/Map'
import View from 'ol/View'
import TileLayer from 'ol/layer/Tile'
import OSM from 'ol/source/OSM'
import { amapConfigured, loadAmap, toGcj02 } from '../utils/amap'
import { tiandituKey, tiandituSource } from '../utils/tianditu'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import VectorTileLayer from 'ol/layer/VectorTile'
import VectorTileSource from 'ol/source/VectorTile'
import MVT from 'ol/format/MVT'
import Feature from 'ol/Feature'
import type Geometry from 'ol/geom/Geometry'
import GeoJSON from 'ol/format/GeoJSON'
import Point from 'ol/geom/Point'
import Polygon from 'ol/geom/Polygon'
import LineString from 'ol/geom/LineString'
import { fromLonLat, toLonLat, transformExtent } from 'ol/proj'
import { Circle as CircleStyle, Fill, Stroke, Style } from 'ol/style'
import ScaleLine from 'ol/control/ScaleLine'
import { defaults as defaultControls } from 'ol/control/defaults'
import type { Station, StationDomain } from '../data/stations'
import { domainColors } from '../data/stations'
import { downloadCatalogueRecord } from '../utils/catalogueDownload'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { WORLD_ISLANDS, WORLD_LAND } from '../data/worldLand'
import {
  WIGOS_TILES_URL,
  WIGOS_COLLECTION_URL,
  useMapTiles,
  type FacilitySearchParams,
  getFeature,
  featureClosed,
  featureEstablished,
  featureProgramIds,
  featureStatus,
  featureToStation,
  type WigosFeature,
} from '../api/wigos'
import { facilityTypeDomain, facilityTypeTitle, programTitle, findTerritoryId, programIdByTitle } from '../data/wmdrCodes'
import 'ol/ol.css'
import overview from '../data/stationOverview.json'
import { loadFilteredMap } from '../api/mapFacilities'

interface HoverInfo {
  count?: number
  title: string
  wigosId: string
  type: string
  status: string
  programs: string
  established: string
  closed?: string
  stationId?: string
}

const props = defineProps<{ visibleStations?: Station[]; mapQuery?: FacilitySearchParams }>()

const legend: { labelKey: string; domain: StationDomain; color: string }[] = [
  { labelKey: 'map.legend.air', domain: 'air', color: domainColors.air },
  { labelKey: 'map.legend.landOcean', domain: 'land-ocean', color: domainColors['land-ocean'] },
  { labelKey: 'map.legend.subsurface', domain: 'subsurface', color: domainColors.subsurface },
  { labelKey: 'map.legend.lake', domain: 'lake', color: domainColors.lake },
]

const mapEl = ref<HTMLDivElement | null>(null)
const wrapEl = ref<HTMLDivElement | null>(null)
const mapRef = shallowRef<Map | null>(null)
const vectorRef = shallowRef<VectorLayer<VectorSource> | null>(null)
const resizeObserver = ref<ResizeObserver | null>(null)
const identifying = ref(false)
const selected = ref<Station | null>(null)
const hover = ref<HoverInfo | null>(null)
const popupPos = ref({ x: 0, y: 0 })
const popupPinned = ref(false)
const isOverPopup = ref(false)
const downloading = ref(false)
const downloadError = ref('')
const { t, locale } = useI18n()
const router = useRouter()

/** Station reports open in a new tab; hash routing resolves relative to the deployed base. */
function reportHref(wigosId: string): string {
  return router.resolve({ name: 'stationReportDetails', params: { wigosId } }).href
}
const dlOpen = ref(false)
import { selectedBasemap, rememberBasemap, type Basemap } from '../utils/basemap'
const DEFAULT_CENTER = [0, 0]
const WORLD_EXTENT = transformExtent([-180, -85, 180, 85], 'EPSG:4326', 'EPSG:3857')
const DEFAULT_ZOOM = 2.2
const CHINA_CENTER: [number, number] = [104, 35]
const CHINA_ZOOM = 4
const basemap = ref<Basemap>('osm')
const basemapStatus = ref('')
const amapEl = ref<HTMLDivElement | null>(null)
const osmLayer = new TileLayer({ source: new OSM({ wrapX: false }) })
const tiandituLayers = (['vec', 'cva'] as const).map((layer) => new TileLayer({
  source: tiandituSource(layer), visible: false,
}))
let amap: InstanceType<Awaited<ReturnType<typeof loadAmap>>['Map']> | undefined
let selectionVersion = 0
let cancelAmapLoad: (() => void) | undefined
let lastAmapView = ''

function mapCoordinate(lon: number, lat: number) {
  return fromLonLat(basemap.value === 'amap' ? toGcj02(lon, lat) : [lon, lat])
}

function syncAmap() {
  const view = mapRef.value?.getView()
  const center = view?.getCenter()
  const zoom = view?.getZoom()
  if (!amap || basemap.value !== 'amap' || !center || zoom === undefined) return
  const signature = [zoom, ...center].join(',')
  if (lastAmapView === signature) return
  lastAmapView = signature
  amap.setZoomAndCenter(zoom, toLonLat(center), true)
}
const tilesActive = ref(false)
const overviewActive = ref(false)
let overviewUnavailable = overview.source !== WIGOS_COLLECTION_URL
const pendingTiles = new Set<unknown>()
const realtimeTileSource = new VectorTileSource({
  format: new MVT({ layers: ['hits'] }),
  url: WIGOS_TILES_URL,
  wrapX: false,
})
const overviewTileSource = new VectorTileSource({
  format: new MVT({ layers: ['hits'] }),
  url: `${import.meta.env.BASE_URL}${overview.path}`,
  tileSize: overview.tileSize,
  maxZoom: overview.maxZoom,
  wrapX: false,
})
let tileSource = overviewTileSource
const tileStyles = Object.fromEntries(Object.entries(domainColors).map(([domain, color]) => [domain, dotStyle(color, 2.5)])) as Record<StationDomain, Style>
const stationTiles = new VectorTileLayer({
  source: tileSource,
  visible: false,
  declutter: false,
  style: feature => {
    if (feature.get('layer') !== 'hits') return undefined
    return tileStyles[facilityTypeDomain(feature.get('properties.facilityType.id') ?? '')]
  },
})
function selectStationSource() {
  const local = tilesActive.value && !overviewUnavailable && (mapRef.value?.getView().getZoom() ?? DEFAULT_ZOOM) < overview.maxZoom + 1
  overviewActive.value = local
  const next = local ? overviewTileSource : realtimeTileSource
  if (tileSource === next) return
  pendingTiles.clear()
  tileSource = next
  stationTiles.setSource(next)
  hoverRequestVersion++
  hover.value = null
  hoverKey = ''
  popupPinned.value = false
  isOverPopup.value = false
  mapError.value = ''
  loading.value = false
}
function tileFinished(tile: unknown) {
  pendingTiles.delete(tile)
  if (tilesActive.value) loading.value = pendingTiles.size > 0
}
for (const source of [overviewTileSource, realtimeTileSource]) {
  source.on('tileloadstart', event => {
    if (source !== tileSource) return
    pendingTiles.add(event.tile)
    if (tilesActive.value) loading.value = true
  })
  source.on('tileloadend', event => { if (source === tileSource) tileFinished(event.tile) })
  source.on('tileloaderror', event => {
    if (source !== tileSource) return
    tileFinished(event.tile)
    if (source === overviewTileSource) {
      overviewUnavailable = true
      selectStationSource()
    } else if (tilesActive.value) mapError.value = locale.value === 'zh' ? '站点瓦片加载失败，请重试' : 'Station tiles failed to load. Please retry.'
  })
}
const loading = ref(false)
const mapError = ref('')
const matchedCount = ref(0)
const mapLoaded = ref(0)
const mapLoadTotal = ref(0)
const filteredSnapshotDate = ref('')
const filteredUnmapped = ref(0)
let viewportController: AbortController | undefined
let lastMove = 0
let pendingTimer = 0
let hideTimer = 0
let hoverKey = ''
let hoverRequestVersion = 0
let viewportTimer = 0
let loadSeq = 0

const liveFeatures = shallowRef<WigosFeature[]>([])
const detailCache: Record<string, WigosFeature> = {}

const LAND_FILL = '#f2f5ef'
const LAND_STROKE = '#8fa89c'
const GRID_STROKE = 'rgba(120, 150, 160, 0.35)'

function graticuleLines(step = 20): Feature[] {
  const features: Feature[] = []
  for (let lon = -180; lon <= 180; lon += step) {
    features.push(new Feature({ geometry: new LineString([fromLonLat([lon, -80]), fromLonLat([lon, 80])]) }))
  }
  for (let lat = -80; lat <= 80; lat += step) {
    features.push(new Feature({ geometry: new LineString([fromLonLat([-180, lat]), fromLonLat([180, lat])]) }))
  }
  return features
}

function landFeatures(): Feature<Geometry>[] {
  const feats: Feature<Geometry>[] = WORLD_LAND.map(
    (ring) => new Feature({ geometry: new Polygon([ring.map(([lon, lat]) => fromLonLat([lon, lat]))]) }),
  )
  for (const [lon, lat] of WORLD_ISLANDS) {
    const f = new Feature({ geometry: new Point(fromLonLat([lon, lat])), island: true })
    f.setStyle(
      new Style({
        image: new CircleStyle({
          radius: 1.6,
          fill: new Fill({ color: LAND_FILL }),
          stroke: new Stroke({ color: LAND_STROKE, width: 0.7 }),
        }),
      }),
    )
    feats.push(f)
  }
  return feats
}

const landSource = new VectorSource({ wrapX: false })
const gridLayer = new VectorLayer({
  source: new VectorSource({ features: graticuleLines(), wrapX: false }),
  style: new Style({ stroke: new Stroke({ color: GRID_STROKE, width: 1 }) }),
})

const landLayer = new VectorLayer({
  source: landSource,
  style: new Style({
    fill: new Fill({ color: LAND_FILL }),
    stroke: new Stroke({ color: LAND_STROKE, width: 1.2 }),
  }),
})

let worldLoaded = false
async function loadWorldLand() {
  if (worldLoaded) return
  worldLoaded = true
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}data/world-countries.geojson`)
    if (!res.ok) throw new Error(`world land ${res.status}`)
    const data = await res.json()
    const features = new GeoJSON().readFeatures(data, {
      dataProjection: 'EPSG:4326',
      featureProjection: 'EPSG:3857',
    }) as Feature<Geometry>[]
    landSource.clear()
    landSource.addFeatures(features)
  } catch {
    landSource.clear()
    landSource.addFeatures(landFeatures())
  }
}

function dotStyle(color: string, radius = 2) {
  return new Style({
    image: new CircleStyle({
      radius,
      fill: new Fill({ color }),
      stroke: new Stroke({ color: '#ffffff', width: 0.8 }),
    }),
  })
}

function clusterFeaturesByDistance(features: Feature[], distance: number): Feature[] {
  if (!(distance > 0)) return features
  type Group = { seed: Feature; x: number; y: number; count: number }
  const buckets = new globalThis.Map<string, Group[]>()
  const groups: Group[] = []
  const identity = (feature: Feature) => String(feature.get('wigosId') ?? feature.get('station')?.wigosId ?? '')
  // Stable seeds keep results independent of page arrival order. A seed is an
  // actual station, never a cell centre or averaged coordinate.
  const ordered = [...features].sort((a, b) => identity(a).localeCompare(identity(b)))
  const radiusSquared = distance * distance
  for (const feature of ordered) {
    const [x, y] = (feature.getGeometry() as Point).getCoordinates() as [number, number]
    const col = Math.floor(x / distance), row = Math.floor(y / distance)
    const domain = String(feature.get('domain'))
    let nearest: Group | undefined
    let best = radiusSquared
    // Buckets only accelerate neighbour lookup. The circular distance test
    // spans bucket boundaries and determines membership, not the grid cell.
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      for (const group of buckets.get(`${col + dx},${row + dy},${domain}`) ?? []) {
        const squared = (x - group.x) ** 2 + (y - group.y) ** 2
        if (squared <= radiusSquared && (!nearest || squared < best)) { nearest = group; best = squared }
      }
    }
    if (nearest) nearest.count++
    else {
      const group = { seed: feature, x, y, count: 1 }
      const key = `${col},${row},${domain}`
      const bucket = buckets.get(key) ?? []
      bucket.push(group); buckets.set(key, bucket); groups.push(group)
    }
  }
  return groups.map(({ seed, count }) => {
    if (count === 1) return seed
    const cluster = new Feature({ geometry: seed.getGeometry()!.clone(), cluster: true, count,
      domain: seed.get('domain'), representativeId: identity(seed) })
    cluster.setStyle(seed.getStyle())
    return cluster
  })
}

function buildCloud(): Feature[] {
  const stations = props.visibleStations ?? liveFeatures.value.flatMap(f => {
    const station = featureToStation(f)
    return station ? [station] : []
  })
  const features = stations.map(s => {
    const feature = new Feature({ geometry: new Point(mapCoordinate(s.lon, s.lat)), station: s, domain: s.domain,
      wigosId: props.visibleStations ? undefined : s.wigosId })
    feature.setStyle(tileStyles[s.domain])
    return feature
  })
  const view = mapRef.value?.getView()
  const zoom = view?.getZoom() ?? DEFAULT_ZOOM
  if (zoom >= 6) return features
  const distance = (view?.getResolution() ?? 40000) * (zoom < 4 ? 16 : 8)
  return clusterFeaturesByDistance(features, distance)
}

function stationToHover(s: Station): HoverInfo {
  return {
    title: s.name || s.wigosId,
    wigosId: s.wigosId,
    type: s.type,
    status: s.status,
    programs: s.programs,
    established: s.established,
    closed: s.status === 'Closed' ? s.established : undefined,
    stationId: s.id,
  }
}

function hoverFromFeature(feature: WigosFeature): HoverInfo {
  const s = featureToStation(feature)
  if (s) {
    return {
      title: feature.properties.title || s.name || feature.id,
      wigosId: s.wigosId,
      type: s.type,
      status: s.status,
      programs: s.programs,
      established: s.established,
      closed: s.status === 'Closed' ? s.established : undefined,
      stationId: s.id,
    }
  }
  return {
    title: feature.properties.title || feature.id,
    wigosId: feature.id,
    type: facilityTypeTitle(feature.properties.facilityType?.id) || 'unknown',
    status: featureStatus(feature),
    programs: featureProgramIds(feature).map((id) => programTitle(id)).join(', '),
    established: featureEstablished(feature),
    closed: featureClosed(feature) || undefined,
  }
}

function onPointerMove(evt: { pixel: number[]; coordinate: number[]; originalEvent: PointerEvent }) {
  const map = mapRef.value
  if (!map) return
  if (isOverPopup.value) return
  const now = Date.now()
  if (now - lastMove < 120) return
  lastMove = now
  window.clearTimeout(pendingTimer)
  const [px, py] = evt.pixel
  const pointerVersion = ++hoverRequestVersion
  pendingTimer = window.setTimeout(async () => {
    if (isOverPopup.value) return
    const tileHits = tilesActive.value ? await stationTiles.getFeatures(evt.pixel) : []
    if (pointerVersion !== hoverRequestVersion || isOverPopup.value || mapRef.value !== map) return
    const hit = tileHits[0] ?? map.forEachFeatureAtPixel(evt.pixel, (f) => f, {
      hitTolerance: 6,
      layerFilter: layer => layer === stationTiles || layer === vectorRef.value,
    }) as Feature | undefined
    const station = (hit?.get('station') as Station | undefined) ?? null
    const wigosId = (hit?.get('wigosId') ?? hit?.get('id') ?? hit?.get('_id')) as string | undefined
    const key = wigosId || (station ? station.wigosId : '')
    const count = Number(hit?.get('count') ?? 1)
    if (count > 1) {
      window.clearTimeout(hideTimer)
      hoverKey = ''
      popupPos.value = clampPopup(px + 14, py + 14)
      hover.value = { title: locale.value === 'zh' ? `${count} 个站点` : `${count} stations`, count, wigosId: '', type: '', status: '', programs: '', established: '' }
      const target = map.getTargetElement()
      if (target) target.style.cursor = 'pointer'
      return
    }
    if (station && !wigosId) {
      if (!hover.value || hoverKey !== key) {
        hoverKey = key
        popupPos.value = clampPopup(px + 14, py + 14)
      }
      window.clearTimeout(hideTimer)
      hover.value = stationToHover(station)
    } else if (wigosId) {
      if (!hover.value || hoverKey !== key) {
        hoverKey = key
        popupPos.value = clampPopup(px + 14, py + 14)
        const cached = detailCache[wigosId]
        const source = cached ?? liveFeatures.value.find((f) => f.id === wigosId)
        if (source && !source.mapSummary) hover.value = hoverFromFeature(source)
        else {
          // Tile features are not in liveFeatures. Show their summary immediately
          // so the asynchronous full-record response can update the same popup.
          hover.value = {
            title: source?.properties.title || hit?.get('properties.title') || wigosId,
            wigosId,
            type: facilityTypeTitle(source?.properties.facilityType?.id ?? hit?.get('properties.facilityType.id')) || '—',
            status: '—',
            programs: hit?.get('properties.observations.programAffiliations.programAffiliation.id') || '—',
            established: '—',
          }
        }
      }
      window.clearTimeout(hideTimer)
      if (!detailCache[wigosId]) {
        downloadError.value = ''
        void getFeature(wigosId)
          .then((feature) => {
            if (!feature || hover.value?.wigosId !== wigosId) return
            detailCache[wigosId] = feature
            hover.value = hoverFromFeature(feature)
          })
          .catch(() => {
            if (hover.value?.wigosId === wigosId) {
              downloadError.value = locale.value === 'zh' ? '站点详情加载失败，当前显示瓦片摘要；移开后重新悬停可重试。' : 'Station details failed to load. Tile summary shown; hover again to retry.'
            }
          })
      }
    } else {
      window.clearTimeout(hideTimer)
      hideTimer = window.setTimeout(() => {
        if (!isOverPopup.value && !popupPinned.value) {
          hover.value = null
          hoverKey = ''
        }
      }, 500)
    }
    const target = map.getTargetElement()
    if (target) target.style.cursor = hover.value ? 'pointer' : ''
  }, 60)
}

function clampPopup(x: number, y: number) {
  const wrap = wrapEl.value
  const W = 248
  const H = 360
  const maxX = Math.max(8, (wrap?.clientWidth ?? 800) - W - 8)
  const maxY = Math.max(8, (wrap?.clientHeight ?? 520) - H - 8)
  return { x: Math.min(Math.max(8, x), maxX), y: Math.min(Math.max(8, y), maxY) }
}

function onPopupEnter() {
  isOverPopup.value = true
  popupPinned.value = true
  window.clearTimeout(hideTimer)
}

function onPopupLeave() {
  isOverPopup.value = false
  popupPinned.value = false
  window.clearTimeout(hideTimer)
  hideTimer = window.setTimeout(() => {
    hover.value = null
    hoverKey = ''
  }, 250)
}

async function runDownload(format: 'xml' | 'json') {
  if (!hover.value || downloading.value) return
  const id = hover.value.wigosId
  downloading.value = true
  downloadError.value = ''
  dlOpen.value = false
  try {
    await downloadCatalogueRecord(id, format)
  } catch (cause) {
    downloadError.value = t('stationReport.downloadError', {
      message: cause instanceof Error ? cause.message : String(cause),
    })
  } finally {
    downloading.value = false
  }
}

const downloadXml = () => runDownload('xml')
const downloadWmdrV2 = () => runDownload('json')
function currentBbox(): [number, number, number, number] | null {
  const map = mapRef.value
  if (!map) return null
  const view = map.getView()
  const ext = view.calculateExtent(map.getSize())
  let [minLon, minLat, maxLon, maxLat] = transformExtent(ext, 'EPSG:3857', 'EPSG:4326')
  if (basemap.value === 'amap') {
    const [gcjWest, gcjSouth] = toGcj02(minLon, minLat)
    const [gcjEast, gcjNorth] = toGcj02(maxLon, maxLat)
    minLon += minLon - gcjWest
    minLat += minLat - gcjSouth
    maxLon += maxLon - gcjEast
    maxLat += maxLat - gcjNorth
  }
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
  // A wrapped viewport must include both sides of the date line.
  // Query all longitudes when crossing it; never silently clip away one side.
  const width = maxLon - minLon
  const west = ((minLon + 180) % 360 + 360) % 360 - 180
  const crossesDateLine = width >= 360 || west + width > 180
  const lonMin = crossesDateLine ? -180 : west
  const lonMax = crossesDateLine ? 180 : west + width
  const latMin = clamp(minLat, -85, 85)
  const latMax = clamp(maxLat, -85, 85)
  if (lonMax <= lonMin || latMax <= latMin) return null
  return [lonMin, latMin, lonMax, latMax]
}

function selectedProgramIds(): string[] {
  return (filterPrograms.value ?? [])
    .map((id) => programIdByTitle(id) ?? id)
    .filter(Boolean)
}

async function loadViewport() {
  if (props.visibleStations) return
  viewportController?.abort()
  const countryId = filterCountry.value ? findTerritoryId(filterCountry.value) : undefined
  const query: FacilitySearchParams = props.mapQuery ?? {
    territories: countryId ? [countryId] : [],
    types: filterType.value ? [filterType.value] : [],
    programs: selectedProgramIds(),
  }
  const wasTiles = tilesActive.value
  filteredSnapshotDate.value = ''
  filteredUnmapped.value = 0
  mapLoaded.value = 0
  mapLoadTotal.value = 0
  tilesActive.value = useMapTiles(query)
  selectStationSource()
  stationTiles.setVisible(tilesActive.value)
  if (tilesActive.value) {
    loadSeq++
    liveFeatures.value = []
    vectorRef.value?.getSource()?.clear()
    hover.value = null
    selected.value = null
    const retry = wasTiles && !!mapError.value
    mapError.value = ''
    loading.value = pendingTiles.size > 0
    if (retry) tileSource.refresh()
    return
  }
  const bbox = currentBbox()
  if (!bbox) return
  const controller = new AbortController()
  viewportController = controller
  const seq = ++loadSeq
  loading.value = true
  mapError.value = ''
  matchedCount.value = 0
  liveFeatures.value = []
  vectorRef.value?.getSource()?.clear()
  hover.value = null
  selected.value = null
  const received = new globalThis.Map<string, WigosFeature>()
  let paintTimer = 0
  const paint = () => {
    window.clearTimeout(paintTimer)
    paintTimer = 0
    if (seq !== loadSeq || controller.signal.aborted) return
    liveFeatures.value = [...received.values()]
    matchedCount.value = received.size
    const source = vectorRef.value?.getSource()
    source?.clear()
    source?.addFeatures(buildCloud())
  }
  try {
    const result = await loadFilteredMap({ ...query, bbox, signal: controller.signal }, (delta, loaded, total) => {
      if (seq !== loadSeq || controller.signal.aborted) return
      for (const feature of delta) received.set(feature.id, feature)
      mapLoaded.value = loaded
      mapLoadTotal.value = total
      if (!paintTimer) paintTimer = window.setTimeout(paint, 150)
    })
    if (seq === loadSeq && !controller.signal.aborted) {
      received.clear()
      for (const feature of result.features) received.set(feature.id, feature)
      paint()
      filteredSnapshotDate.value = result.snapshotDate ?? ''
      filteredUnmapped.value = result.unmapped
    }
  } catch (cause) {
    if (seq === loadSeq && !controller.signal.aborted) mapError.value = cause instanceof Error ? cause.message : String(cause)
  } finally {
    window.clearTimeout(paintTimer)
    if (seq === loadSeq) loading.value = false
  }
}

onMounted(() => {
  if (!mapEl.value) return
  const vector = new VectorLayer({
    source: new VectorSource({ features: buildCloud(), wrapX: false }),
    declutter: false,
  })
  vectorRef.value = vector
  const map = new Map({
    target: mapEl.value,
    pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
    controls: defaultControls({ zoom: false, rotate: false }).extend([
      new ScaleLine({ units: 'metric', minWidth: 100 }),
    ]),
    layers: [gridLayer, landLayer, osmLayer, ...tiandituLayers, stationTiles, vector],
    view: new View({
      center: fromLonLat(DEFAULT_CENTER),
      zoom: DEFAULT_ZOOM,
      minZoom: -2,
      maxZoom: 18,
      extent: WORLD_EXTENT,
      constrainOnlyCenter: true,
      constrainResolution: false,
      smoothResolutionConstraint: true,
      showFullExtent: false,
    }),
  })
  map.on('singleclick', async (evt) => {
    if (tilesActive.value) {
      const source = tileSource
      const hits = await stationTiles.getFeatures(evt.pixel)
      if (mapRef.value !== map || !tilesActive.value || source !== tileSource) return
      if (Number(hits[0]?.get('count') ?? 1) > 1) {
        map.getView().animate({ center: evt.coordinate, zoom: Math.min(overview.maxZoom + 1, (map.getView().getZoom() ?? 2) + 2), duration: 250 })
        return
      }
    }
    identifying.value = true
    window.setTimeout(() => {
      identifying.value = false
    }, 250)
    const hit = map.forEachFeatureAtPixel(evt.pixel, (feat) => feat)
    if (hit?.get('cluster')) {
      map.getView().animate({ center: (hit.getGeometry() as Point).getCoordinates(), zoom: (map.getView().getZoom() ?? 2) + 2, duration: 250 })
      return
    }
    selected.value = (hit?.get('station') as Station | undefined) ?? null
  })
  map.on('pointermove', (e) => onPointerMove(e as unknown as { pixel: number[]; coordinate: number[]; originalEvent: PointerEvent }))
  map.on('postrender', syncAmap)
  map.on('movestart', () => { viewportController?.abort(); loadSeq++; if (!tilesActive.value) loading.value = false })
  map.on('moveend', () => {
    if (!tilesActive.value) {
      const source = vectorRef.value?.getSource()
      source?.clear()
      source?.addFeatures(buildCloud())
    }
    window.clearTimeout(viewportTimer)
    viewportTimer = window.setTimeout(() => void loadViewport(), 400)
  })
  ;(map.getTargetElement() as HTMLElement | null)?.addEventListener('pointerleave', () => {
    window.clearTimeout(hideTimer)
    hideTimer = window.setTimeout(() => {
      if (!isOverPopup.value) {
        hover.value = null
        hoverKey = ''
      }
    }, 500)
  })
  mapRef.value = map
  fitWorld()
  map.getView().on('change:resolution', () => { if (tilesActive.value) selectStationSource() })
  void loadWorldLand()
  if (!props.visibleStations) {
    void loadViewport()
  }
  resizeObserver.value = new ResizeObserver(() => {
    const view = map.getView()
    const previousSize = map.getSize()
    const previousWorldZoom = previousSize ? view.getZoomForResolution((WORLD_EXTENT[2]! - WORLD_EXTENT[0]!) / previousSize[0]!) : undefined
    const showingWorld = basemap.value === 'osm' && previousWorldZoom != null && Math.abs((view.getZoom() ?? 0) - previousWorldZoom) < 0.05
    map.updateSize()
    if (showingWorld) fitWorld()
  })
  resizeObserver.value.observe(mapEl.value)
  void selectBasemap({ target: { value: selectedBasemap.value } } as unknown as Event)
})

watch(() => props.visibleStations, () => {
  const source = vectorRef.value?.getSource()
  if (!source || !props.visibleStations) return
  window.clearTimeout(pendingTimer)
  window.clearTimeout(hideTimer)
  source.clear()
  source.addFeatures(buildCloud())
  selected.value = null
  hover.value = null
  hoverKey = ''
  popupPinned.value = false
  isOverPopup.value = false
  dlOpen.value = false
})

watch(() => props.mapQuery, () => {
  viewportController?.abort()
  loadSeq++
  filteredSnapshotDate.value = ''
  mapLoaded.value = 0
  mapLoadTotal.value = 0
  loading.value = true
  window.clearTimeout(viewportTimer)
  viewportTimer = window.setTimeout(() => void loadViewport(), 350)
}, { deep: true })

watch([focusedStation, filterCountry, filterType, filterPrograms, filterStatuses], () => {
  if (props.visibleStations) return
  if (focusedStation.value) flyToFocusedStation()
  void loadViewport()
})

onBeforeUnmount(() => {
  viewportController?.abort()
  loadSeq++
  selectionVersion++
  cancelAmapLoad?.()
  amap?.destroy()
  amap = undefined
  resizeObserver.value?.disconnect()
  window.clearTimeout(pendingTimer)
  window.clearTimeout(hideTimer)
  window.clearTimeout(viewportTimer)
  hoverRequestVersion++
  mapRef.value?.setTarget(undefined)
  mapRef.value = null
})

function zoomBy(delta: number) {
  const view = mapRef.value?.getView()
  if (!view) return
  const zoom = view.getZoom() ?? 2
  view.animate({ zoom: zoom + delta, duration: 180 })
}

function fitWorld(duration = 0) {
  const map = mapRef.value
  const size = map?.getSize()
  if (!map || !size?.[0]) return
  const view = map.getView()
  // Fill wide containers with one world; polar latitudes may fall outside the viewport.
  const resolution = (WORLD_EXTENT[2]! - WORLD_EXTENT[0]!) / size[0]
  view.animate({ center: fromLonLat(DEFAULT_CENTER), resolution, duration })
}

function resetView() {
  const world = basemap.value === 'osm'
  if (world) {
    fitWorld(250)
    return
  }
  mapRef.value?.getView().animate({
    center: world ? fromLonLat(DEFAULT_CENTER) : mapCoordinate(CHINA_CENTER[0], CHINA_CENTER[1]),
    zoom: world ? DEFAULT_ZOOM : CHINA_ZOOM,
    duration: 250,
  })
}

async function selectBasemap(event: Event) {
  const select = event.target as HTMLSelectElement
  const next = select.value as Basemap
  const version = ++selectionVersion
  cancelAmapLoad?.()
  basemapStatus.value = ''
  if (next === basemap.value) return

  if ((next === 'amap' && !amapConfigured) || (next === 'tianditu' && !tiandituKey)) {
    select.value = basemap.value
    basemapStatus.value = 'map.basemapMissingKey'
    return
  }

  if (next === 'amap') {
    basemapStatus.value = 'common.loading'
    try {
      const api = await loadAmap()
      if (version !== selectionVersion || !amapEl.value) return
      const instance = new api.Map(amapEl.value, {
        viewMode: '2D', center: toGcj02(CHINA_CENTER[0], CHINA_CENTER[1]), zoom: CHINA_ZOOM, zooms: [2, 18],
        // zoomEnable also controls setZoomAndCenter; pointer-events blocks SDK input.
        dragEnable: false, zoomEnable: true, keyboardEnable: false,
        animateEnable: false, resizeEnable: true,
        doubleClickZoom: false, scrollWheel: false, touchZoom: false,
      })
      await new Promise<void>((resolve, reject) => {
        const fail = () => {
          window.clearTimeout(timer)
          cancelAmapLoad = undefined
          instance.destroy()
          reject(new Error('AMap initialization interrupted'))
        }
        const timer = window.setTimeout(fail, 15000)
        cancelAmapLoad = fail
        instance.on('complete', () => {
          if (cancelAmapLoad !== fail) return
          window.clearTimeout(timer)
          cancelAmapLoad = undefined
          resolve()
        })
      })
      if (version !== selectionVersion) {
        instance.destroy()
        return
      }
      amap = instance
      lastAmapView = ''
    } catch {
      if (version === selectionVersion) {
        select.value = basemap.value
        basemapStatus.value = 'map.basemapLoadError'
      }
      return
    }
  } else {
    amap?.destroy()
    amap = undefined
  }

  basemapStatus.value = ''
  basemap.value = next
  rememberBasemap(next)
  osmLayer.setVisible(next === 'osm')
  tiandituLayers.forEach((layer) => layer.setVisible(next === 'tianditu'))
  gridLayer.setVisible(next !== 'amap')
  landLayer.setVisible(next !== 'amap')
  const source = vectorRef.value?.getSource()
  source?.clear()
  source?.addFeatures(buildCloud())
  hover.value = null
  hoverKey = ''
  popupPinned.value = false
  const view = mapRef.value?.getView()
  view?.cancelAnimations()
  view?.setMinZoom(next === 'amap' ? 2 : next === 'tianditu' ? 1 : -2)
  view?.setCenter(next === 'osm' ? fromLonLat(DEFAULT_CENTER) : mapCoordinate(CHINA_CENTER[0], CHINA_CENTER[1]))
  view?.setZoom(next === 'osm' ? DEFAULT_ZOOM : CHINA_ZOOM)
  if (next === 'osm') fitWorld()
  syncAmap()
}

function flyToFocusedStation() {
  const map = mapRef.value
  const focus = focusedStation.value
  if (!map || !focus || props.visibleStations) return
  selected.value = focus
  hover.value = stationToHover(focus)
  hoverKey = focus.wigosId
  popupPinned.value = true
  const view = map.getView()
  view.animate({ center: mapCoordinate(focus.lon, focus.lat), zoom: Math.max(view.getZoom() ?? 2.2, 6), duration: 600 }, () => {
    const px = map.getPixelFromCoordinate(mapCoordinate(focus.lon, focus.lat))
    if (px) popupPos.value = clampPopup(px[0] + 14, px[1] + 14)
  })
}
</script>
<style scoped lang="scss">
.map-data-status { position: absolute; bottom: 30px; left: 12px; right: 12px; z-index: 5; padding: 6px 10px; background: #fffffff0; border-radius: 5px; font-size: 12px; overflow-wrap: anywhere; }
.overview-note { margin: 4px 16px; font-size: 11px; color: #586e83; }
.oscar-map-shell {
  position: relative;
  padding: 0 0 14px;
}

.oscar-ol-wrap {
  position: relative;
  overflow: hidden;
  border: 1px solid #dce6ef;
  border-radius: 12px;
  background: #dcebf3;
  margin: 0 16px;
}

.oscar-ol-map {
  position: relative;
  width: 100%;
  height: 520px;
}

.oscar-map-wait {
  position: absolute;
  top: 10px;
  left: 16px;
  z-index: 5;
  background: coral;
  color: #fff;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
}

.oscar-map-loading {
  position: absolute;
  left: 50%;
  bottom: 14px;
  transform: translateX(-50%);
  z-index: 5;
  background: rgba(0, 91, 171, 0.9);
  color: #fff;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 11px;
  pointer-events: none;
}

.identify-popup {
  position: absolute;
  z-index: 6;
  width: 240px;
  max-height: 340px;
  overflow: auto;
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid #a9bfd4;
  border-radius: 4px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);
  font-size: 12px;
  color: #222;
  pointer-events: auto;
}

.identify-popup__title {
  display: block;
  overflow-wrap: anywhere;
  padding: 6px 8px;
  border-bottom: 1px solid #d5e3ef;
  font-weight: 600;
  background: #fff;
  color: #222;
}

.identify-popup__title-link {
  color: #005288;
  text-decoration: none;
}

.identify-popup__title-link:hover,
.identify-popup__title-link:focus-visible {
  text-decoration: underline;
}

.identify-popup__body {
  padding: 6px 8px;
  line-height: 1.45;
  white-space: pre-line;
}

.identify-popup__body b {
  color: #000;
}

.identify-popup__actions {
  display: flex;
  gap: 6px;
  padding: 8px;
  border-top: 1px solid #d5e3ef;
  background: #f6f9fc;
}

.identify-popup__actions .btn-xs {
  font-size: 11px;
  padding: 3px 8px;
  text-decoration: none;
}

.identify-popup__actions .dl-wrap {
  position: relative;
  display: inline-block;
}

.identify-popup__actions .dl-menu {
  position: absolute;
  left: 0;
  bottom: calc(100% + 4px);
  z-index: 10;
  min-width: 180px;
  background: #fff;
  border: 1px solid #a9bfd4;
  border-radius: 4px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);
  padding: 4px;
  display: flex;
  flex-direction: column;
}

.identify-popup__actions .dl-menu button {
  border: 0;
  background: transparent;
  text-align: left;
  font-size: 11px;
  color: #222;
  padding: 6px 8px;
  border-radius: 3px;
  cursor: pointer;
  white-space: nowrap;
}

.identify-popup__actions .dl-menu button:hover {
  background: var(--oscar-theme-soft);
  color: var(--oscar-theme);
}

.oscar-legend {
  position: absolute;
  top: 14px;
  right: 58px;
  left: auto;
  z-index: 4;
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.94);
  border: 1px solid #dce6ef;
  color: #35536e;
  font-size: 12px;
  min-width: 128px;
  box-shadow: 0 2px 10px rgba(0, 91, 171, 0.08);
}

.oscar-legend__title {
  font-weight: 700;
  margin-bottom: 6px;
}

.oscar-legend__item {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 4px 0;
}

.oscar-legend__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.oscar-map-tools {
  position: absolute;
  top: 14px;
  right: 14px;
  z-index: 4;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.oscar-map-tools button {
  width: 34px;
  height: 34px;
  border: 1px solid #dce6ef;
  border-radius: 8px;
  background: #fff;
  color: var(--oscar-theme);
  font-size: 18px;
  line-height: 1;
  padding: 0;
}

.oscar-map-tools button:hover,
.oscar-map-tools button:focus-visible {
  background: var(--oscar-theme-soft);
  border-color: var(--oscar-theme);
}

.oscar-map-tools__icon svg {
  width: 16px;
  height: 16px;
}

.oscar-amap {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.oscar-map-layers {
  position: absolute;
  left: 14px;
  top: 14px;
  z-index: 4;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
}

.oscar-map-layers select,
.oscar-map-layers span {
  padding: 6px 8px;
  border: 1px solid #dce6ef;
  border-radius: 8px;
  background: #fff;
  color: #35536e;
  font-size: 12px;
}

.oscar-infobox {
  margin-top: 10px;
  padding: 10px 12px;
  border: 1px solid #dce6ef;
  border-radius: 10px;
  background: #fff;
  color: #35536e;
  font-size: 12px;
}

.oscar-infobox a {
  color: var(--oscar-theme);
}

.oscar-ol-wrap :deep(.ol-scale-line) {
  left: 14px;
  bottom: 12px;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 4px;
}

.oscar-ol-wrap :deep(.ol-scale-line-inner) {
  border-color: #35536e;
  color: #35536e;
  font-size: 11px;
}

.oscar-ol-wrap :deep(.ol-attribution) {
  background: transparent;
  color: #687e90;
  font-size: 10px;
}
</style>



