<template>
 
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { clusters, contacts, stations } from '../data/stations'

const MIN_LEN = 3
const term = ref('')
const focus = ref(false)
const stationPhase = ref<'idle' | 'searching' | 'done'>('idle')

const open = computed(() => focus.value && term.value.trim().length >= MIN_LEN)

const query = computed(() => term.value.trim().toLowerCase())

const stationHits = computed(() => {
  if (!open.value || stationPhase.value !== 'done') return []
  const q = query.value
  return stations.filter((s) => s.name.toLowerCase().includes(q) || s.wigosId.toLowerCase().includes(q)).slice(0, 8)
})

const clusterHits = computed(() => {
  if (!open.value) return []
  const q = query.value
  return clusters.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 8)
})

const contactHits = computed(() => {
  if (!open.value) return []
  const q = query.value
  return contacts.filter((c) => c.name.toLowerCase().includes(q) || c.org.toLowerCase().includes(q)).slice(0, 8)
})

let searchTimer: number | undefined

watch([term, focus], () => {
  window.clearTimeout(searchTimer)
  if (!open.value) {
    stationPhase.value = 'idle'
    return
  }
  stationPhase.value = 'searching'
  searchTimer = window.setTimeout(() => {
    stationPhase.value = 'done'
  }, 280)
})

void stationHits; void clusterHits; void contactHits;
</script>

<style scoped lang="scss">
form {
  position: relative;
}
</style>
