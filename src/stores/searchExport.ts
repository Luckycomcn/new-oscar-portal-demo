import { ref } from 'vue'
import type { FacilitySearchParams } from '../api/wigos'

export interface SearchExportSnapshot {
  query?: FacilitySearchParams
  total: number
  filteredIds: Array<number | string>
  filteredCount: number
  criteriaLabel: string
  updatedAt: string
}

const KEY = 'oscar-search-export'
const STORE_KEY = '__oscar_search_export_mem__'

declare global {
  // eslint-disable-next-line no-var
  var __oscarSearchExport: ReturnType<typeof createStore> | undefined
}

function createStore() {
  const snapshot = ref<SearchExportSnapshot | null>(load())
  function load(): SearchExportSnapshot | null {
    try {
      const raw = sessionStorage.getItem(KEY)
      return raw ? (JSON.parse(raw) as SearchExportSnapshot) : null
    } catch {
      return null
    }
  }
  function save(s: SearchExportSnapshot) {
    snapshot.value = s
    try {
      sessionStorage.setItem(KEY, JSON.stringify(s))
    } catch {
      /* ignore */
    }
  }
  return { snapshot, save, reload: () => (snapshot.value = load()) }
}

function getStore() {
  if (!globalThis[STORE_KEY as never]) {
    ;(globalThis as Record<string, unknown>)[STORE_KEY] = createStore()
  }
  return (globalThis as Record<string, unknown>)[STORE_KEY] as ReturnType<typeof createStore>
}

export function saveSearchSnapshot(s: SearchExportSnapshot) {
  getStore().save(s)
}

export function loadSearchSnapshot(): SearchExportSnapshot | null {
  const st = getStore()
  st.reload()
  return st.snapshot.value
}

export function useSearchSnapshot() {
  return getStore()
}
