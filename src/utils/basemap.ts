import { ref } from 'vue'

export type Basemap = 'osm' | 'amap' | 'tianditu'

function initialBasemap(): Basemap {
  try {
    const saved = localStorage.getItem('oscar-basemap')
    if (saved === 'amap' || saved === 'tianditu') return saved
  } catch { /* Storage may be unavailable. Keep the in-memory preference. */ }
  return 'osm'
}

export const selectedBasemap = ref<Basemap>(initialBasemap())

export function rememberBasemap(value: Basemap) {
  selectedBasemap.value = value
  try { localStorage.setItem('oscar-basemap', value) } catch { /* In-memory state still works. */ }
}
