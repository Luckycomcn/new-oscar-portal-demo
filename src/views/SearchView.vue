<template>
  <div class="station-browser">
    <aside class="criteria-card">
      <header><h2>{{ $t('search.criteria') }}</h2><el-button size="small" @click="reset">{{ $t('common.reset') }}</el-button></header>
      <label class="criterion"><span>{{ $t('search.keyword') }}</span><el-input v-model="keyword" clearable :placeholder="$t('search.keywordPlaceholder')" :prefix-icon="Search" /></label>
      <label v-for="field in fields" :key="field.key" class="criterion">
        <span>{{ field.label }}</span>
        <el-select v-model="filters[field.key]" filterable clearable :placeholder="$t('common.all')" :aria-label="$t('search.filterAria')">
          <el-option v-for="option in field.options" :key="option" :label="option" :value="option" />
        </el-select>
      </label>
    </aside>
    <section class="results-card" :aria-busy="loading">
      <header class="results-header">
        <div><h2>{{ $t('search.results') }}</h2><span>{{ $t('search.remoteCount', { count: total.toLocaleString() }) }}</span></div>
        <div class="mode-switch" :aria-label="$t('search.resultsDisplayMode')">
          <button :class="{ active: mode === 'list' }" @click="mode = 'list'"><el-icon><List /></el-icon> {{ $t('common.list') }}</button>
          <button :class="{ active: mode === 'map' }" @click="mode = 'map'"><el-icon><MapLocation /></el-icon> {{ $t('common.map') }}</button>
        </div>
      </header>
      <div class="active-criteria"><span>{{ $t('search.activeCriteria', { value: activeCriteria.length ? activeCriteria.join(' · ') : $t('search.none') }) }}</span></div>
      <p v-if="loading && mode === 'list'" class="state-message">{{ $t('search.loadingRemote') }}</p>
      <div v-else-if="error && mode === 'list'" class="state-message" role="alert">{{ error }} <el-button @click="loadPage">{{ $t('common.retry') }}</el-button></div>
      <template v-else>
        <div v-show="mode === 'map'" class="map-wrap">
          <OscarMap :map-query="mapQuery" />
        </div>
        <template v-if="mode === 'list'">
          <div class="table-wrap">
            <table>
              <thead><tr><th><button class="sort-button" @click="toggleSort">{{ $t('search.th.stationName') }} {{ ascending ? '↑' : '↓' }}</button></th><th>{{ $t('search.th.type') }}</th><th>{{ $t('search.th.territory') }}</th><th>{{ $t('search.th.position') }}</th><th>{{ $t('search.th.status') }}</th><th>{{ $t('search.th.program') }}</th></tr></thead>
              <tbody><tr v-for="station in paged" :key="station.id">
                <td><router-link :to="{ name: 'stationReportDetails', params: { wigosId: station.wigos } }">{{ station.name }}</router-link><small>{{ station.wigos }}</small></td>
                <td>{{ station.type }}</td><td>{{ station.terr }}</td>
                <td class="position">{{ coordinate(station.lat, true) }}, {{ coordinate(station.lon, false) }}<small>{{ station.elev == null ? '—' : `${station.elev} m` }}</small></td>
                <td><span class="status" :class="{ operational: station.decl === 'Operational' }">{{ station.decl || $t('common.unknown') }}</span></td>
                <td><span v-for="program in station.prog" :key="program" class="program">{{ program }}</span></td>
              </tr><tr v-if="!filtered.length"><td colspan="6" class="state-message">{{ $t('search.noMatching') }}</td></tr></tbody>
            </table>
          </div>
          <footer class="pagination">
            <el-button size="small" :disabled="page <= 1 || loading" :icon="ArrowLeft" :aria-label="$t('common.previousPage')" @click="goPage(page - 1)" />
            <span>{{ $t('search.pagination', { page, count: pageCount, total: total.toLocaleString() }) }}</span>
            <el-button size="small" :disabled="page >= pageCount || loading" :icon="ArrowRight" :aria-label="$t('common.nextPage')" @click="goPage(page + 1)" />
            <select v-model.number="pageSize" :aria-label="$t('common.recordsPerPage')"><option :value="25">25</option><option :value="50">50</option><option :value="100">100</option></select>
          </footer>
        </template>
      </template>
      <footer v-if="fetchedAt" class="data-note">{{ $t('search.remoteNote', { count: filtered.length, total: total.toLocaleString(), date: fetchedAt.slice(0, 10) }) }}</footer>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ArrowLeft, ArrowRight, List, MapLocation, Search } from '@element-plus/icons-vue'
import OscarMap from '../components/OscarMap.vue'
import { saveSearchSnapshot } from '../stores/searchExport'
import { ElButton, ElIcon, ElInput, ElOption, ElSelect } from 'element-plus'
import 'element-plus/es/components/button/style/css'
import 'element-plus/es/components/icon/style/css'
import 'element-plus/es/components/input/style/css'
import 'element-plus/es/components/select/style/css'
import { useI18n } from 'vue-i18n'
import { searchFacilities, featureToRow, type WigosFeature } from '../api/wigos'
import { facilityTypes, programAffiliations, variableInfo, wmoRegions } from '../data/wmdrCodes'
import { territories } from '../data/wmdrTerritories'
import variableTreeRaw from '../data/variableTree.json'

interface Station {
  id: string
  name: string
  wigos: string
  lat: number | null
  lon: number | null
  elev: number | null
  type: string
  cls: string
  terr: string
  ra: string
  decl: string
  ass: string
  prog: string[]
}

type FilterKey = 'type' | 'program' | 'variable' | 'ra' | 'terr'

const route = useRoute()
const { t } = useI18n()
const keyword = ref(String(route.query.q || ''))
const mode = ref<'map' | 'list'>(route.query.mode === 'list' ? 'list' : 'map')
const filters = reactive<Record<FilterKey, string>>({ type: '', program: '', variable: '', ra: '', terr: '' })
const rows = ref<Station[]>([])
const total = ref(0)
const fetchedAt = ref('')
const loading = ref(true)
const error = ref('')
const page = ref(1)
const pageSize = ref(25)
const ascending = ref(true)
let requestSeq = 0

interface VariableNode { id: number; text: string; children?: VariableNode[] }

function flattenVariables(nodes: VariableNode[]): { id: number; text: string }[] {
  const out: { id: number; text: string }[] = []
  for (const node of nodes) {
    out.push({ id: node.id, text: node.text })
    if (node.children?.length) out.push(...flattenVariables(node.children))
  }
  return out
}

const variableOptions = flattenVariables(variableTreeRaw as VariableNode[])
const variableIdByName = new Map(variableOptions.map((item) => [item.text, item.id]))

const fields = computed<{ key: FilterKey; label: string; options: string[] }[]>(() => [
  { key: 'type', label: t('search.field.type'), options: facilityTypes.filter((type) => type.id !== 'unknown').map((type) => type.title) },
  { key: 'program', label: t('search.field.program'), options: programAffiliations.map((program) => program.title) },
  { key: 'variable', label: t('search.field.variable'), options: variableOptions.map((item) => item.text) },
  { key: 'ra', label: t('search.field.region'), options: wmoRegions.map((region) => region.title) },
  { key: 'terr', label: t('search.field.territory'), options: territories.map((territory) => territory.title) },
])

const activeCriteria = computed(() =>
  [keyword.value.trim(), ...Object.values(filters).filter(Boolean)].filter(Boolean),
)

function toStation(feature: WigosFeature): Station | null {
  const row = featureToRow(feature)
  if (!row) return null
  const categories = [
    ...new Set(
      (feature.properties.observations ?? [])
        .map((observation) => variableInfo(observation.observedProperty?.id)?.category)
        .filter(Boolean) as string[],
    ),
  ]
  return {
    id: feature.id,
    name: row.name,
    wigos: feature.id,
    lat: row.lat,
    lon: row.lon,
    elev: row.elevation ?? null,
    type: row.type,
    cls: categories.join(', '),
    terr: row.country,
    ra: feature.properties.wmoRegion?.id ? feature.properties.wmoRegion.id : '',
    decl: row.status,
    ass: row.status,
    prog: row.programs,
  }
}

async function loadPage() {
  const seq = ++requestSeq
  loading.value = true
  error.value = ''
  try {
    const variableId = filters.variable ? variableIdByName.get(filters.variable) : undefined
    const result = await searchFacilities({
      q: keyword.value.trim() || undefined,
      types: filters.type ? [filters.type] : [],
      programs: filters.program ? [filters.program] : [],
      territories: filters.terr ? [filters.terr] : [],
      variables: variableId != null ? [variableId] : [],
      regions: filters.ra ? [filters.ra] : [],
      limit: pageSize.value,
      offset: (page.value - 1) * pageSize.value,
      sortby: ascending.value ? 'title' : '-title',
    })
    if (seq !== requestSeq) return
    rows.value = result.features.map(toStation).filter(Boolean) as Station[]
    total.value = result.numberMatched
    fetchedAt.value = result.timeStamp ?? new Date().toISOString()
  } catch (cause) {
    if (seq !== requestSeq) return
    rows.value = []
    total.value = 0
    error.value = t('search.remoteError', { message: cause instanceof Error ? cause.message : String(cause) })
  } finally {
    if (seq === requestSeq) loading.value = false
  }
}

const filtered = computed(() => rows.value)
const pageCount = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))
const paged = computed(() => filtered.value)
const mapQuery = computed(() => ({
  q: keyword.value.trim() || undefined,
  types: filters.type ? [filters.type] : [],
  programs: filters.program ? [filters.program] : [],
  territories: filters.terr ? [filters.terr] : [],
  variables: filters.variable && variableIdByName.has(filters.variable) ? [variableIdByName.get(filters.variable)!] : [],
  regions: filters.ra ? [filters.ra] : [],
}))

function coordinate(value: number | null, latitude: boolean) {
  if (value == null || !Number.isFinite(value)) return '—'
  return `${Math.abs(value).toFixed(3)}°${latitude ? (value < 0 ? 'S' : 'N') : (value < 0 ? 'W' : 'E')}`
}

function reset() {
  keyword.value = ''
  for (const key of Object.keys(filters) as FilterKey[]) filters[key] = ''
  page.value = 1
  void loadPage()
}

function goPage(next: number) {
  page.value = Math.min(pageCount.value, Math.max(1, next))
  void loadPage()
}

function toggleSort() {
  ascending.value = !ascending.value
  page.value = 1
  void loadPage()
}

let filterTimer = 0
function scheduleReload() {
  window.clearTimeout(filterTimer)
  filterTimer = window.setTimeout(() => {
    page.value = 1
    void loadPage()
  }, 350)
}

onMounted(() => {
  void loadPage()
})

onBeforeUnmount(() => {
  window.clearTimeout(filterTimer)
})

watch([keyword, () => ({ ...filters })], scheduleReload)
watch(pageSize, () => {
  page.value = 1
  void loadPage()
})
watch([rows, total, activeCriteria], () => {
  saveSearchSnapshot({
    query: {
      q: keyword.value.trim() || undefined,
      types: filters.type ? [filters.type] : [],
      programs: filters.program ? [filters.program] : [],
      territories: filters.terr ? [filters.terr] : [],
      variables: filters.variable && variableIdByName.has(filters.variable) ? [variableIdByName.get(filters.variable)!] : [],
      regions: filters.ra ? [filters.ra] : [],
      sortby: ascending.value ? 'title' : '-title',
    },
    total: total.value,
    filteredIds: rows.value.map((row) => row.id),
    filteredCount: rows.value.length,
    criteriaLabel: activeCriteria.value.join(' · ') || 'none',
    updatedAt: new Date().toISOString(),
  })
}, { immediate: true })
</script>

<style scoped lang="scss">
.station-browser { --search-green: #1a8174; display: grid; grid-template-columns: 280px minmax(0, 1fr); gap: 18px; padding: 16px; background: #f0f5f5; align-items: start; color: #536475; }
.criteria-card, .results-card { background: white; border: 1px solid #e0e8ec; border-radius: 8px; padding: 20px; min-width: 0; }
.criteria-card { max-height: calc(100vh - 190px); overflow-y: auto; }
header { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
h2 { display: inline; margin: 0; padding: 0; border: 0; text-transform: uppercase; font-size: 13px; letter-spacing: 1px; font-weight: 700; color: #405365; }
.criterion { display: block; margin-top: 17px; font-weight: 400; }
.criterion > span { display: block; text-transform: uppercase; font-size: 11px; margin-bottom: 7px; color: #718194; }
.criterion :deep(.el-select) { width: 100%; }
.criterion :deep(.el-input__wrapper), .criterion :deep(.el-select__wrapper) { background: #f5f7fb; }
.mode-switch { display: inline-flex; padding: 3px; border: 1px solid #e2e9ed; border-radius: 24px; white-space: nowrap; }
.mode-switch button { display: inline-flex; gap: 5px; align-items: center; justify-content: center; border: 0; background: transparent; border-radius: 20px; padding: 6px 12px; color: #647588; font-size: 12px; }
.mode-switch button.active { background: #ddf4f0; color: var(--search-green); box-shadow: inset 0 0 0 1px #b7ddd4; }
.results-header > div:first-child { display: flex; align-items: center; gap: 14px; }
.results-header span, .data-note { font-size: 11px; color: #7d8b99; }
.active-criteria { margin: 16px 0 12px; font-size: 11px; }
.active-criteria span { display: inline-block; padding: 4px 8px; background: #f5f7fa; border: 1px solid #e4eaf0; border-radius: 4px; overflow-wrap: anywhere; }
.map-wrap { position: relative; overflow: hidden; border: 1px solid #d9e5e7; border-radius: 6px; }
.map-wrap :deep(.oscar-ol-map) { height: max(430px, calc(100vh - 330px)); }
.map-caption { padding: 6px 10px; background: #f5f8fa; font-size: 10px; }
.map-empty { position: absolute; top: 45%; width: 100%; text-align: center; background: #ffffffd9; padding: 12px; }
.table-wrap { height: max(390px, calc(100vh - 380px)); overflow: auto; }
table { width: 100%; border-collapse: collapse; font-size: 12px; }
th { position: sticky; top: 0; background: #f4f7fb; color: #718198; text-transform: uppercase; font-size: 11px; padding: 12px 10px; white-space: nowrap; z-index: 1; }
td { padding: 12px 10px; border-bottom: 1px solid #e8edf1; vertical-align: top; }
td:first-child { min-width: 160px; }
a { color: #268b95; }
small { display: block; margin-top: 5px; color: #8a96a3; font-size: 10px; }
.sort-button { border: 0; background: none; color: var(--search-green); text-transform: uppercase; padding: 0; }
.position { white-space: nowrap; font-family: monospace; }
.status, .program { display: inline-block; border: 1px solid #e0e7ec; border-radius: 3px; padding: 3px 6px; background: #f7f9fc; font-size: 10px; margin: 0 3px 3px 0; }
.status.operational { color: var(--search-green); background: #f0faf6; border-color: #cee4da; }
.pagination { display: flex; justify-content: flex-end; align-items: center; gap: 8px; margin-top: 14px; font-size: 11px; }
.pagination select { border: 1px solid #dce4e9; border-radius: 4px; padding: 6px; }
.data-note { margin-top: 14px; }
.state-message { padding: 40px 15px; text-align: center; }
@media (max-width: 1000px) { .station-browser { grid-template-columns: 235px minmax(0, 1fr); gap: 12px; padding: 8px; } .criteria-card, .results-card { padding: 12px; } }
@media (max-width: 700px) { .station-browser { grid-template-columns: 1fr; } .criteria-card { max-height: 320px; } .results-header > div:first-child { flex-wrap: wrap; gap: 6px; } }
</style>
