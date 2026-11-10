import { ref } from 'vue'
import { featureToStation } from '../api/wigos'
import { getFeature } from '../api/wigos'
import { stations, type Station } from '../data/stations'

export const focusedStation = ref<Station | null>(null)
export const filterCountry = ref('')
export const filterType = ref('')
export const filterClass = ref('')
export const filterPrograms = ref<string[]>([])
export const filterStatuses = ref<string[]>(['operational', 'partlyOperational'])
export const filterVariables = ref<number[]>([])

export async function focusStationByWigosId(wigosId: string) {
  let hit: Station | null = stations.find((s) => s.wigosId === wigosId) ?? null
  if (!hit) {
    try {
      const feature = await getFeature(wigosId)
      if (feature) hit = featureToStation(feature)
    } catch {
      hit = null
    }
  }
  focusedStation.value = hit
  if (hit?.country) filterCountry.value = hit.country
  else if (hit) {
    // best effort: leave filter alone
  }
}

export function clearQuickFilter() {
  focusedStation.value = null
  filterCountry.value = ''
  filterType.value = ''
  filterClass.value = ''
  filterVariables.value = []
}
