<template>
  <div>
    <section class="home-hero">
      <div class="home-hero__top">
        <div class="home-hero__intro">
          <h1>{{ $t('home.title') }}</h1>
          <p>
            {{ $t('home.desc') }}
          </p>
          <div class="home-hero__search">
            <el-input
              v-model="quickTerm"
              :placeholder="$t('home.searchPlaceholder')"
              :prefix-icon="Search"
              class="home-hero__input"
              clearable
              @keyup.enter="doSearch"
            />
            <el-button type="success" :icon="Search" :loading="searchBusy" @click="doSearch">{{ $t('home.search') }}</el-button>
            <el-button :icon="Filter" @click="goAdvanced">{{ $t('home.advancedSearch') }}</el-button>
          </div>
          <div v-if="searchHint" class="home-hero__hint" role="status">{{ searchHint }} <el-button v-if="searchError" size="small" @click="doSearch">{{ t('common.retry') }}</el-button></div>
        </div>
        <div class="home-hero__stats">
          <div class="stat-card" v-for="stat in stats" :key="stat.label">
            <span class="stat-card__icon">
              <el-icon :size="20"><component :is="stat.icon" /></el-icon>
            </span>
            <small>{{ stat.label }}</small>
            <strong>{{ stat.value }}</strong>
            <em>{{ stat.note }}</em>
          </div>
        </div>
      </div>
      <p v-if="typeError" role="alert">{{ t('home.typeCountError') }} <el-button size="small" @click="loadTypeCount">{{ t('common.retry') }}</el-button></p>
      <OscarMap />
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElButton, ElIcon, ElInput } from 'element-plus'
import 'element-plus/es/components/button/style/css'
import 'element-plus/es/components/input/style/css'
import 'element-plus/es/components/icon/style/css'
import { Clock, Filter, Location, MapLocation, Search, Share } from '@element-plus/icons-vue'
import OscarMap from '../components/OscarMap.vue'
import { focusedStation } from '../stores/quickFilter'
import { featureToStation, getCatalogueStats, getPopulatedFacilityTypeCount, searchFacilities } from '../api/wigos'
import { territories } from '../data/wmdrTerritories'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()


const router = useRouter()
const quickTerm = ref('')
const searchHint = ref('')
const searchError = ref(false)
const searchBusy = ref(false)
const typeCount = ref<number>()
const typeError = ref(false)
let searchController: AbortController | undefined
const statsController = new AbortController()
onBeforeUnmount(() => { searchController?.abort(); statsController.abort() })
async function loadTypeCount() {
  typeError.value = false
  try { typeCount.value = await getPopulatedFacilityTypeCount(statsController.signal) }
  catch { if (!statsController.signal.aborted) typeError.value = true }
}
const catalogue = ref<{ total?: number; last?: string }>({})



onMounted(async () => {
  void loadTypeCount()
  try {
    const stats = await getCatalogueStats()
    catalogue.value = { total: stats.totalFacilities, last: stats.lastCreated }
  } catch {
    // keep placeholders when the catalogue is unreachable
  }
})

async function doSearch() {
  searchController?.abort()
  const controller = new AbortController()
  searchController = controller
  const raw = quickTerm.value.trim()
  focusedStation.value = null
  searchHint.value = ''
  searchError.value = false
  searchBusy.value = false
  if (!raw) return
  searchBusy.value = true
  try {
    const result = await searchFacilities({ q: raw, limit: 1, sortby: 'title', signal: controller.signal })
    if (controller.signal.aborted) return
    const station = result.features[0] ? featureToStation(result.features[0]) : null
    if (station) {
      focusedStation.value = station
      searchHint.value = t('home.hint.found', { count: result.numberMatched, name: station.name, id: station.wigosId })
    } else {
      searchHint.value = t('home.hint.none', { term: raw })
    }
  } catch {
    if (controller.signal.aborted) return
    searchError.value = true
    searchHint.value = t('home.searchRemoteError')
  } finally {
    if (searchController === controller) searchBusy.value = false
  }
}
const stats = computed(() => [
  {
    label: t('home.stats.totalStations'),
    value: catalogue.value.total != null ? catalogue.value.total.toLocaleString() : '—',
    note: t('home.stats.totalStationsNote'),
    icon: Location,
  },
  {
    label: t('home.stats.countries'),
    value: String(territories.length),
    note: t('home.stats.countriesNote'),
    icon: MapLocation,
  },
  {
    label: t('home.stats.observationTypes'),
    value: typeCount.value == null ? '—' : String(typeCount.value),
    note: t('home.stats.observationTypesNote'),
    icon: Share,
  },
  {
    label: t('home.stats.lastUpdate'),
    value: catalogue.value.last ?? '—',
    note: t('home.stats.lastUpdateNote'),
    icon: Clock,
  },
])

function goAdvanced() {
  router.push({ name: 'stationSearch' })
}
</script>

<style scoped lang="scss">
.home-hero {
  background: #fff;
}

.home-hero__top {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 14px;
  background-color: #f0f7fc;
  padding: 20px 20px 0 20px;
  background-image: url('../assets/header_bg.png');
  background-position: center top;
  background-repeat: no-repeat;
  height: 100%;
  width: 100%;
}

.home-hero__intro {
  flex: 1;
  min-width: 0;
}

.home-hero__intro h1 {
  margin: 0 0 8px;
  color: var(--oscar-theme);
  font-size: 22px;
  line-height: 23px;
  font-weight: 600;
  border: 0;
  padding: 0;
}

.home-hero__intro p {
  margin: 0 0 12px;
  color: #4b6073;
  font-size: 12px;
  line-height: 1.55;
}

.home-hero__search {
  display: flex;
  gap: 8px;
  align-items: center;
}

.home-hero__input {
  flex: 1;
  max-width: 420px;
}

.home-hero__stats {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
  padding-bottom: 12px;
}

.stat-card {
  min-width: 118px;
  padding: 10px 12px;
  border: 1px solid #dce6ef;
  border-radius: 10px;
  background: #fff;
  text-align: center;
}

.stat-card__icon {
  display: flex;
  justify-content: center;
  color: var(--oscar-theme);
  margin-bottom: 4px;
}

.stat-card small {
  display: block;
  color: #687e90;
  font-size: 11px;
}

.stat-card strong {
  display: block;
  color: var(--oscar-theme);
  font-size: 24px;
  font-weight: 700;
  line-height: 1.2;
}

.stat-card em {
  display: block;
  color: #778da1;
  font-size: 10px;
  font-style: normal;
}

.home-hero__search :deep(.el-button--success) {
  background: var(--oscar-theme);
  border-color: var(--oscar-theme);
}

.home-hero__search :deep(.el-button--success:hover),
.home-hero__search :deep(.el-button--success:focus) {
  background: var(--oscar-theme-soft);
  border-color: var(--oscar-theme);
  color: var(--oscar-theme);
}

.home-hero__search :deep(.el-button:not(.el-button--success):hover),
.home-hero__search :deep(.el-button:not(.el-button--success):focus) {
  background: var(--oscar-theme-soft);
  border-color: var(--oscar-theme);
  color: var(--oscar-theme);
}

.home-hero__hint {
  margin-top: 8px;
  font-size: 12px;
  color: #8a6d1b;
}

@media (max-width: 991px) {
  .home-hero__top {
    flex-direction: column;
    padding: 20px 20px 0 20px;
  }

  .home-hero__search {
    flex-wrap: wrap;
  }

  .home-hero__stats {
    width: 100%;
    flex-wrap: wrap;
  }

  .stat-card {
    flex: 1;
  }
}
</style>

