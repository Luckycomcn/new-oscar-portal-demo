<template>
  <div class="srd">
    <div v-if="loading" class="state">{{ $t('common.loading') }}</div>
    <div v-else-if="error" class="state" role="alert">
      {{ $t('stationReport.loadError') }}
      <button type="button" class="btn-edit" @click="load">{{ $t('common.retry') }}</button>
    </div>
    <div v-else-if="!report" class="state">{{ $t('stationReport.notFound') }}</div>

    <template v-else>
      <div class="srd-head">
        <div>
          <h1>{{ report.name }} <span v-if="report.territories.length" class="muted">({{ report.territories.join(', ') }})</span></h1>
          <div class="srd-sub">
            {{ $t('stationReport.inRegion', { region: report.wmoRegion || '—' }) }}
            <span class="dot">·</span>
            <a :href="catalogueUrl" target="_blank" rel="noopener">{{ $t('stationReport.openInCatalogue') }}</a>
          </div>
        </div>
        <div class="srd-head-right">
          <span v-if="report.created">{{ $t('stationReport.recordCreated') }} {{ report.created.slice(0, 10) }}</span>
          <span class="dl-wrap" @mouseenter="dlOpen = true" @mouseleave="dlOpen = false">
            <button type="button" class="btn-dl" :disabled="downloading" @click="dlOpen = !dlOpen">
              {{ downloading ? $t('stationReport.generating') : $t('stationReport.download') }} ▾
            </button>
            <span v-show="dlOpen" class="dl-menu">
              <button type="button" @click="downloadXml">{{ $t('stationReport.xml') }}</button>
              <button type="button" @click="downloadWmdrV2">{{ $t('stationReport.wmdrV2') }}</button>
            </span>
          </span>
        </div>
      </div>

      <p v-if="downloadError" class="info" role="alert">{{ downloadError }}</p>
      <!-- Station characteristics -->
      <section class="panel">
        <h2>{{ $t('stationReport.stationCharacteristics') }}</h2>
        <div class="cols">
          <dl class="kv">
            <dt>{{ $t('stationReport.name') }}</dt><dd>{{ report.name }}</dd>
            <dt>{{ $t('stationReport.wigosIds') }}</dt>
            <dd>
              <table class="mini">
                <tr><th>{{ $t('stationReport.thWigosId') }}</th><th>{{ $t('stationReport.thPrimary') }}</th></tr>
                <tr><td>{{ report.id }}</td><td>true</td></tr>
              </table>
            </dd>
            <dt>{{ $t('stationReport.stationType') }}</dt>
            <dd>{{ report.facilityType }} </dd>
            <dt>{{ $t('stationReport.wmoRegion') }}</dt>
            <dd>{{ report.wmoRegion }} </dd>
            <dt>{{ $t('stationReport.territory') }}</dt>
            <dd>{{ report.territories.join(', ') || '—' }} </dd>
            <dt>{{ $t('stationReport.coordinates') }}</dt><dd>{{ coords }}</dd>
            <dt>{{ $t('stationReport.dateEstablished') }}</dt><dd>{{ report.established || '—' }}</dd>
            <dt>{{ $t('stationReport.dateClosed') }}</dt><dd>{{ report.closed || $t('stationReport.stillOperational') }}</dd>
            <dt>{{ $t('stationReport.declaredStatus') }}</dt><dd>{{ report.status }}</dd>
            <dt>{{ $t('stationReport.assessedStatus') }}</dt><dd>{{ report.status }}</dd>
            <dt v-if="report.description">{{ $t('stationReport.siteDescription') }}</dt>
            <dd v-if="report.description">{{ report.description }}</dd>
          </dl>
          <div class="minimap">
            <div ref="miniEl" class="mini-ol"></div>
            <div class="mini-tools"><button type="button" @click="miniZoom(1)">+</button><button type="button" @click="miniZoom(-1)">−</button></div>
            <div class="attr">{{ $t('stationReport.mapAttribution') }}</div>
          </div>
        </div>
        <div class="extra">
          <p><b>{{ $t('stationReport.statusNote') }}</b></p>
        </div>
      </section>

      <section class="panel">
        <h2>{{ $t('stationReport.programmes') }}</h2>
        <div class="info">{{ $t('stationReport.programNote') }}</div>
        <table class="grid">
          <tr><th>{{ $t('stationReport.thProgramme') }}</th><th>{{ $t('stationReport.thDeclaredStatus') }}</th></tr>
          <tr v-for="program in report.programs" :key="program.id">
            <td>{{ program.title }}</td><td>{{ program.status }}</td>
          </tr>
          <tr v-if="!report.programs.length"><td colspan="3">{{ $t('stationReport.noPrograms') }}</td></tr>
        </table>
      </section>

      <section class="panel">
        <h2>{{ $t('stationReport.territoryAssignments') }}</h2>
        <div class="info">{{ $t('stationReport.territoryNote') }}</div>
        <table class="grid">
          <thead><tr><th>{{ $t('stationReport.territory') }}</th><th>{{ $t('stationReport.validFrom') }}</th><th>{{ $t('stationReport.validTo') }}</th></tr></thead>
          <tbody>
            <tr v-for="(assignment, index) in report.territoryAssignments" :key="index">
              <td>{{ assignment.title }}</td>
              <td>{{ assignment.from === '..' ? $t('stationReport.unspecified') : assignment.from?.slice(0, 10) || '—' }}</td>
              <td>{{ assignment.to === '..' ? $t('stationReport.openEnded') : assignment.to?.slice(0, 10) || '—' }}</td>
            </tr>
            <tr v-if="!report.territoryAssignments.length"><td colspan="4">{{ $t('stationReport.noTerritories') }}</td></tr>
          </tbody>
        </table>
      </section>

      <section class="panel">
        <h2>{{ $t('stationReport.observations') }}</h2>
        <div class="info">{{ $t('stationReport.observationsNote') }}</div>
        <div v-for="group in groupedObservations" :key="group.category" class="tree">
          <div class="t1">{{ group.category }}</div>
          <div v-for="(item, observationIndex) in group.items" :key="observationIndex" class="t2">
            ▸{{ item.variable }} <span class="tag" v-if="item.geometry">({{ item.geometry }})</span>
            <div class="t3">
              {{ $t('stationReport.programmesLabel') }} {{ item.programs.map((p) => p.title === p.id ? p.id : `${p.title} (${p.id})`).join(', ') || '—' }}
              <span v-if="item.variableId != null"> · {{ $t('stationReport.observedVariable') }}: {{ item.variable }}</span>
            </div>
            <div v-for="(config, index) in item.configurations" :key="config.id || index" class="t4">
              {{ $t('stationReport.deployments') }}: {{ config.from || '—' }} → {{ config.to === '..' ? $t('stationReport.openEnded') : config.to || '—' }}
              <span v-if="config.method"> · {{ $t('stationReport.method') }} {{ config.method }}</span>
            </div>
          </div>
        </div>
        <div v-if="!report.observations.length" class="info">{{ $t('stationReport.noObservations') }}</div>
      </section>

      <section class="panel">
        <h2>{{ $t('stationReport.contact') }}</h2>
        <table class="grid">
          <tr><th>{{ $t('stationReport.contactRole') }}</th><th>{{ $t('stationReport.organization') }}</th><th>{{ $t('stationReport.mainContact') }}</th><th>{{ $t('stationReport.contactEmail') }}</th></tr>
          <tr v-for="(contact, index) in report.contacts" :key="index">
            <td>{{ contact.roles.join(', ') }}</td>
            <td>{{ contact.organization || '—' }}</td>
            <td>{{ contact.name || '—' }}</td>
            <td>
              <a v-for="email in contact.emails" :key="email" :href="email.startsWith('http') ? email : `mailto:${email}`"><p>{{ email }}</p></a>
              <span v-if="!contact.emails.length">—</span>
            </td>
          </tr>
          <tr v-if="!report.contacts.length"><td colspan="4">{{ $t('stationReport.noContacts') }}</td></tr>
        </table>
      </section>

      <section class="panel">
        <h2>{{ $t('stationReport.links') }}</h2>
        <ul class="links">
          <li v-for="link in report.links" :key="link.href">
            <a :href="link.href" target="_blank" rel="noopener">{{ link.title || link.rel || link.href }}</a>
            <span class="code">{{ link.type }}</span>
          </li>
          <li v-if="!report.links.length">{{ $t('stationReport.noLinks') }}</li>
        </ul>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, shallowRef, watch } from 'vue'
import { useRoute } from 'vue-router'
import Map from 'ol/Map'
import View from 'ol/View'
import TileLayer from 'ol/layer/Tile'
import VectorLayer from 'ol/layer/Vector'
import XYZ from 'ol/source/XYZ'
import VectorSource from 'ol/source/Vector'
import Feature from 'ol/Feature'
import Point from 'ol/geom/Point'
import { fromLonLat } from 'ol/proj'
import { Circle as CircleStyle, Fill, Stroke, Style } from 'ol/style'
import ScaleLine from 'ol/control/ScaleLine'
import { defaults as defaultControls } from 'ol/control/defaults'
import { getFeature, featureToReport, WIGOS_ITEMS_URL, type WigosReport, type ReportObservation } from '../api/wigos'
import { downloadCatalogueRecord } from '../utils/catalogueDownload'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const downloadError = ref('')
const route = useRoute()
const wid = computed(() => String(route.params.wigosId || route.params.id || ''))
const report = ref<WigosReport | null>(null)
const loading = ref(true)
const error = ref(false)
const downloading = ref(false)
const dlOpen = ref(false)
const miniEl = ref<HTMLDivElement | null>(null)
const miniMap = shallowRef<Map | null>(null)

const catalogueUrl = computed(() => `${WIGOS_ITEMS_URL}/${encodeURIComponent(wid.value)}?f=html`)

const coords = computed(() => {
  const r = report.value
  if (!r || r.lat == null || r.lon == null) return '—'
  const lat = `${Math.abs(r.lat).toFixed(5)}°${r.lat >= 0 ? 'N' : 'S'}`
  const lon = `${Math.abs(r.lon).toFixed(5)}°${r.lon >= 0 ? 'E' : 'W'}`
  return `${lat}, ${lon}${r.elevation != null ? `, ${r.elevation} m` : ''}`
})

const groupedObservations = computed(() => {
  const groups: Record<string, ReportObservation[]> = {}
  for (const observation of report.value?.observations ?? []) {
    const key = observation.category || 'Other'
    if (!groups[key]) groups[key] = []
    groups[key].push(observation)
  }
  return Object.entries(groups).map(([category, items]) => ({ category, items }))
})

async function load() {
  loading.value = true
  error.value = false
  report.value = null
  if (!wid.value) {
    loading.value = false
    return
  }
  try {
    const feature = await getFeature(wid.value)
    report.value = feature ? featureToReport(feature) : null
  } catch {
    error.value = true
  } finally {
    loading.value = false
  }
}

async function runDownload(format: 'json' | 'xml') {
  if (downloading.value || !report.value) return
  downloading.value = true
  downloadError.value = ''
  dlOpen.value = false
  try {
    await downloadCatalogueRecord(report.value.id, format)
  } catch (cause) {
    downloadError.value = t('stationReport.downloadError', { message: cause instanceof Error ? cause.message : String(cause) })
  } finally {
    downloading.value = false
  }
}
const downloadXml = () => runDownload('xml')
const downloadWmdrV2 = () => runDownload('json')
function miniZoom(delta: number) {
  const view = miniMap.value?.getView()
  if (view) view.animate({ zoom: (view.getZoom() ?? 8) + delta, duration: 150 })
}

function paintMini() {
  const map = miniMap.value
  const r = report.value
  if (!map || !r || r.lat == null || r.lon == null) return
  const coords: [number, number] = [r.lon, r.lat]
  const feats = [new Feature({ geometry: new Point(fromLonLat(coords)) })]
  feats[0].setStyle(
    new Style({
      image: new CircleStyle({
        radius: 8,
        fill: new Fill({ color: '#0b3d91' }),
        stroke: new Stroke({ color: '#fff', width: 1.5 }),
      }),
    }),
  )
  const layer = map.getLayers().getArray().find((l) => l instanceof VectorLayer) as VectorLayer<VectorSource> | undefined
  layer?.getSource()?.clear()
  layer?.getSource()?.addFeatures(feats)
  map.getView().animate({ center: fromLonLat(coords), zoom: 8, duration: 250 })
}

onMounted(async () => {
  miniMap.value = null
  await load()
  if (!miniEl.value) return
  const center = report.value?.lon != null && report.value?.lat != null
    ? fromLonLat([report.value.lon, report.value.lat])
    : fromLonLat([0, 0])
  miniMap.value = new Map({
    target: miniEl.value,
    controls: defaultControls({ attribution: false, zoom: false, rotate: false }).extend([
      new ScaleLine({ units: 'metric', minWidth: 80 }),
    ]),
    layers: [
      new TileLayer({ source: new XYZ({ url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', crossOrigin: 'anonymous' }) }),
      new VectorLayer({ source: new VectorSource() }),
    ],
    view: new View({ center, zoom: 8, minZoom: 2, maxZoom: 18 }),
  })
  paintMini()
})

watch(wid, async () => {
  await load()
  paintMini()
})
</script>

<style scoped lang="scss">
$srd-ink: #222;
$srd-muted: #666;
$srd-dt: #555;
$srd-theme: var(--oscar-theme);
$srd-line: #dbe8e1;
$srd-panel-head: #eef4f1;
$srd-grid-line: #d5e0da;
$srd-grid-head: #f4f8f6;
$srd-info-bg: #e8f4fd;
$srd-info-line: #bcd9f0;

.srd {
  max-width: 1100px;
  margin: 0 auto;
  font-size: 12px;
  color: $srd-ink;

  &-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 8px;
    gap: 12px;

    h1 {
      font-size: 16px;
      margin: 0;
    }
  }

  &-sub {
    color: $srd-muted;

    .dot {
      margin: 0 6px;
    }
  }

  &-head-right {
    display: flex;
    gap: 8px;
    align-items: center;
    color: $srd-muted;
    font-size: 11px;
    white-space: nowrap;
  }
}

.muted {
  color: $srd-muted;
  font-weight: 400;
}

.code {
  color: #7d8b99;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px;
}

.state {
  padding: 40px 16px;
  text-align: center;
  color: $srd-muted;
}

.btn-edit {
  border: 1px solid $srd-theme;
  background: #fff;
  color: $srd-theme;
  border-radius: 4px;
  padding: 3px 12px;
  cursor: pointer;
}

.btn-dl {
  background: $srd-theme;
  color: #fff;
  border: 1px solid $srd-theme;
  border-radius: 4px;
  padding: 3px 12px;
  cursor: pointer;
}

.dl-wrap {
  position: relative;
  display: inline-block;
}

.dl-menu {
  position: absolute;
  right: 0;
  top: 100%;
  z-index: 20;
  min-width: 190px;
  background: #fff;
  border: 1px solid $srd-line;
  border-radius: 4px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.18);
  padding: 4px;
  display: flex;
  flex-direction: column;

  button {
    border: 0;
    background: transparent;
    text-align: left;
    font-size: 12px;
    color: $srd-ink;
    padding: 7px 10px;
    border-radius: 3px;
    cursor: pointer;
    white-space: nowrap;

    &:hover {
      background: $srd-panel-head;
      color: $srd-theme;
    }
  }
}

.panel {
  border: 1px solid $srd-line;
  border-radius: 6px;
  margin-bottom: 10px;
  background: #fff;

  h2 {
    font-size: 13px;
    background: $srd-panel-head;
    margin: 0;
    padding: 6px 10px;
    border-bottom: 1px solid $srd-line;
  }
}

.cols {
  display: flex;
  gap: 12px;
  padding: 10px;
}

.kv {
  display: grid;
  grid-template-columns: 220px 1fr;
  gap: 3px 10px;
  flex: 1;
  margin: 0;

  dt {
    color: $srd-dt;
    padding: 3px 10px;
  }

  dd {
    margin: 0;
  }
}

.minimap {
  width: 280px;
  flex: none;
  position: relative;

  :deep(.ol-scale-line) {
    left: 8px;
    bottom: 18px;
    background: rgba(255, 255, 255, 0.85);
  }
}

.mini-ol {
  width: 100%;
  height: 230px;
  border: 1px solid #ccc;
  background: #eef3ec;
}

.mini-tools {
  position: absolute;
  left: 8px;
  top: 8px;
  display: flex;
  flex-direction: column;
  background: #fff;
  border: 1px solid #999;
  border-radius: 3px;
  overflow: hidden;

  button {
    width: 26px;
    height: 26px;
    border: 0;
    background: #fff;
    font-size: 16px;
    line-height: 1;
    cursor: pointer;

    + button {
      border-top: 1px solid #999;
    }
  }
}

.attr {
  font-size: 10px;
  color: #888;
  text-align: right;
}

.extra {
  padding: 0 10px 10px;
  color: $srd-muted;
}

table {
  &.grid {
    width: calc(100% - 20px);
    margin: 10px;
    border-collapse: collapse;

    th,
    td {
      border: 1px solid $srd-grid-line;
      padding: 5px 8px;
      text-align: left;
    }

    th {
      background: $srd-grid-head;
    }
  }

  &.mini {
    border-collapse: collapse;

    th,
    td {
      border: 1px solid $srd-grid-line;
      padding: 3px 8px;
    }
  }
}

.info {
  background: $srd-info-bg;
  border: 1px solid $srd-info-line;
  padding: 6px 10px;
  margin: 10px;
  color: #333;
}

.links {
  padding: 4px 22px 4px 28px;

  li {
    margin: 2px 0;
  }
}

.tree {
  padding: 4px 10px;
}

.t1 {
  font-weight: 700;
  margin: 6px 0;
}

.t2 {
  margin-left: 16px;
  border-top: 1px dotted #ccc;
  padding: 4px 0;
}

.tag {
  color: #888;
}

.t3 {
  margin-left: 16px;
  color: #444;
}

.t4 {
  margin-left: 16px;
  color: $srd-muted;
}
</style>


