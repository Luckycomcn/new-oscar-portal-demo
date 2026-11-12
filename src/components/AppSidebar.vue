<template>
  <div v-if="route.name === 'home'" class="quick-access-wrap" :class="{ 'is-collapsed': collapsed }">
    <button type="button" class="qa-collapse" :aria-label="collapsed ? $t('sidebar.expandSidebar') : $t('sidebar.collapseSidebar')" @click="collapsed = !collapsed">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="currentColor"
          d="M14.71 6.71a1 1 0 0 0-1.42-1.42l-6 6a1 1 0 0 0 0 1.42l6 6a1 1 0 0 0 1.42-1.42L9.41 12z"
        />
      </svg>
    </button>

    <div class="quick-access-panel">
    <h2 class="qa-title">
      <svg class="qa-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="currentColor"
          d="M4.2 5h15.6l-5.4 6.6V19l-4.8 2v-9.4z"
        />
      </svg>
      {{ t('sidebar.quickAccess') }}
    </h2>

    <form role="form">
      <div class="qa-section">
        <label class="qa-label">{{ t('sidebar.generateReportBy') }}</label>
        <div class="form-group">
          <SearchableSelect  :placeholder="t('sidebar.stationName')" :fetcher="searchApprovedStationNames" @select="openStation" @clear="clearQuickFilter" />
        </div>
        <div class="form-group">
          <SearchableSelect  :placeholder="t('sidebar.wigosId')" :fetcher="searchApprovedWigosIds" @select="openStationById" @clear="clearQuickFilter" />
        </div>
      </div>

      <div class="qa-section">
        <label class="qa-label">{{ t('sidebar.generateListsBy') }}</label>
        <div class="form-group">
          <SearchableSelect  :placeholder="t('sidebar.country')" :fetcher="searchCountries" @select="openCountry" @clear="filterCountry = ''" />
        </div>
        <div class="form-group">
          <SearchableSelect  :placeholder="t('sidebar.type')" :fetcher="searchStationTypes" @select="openType" @clear="filterType = ''" />
        </div>
        <div class="form-group">
          <SearchableSelect  :placeholder="t('sidebar.class')" :fetcher="searchStationClasses" @select="openClass" @clear="filterClass = ''" />
        </div>
        <div class="form-group">
          <ObservedVariableSelect :placeholder="t('search.field.variable')" @change="onVariablesChange" />
        </div>
      </div>

    </form>

    <div class="qa-section">
      <label class="qa-label">{{ t('sidebar.byProgram') }}</label>
      <div class="form-group">
        <CheckboxMultiselect
          :button-text="t('sidebar.programNetwork')"
          :options="programOptions"
          v-model:selected="selectedPrograms"
        />
      </div>
    </div>

    <div class="qa-section">
      <label class="qa-label">{{ t('sidebar.byReportingStatus') }}</label>
      <div class="form-group qa-radios">
        <label class="qa-radio">
          <input type="radio" value="declared" v-model="statusMode" />
          <span>{{ t('sidebar.declared') }}</span>
        </label>
        <label class="qa-radio">
          <input type="radio" value="assessed" v-model="statusMode" />
          <span>{{ t('sidebar.assessed') }}</span>
        </label>
      </div>
      <div class="form-group">
        <CheckboxMultiselect
          :button-text="t('sidebar.reportingStatus')"
          :options="statusOptions"
          v-model:selected="selectedStatuses"
        />
      </div>
    </div>
    </div>
  </div>

  <ul v-else-if="isSearch" class="nav nav-stacked sideBar list-group subNav hidden-xs hidden-sm">
    <li v-for="item in searchNav" :key="item.name" :class="{ active: route.name === item.name }">
      <router-link :to="{ name: item.name }">{{ t(item.labelKey) }}</router-link>
    </li>
  </ul>

  <ul v-else class="nav nav-stacked sideBar hidden-xs hidden-sm">
    <li :class="{ active: route.name === 'home' }"><router-link :to="{ name: 'home' }">{{ t('nav.home') }}</router-link></li>
  </ul>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  searchApprovedStationNames,
  searchApprovedWigosIds,
  searchCountries,
  searchStationTypes,
  searchStationClasses,
  type OscarOption,
} from '../api/oscar'
import SearchableSelect from './SearchableSelect.vue'
import CheckboxMultiselect from './CheckboxMultiselect.vue'
import ObservedVariableSelect from './ObservedVariableSelect.vue'
import { searchNav } from '../data/content'
import { filterCountry, filterType, filterClass, filterVariables, filterPrograms, filterStatuses, focusedStation, focusStationByWigosId, clearQuickFilter } from '../stores/quickFilter'

const { t } = useI18n()

const collapsed = defineModel<boolean>('collapsed', { default: false })

const route = useRoute()
const router = useRouter()
const isSearch = computed(() => String(route.path).startsWith('/search'))

const programOptions = computed(() => [
  { id: 'WIGOS', label: t('sidebar.program.wigos') },
  { id: 'GOS', label: t('sidebar.program.gos'), parentId: 'WIGOS' },
  { id: 'GAW', label: t('sidebar.program.gaw'), parentId: 'WIGOS' },
  { id: 'WHOS', label: t('sidebar.program.whos'), parentId: 'WIGOS' },
  { id: 'GCW', label: t('sidebar.program.gcw'), parentId: 'WIGOS' },
  { id: 'CoSponsored', label: t('sidebar.program.coSponsored') },
  { id: 'GCOS', label: t('sidebar.program.gcos'), parentId: 'CoSponsored' },
  { id: 'GOOS', label: t('sidebar.program.goos'), parentId: 'CoSponsored' },
  { id: 'GTOS', label: t('sidebar.program.gtos'), parentId: 'CoSponsored' },
  { id: 'Other', label: t('sidebar.program.other') },
  { id: 'WIGOSnonAffiliated', label: t('sidebar.program.nonAffiliated'), parentId: 'Other' },
])
const selectedPrograms = ref(programOptions.value.map((item) => item.id))

const statusMode = ref<'declared' | 'assessed'>('declared')
const selectedStatuses = ref(['operational', 'partlyOperational'])

const declaredStatuses = computed(() => [
  { id: 'operational', label: t('sidebar.status.operational') },
  { id: 'partlyOperational', label: t('sidebar.status.partlyOperational') },
  { id: 'unknown', label: t('sidebar.status.unknown') },
  { id: 'silent', label: t('sidebar.status.silent') },
  { id: 'closed', label: t('sidebar.status.closed') },
])

const statusOptions = computed(() =>
  statusMode.value === 'declared' ? declaredStatuses.value : declaredStatuses.value.filter((item) => item.id !== 'closed'),
)

watch(statusMode, () => {
  const allowed = new Set(statusOptions.value.map((item) => item.id))
  selectedStatuses.value = selectedStatuses.value.filter((id) => allowed.has(id))
})

function extractWigosId(item: OscarOption): string {
  const m = item.text.match(/\((0-\d+-\d+-[A-Za-z0-9]+)\)\s*$/)
  if (m) return m[1]
  if (/^0-\d+-\d+-[A-Za-z0-9]+$/.test(item.text.trim())) return item.text.trim()
  return item.text.trim()
}

function openStation(item: OscarOption) {
  const wigosId = extractWigosId(item)
  if (!wigosId) return
  focusStationByWigosId(wigosId)
  router.push({ name: 'stationReportDetails', params: { wigosId } })
}
function openStationById(item: OscarOption) {
  const wigosId = extractWigosId(item)
  if (!wigosId) return
  // WIGOS Station Identifier：保持原有逻辑，只联动地图聚焦，不跳转
  focusStationByWigosId(wigosId)
}
function openCountry(item: OscarOption) {
  filterCountry.value = item.text
  focusedStation.value = null
  router.push({ name: 'stationSearch', query: { country: item.text, countryId: item.id } })
}
function openType(item: OscarOption) {
  filterType.value = item.text
  focusedStation.value = null
  router.push({ name: 'stationSearch', query: { type: item.text, stationTypeId: item.id } })
}
function openClass(item: OscarOption) {
  filterClass.value = item.text
  focusedStation.value = null
  router.push({ name: 'stationSearch', query: { class: item.text, stationClassId: item.id } })
}
const selectedVariables = ref<number[]>([])
function onVariablesChange(ids: number[]) {
  selectedVariables.value = ids
  filterVariables.value = ids
  // 跳转由 ObservedVariableSelect 内部 confirmSearch 完成（携带 variableIds + variables），此处不再重复 push
}

watch(selectedPrograms, (v) => { filterPrograms.value = [...v] }, { immediate: true })
watch(selectedStatuses, (v) => { filterStatuses.value = [...v] }, { immediate: true })
</script>

<style scoped lang="scss">
.quick-access-wrap {
  position: relative;
}

.quick-access-wrap.is-collapsed .quick-access-panel {
  display: none;
}

.quick-access-wrap.is-collapsed .qa-collapse {
  transform: rotate(180deg);
  left: 0;
}

.quick-access-panel {
  position: relative;
  background: var(--oscar-theme-soft);
  border: 0;
  border-radius: 12px;
  padding: 16px 14px 16px;
}

.qa-collapse {
  position: absolute;
  left: -14px;
  top: 46%;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid #d5e3ef;
  border-radius: 50%;
  background: #fff;
  color: #687e90;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2;
}

.qa-collapse svg {
  width: 16px;
  height: 16px;
}

.qa-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 16px;
  color: var(--oscar-theme);
  font-size: 16px;
  font-weight: 600;
  line-height: 1.2;
  border-bottom: none;
  padding-bottom: 0;
}

.qa-section {
  margin-bottom: 4px;
}

.qa-label {
  display: block;
  margin: 12px 0 8px;
  color: #35536e;
  font-size: 13px;
  font-weight: 600;
}

.qa-icon {
  width: 16px;
  height: 16px;
  color: var(--oscar-theme);
  flex-shrink: 0;
}

.form-group {
  margin-bottom: 8px;
}

.qa-radios {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 10px;
}

.qa-radio {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  color: #35536e;
  font-weight: 400;
  cursor: pointer;
}

.qa-radio input {
  appearance: none;
  -webkit-appearance: none;
  width: 14px;
  height: 14px;
  margin: 0;
  border: 2px solid #a9bfd4;
  border-radius: 50%;
  background: #fff;
}

.qa-radio input:checked {
  border-color: var(--oscar-theme);
  box-shadow: inset 0 0 0 4px var(--oscar-theme);
}
</style>
