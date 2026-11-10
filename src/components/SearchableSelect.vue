<template>
  <div class="el-select" :class="{ 'is-focus': open, 'el-select--dark': theme === 'dark' }" ref="root">
    <div class="el-select__wrapper" @click="toggle">
      <span class="el-select__selected-item" :class="{ 'is-placeholder': !selected }">
        {{ selected?.text || placeholder }}
      </span>
      <span v-if="selected" class="el-select__clear" @click.stop.prevent="clear" :title="$t('common.clear')">&times;</span>
      <svg class="el-select__caret" :class="{ 'is-reverse': open }" viewBox="0 0 1024 1024" aria-hidden="true">
        <path
          fill="currentColor"
          d="M831.872 340.864 512 652.672 192.128 340.864a42.752 42.752 0 0 0-60.416 60.416l351.744 343.168a42.624 42.624 0 0 0 60.416 0l351.744-343.168a42.752 42.752 0 0 0-60.416-60.416z"
        />
      </svg>
    </div>
    <div v-show="open" class="el-select-dropdown">
      <div class="el-select-dropdown__search">
        <input
          ref="searchInput"
          type="text"
          class="el-input__inner"
          autocomplete="off"
          :placeholder="$t('common.searchPlaceholder')"
          v-model="query"
          @input="onQuery"
        />
      </div>
      <ul class="el-select-dropdown__list" role="listbox" @scroll="onScroll">
        <li v-if="loading && !items.length" class="el-select-dropdown__empty">{{ $t('common.searching') }}</li>
        <li v-else-if="!loading && !items.length" class="el-select-dropdown__empty">{{ $t('common.noResults') }}</li>
        <template v-for="row in displayItems" :key="row.item.id + row.item.text">
          <li v-if="row.showGroup" class="el-select-group__title">{{ row.item.group }}</li>
          <li
            class="el-select-dropdown__item"
            :class="{
              'is-hover': highlightedId === row.item.id,
              'is-selected': selected?.id === row.item.id,
              'is-indented': !!row.item.group,
            }"
            @mouseenter="highlightedId = row.item.id"
            @mousedown.prevent="choose(row.item)"
          >
            {{ row.item.text }}
          </li>
        </template>
        <li v-if="loading && items.length" class="el-select-dropdown__empty">{{ $t('common.searching') }}</li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { OscarOption, OscarPage } from '../api/oscar'

const props = defineProps<{
  placeholder: string
  fetcher: (q: string, page: number) => Promise<OscarPage>
  theme?: 'light' | 'dark'
  initialText?: string
  initialId?: string
}>()

const emit = defineEmits<{
  select: [item: OscarOption]
  clear: []
}>()

const root = ref<HTMLElement | null>(null)
const searchInput = ref<HTMLInputElement | null>(null)
const open = ref(false)
const query = ref('')
const items = ref<OscarOption[]>([])
const loading = ref(false)
const page = ref(1)
const more = ref(false)
const selected = ref<OscarOption | null>(null)
const highlightedId = ref('')

watch(
  () => [props.initialText, props.initialId] as const,
  ([text, id]) => {
    if (text) selected.value = { id: String(id ?? text), text }
    else if (!text) selected.value = null
  },
  { immediate: true },
)

defineExpose({ setSelected: (item: OscarOption | null) => { selected.value = item } })
const displayItems = computed(() => {
  let last = ''
  return items.value.map((item) => {
    const showGroup = Boolean(item.group && item.group !== last)
    last = item.group ?? last
    return { item, showGroup }
  })
})

let timer: number | undefined
let requestSeq = 0

async function load(reset: boolean) {
  const seq = ++requestSeq
  if (reset) {
    page.value = 1
    items.value = []
  }
  loading.value = true
  try {
    const result = await props.fetcher(query.value.trim(), page.value)
    if (seq !== requestSeq) return
    items.value = reset ? result.items : [...items.value, ...result.items]
    more.value = result.more
    highlightedId.value = items.value[0]?.id ?? ''
  } catch {
    if (seq !== requestSeq) return
    if (reset) items.value = []
    more.value = false
  } finally {
    if (seq === requestSeq) loading.value = false
  }
}

function onQuery() {
  window.clearTimeout(timer)
  timer = window.setTimeout(() => load(true), 300)
}

function toggle() {
  open.value = !open.value
  if (open.value) {
    query.value = ''
    void load(true)
    void nextTick(() => searchInput.value?.focus())
  }
}

function choose(item: OscarOption) {
  selected.value = item
  open.value = false
  emit('select', item)
}

function clear() {
  selected.value = null
  emit('clear')
}

function onScroll(evt: Event) {
  const el = evt.target as HTMLElement
  if (!more.value || loading.value) return
  if (el.scrollTop + el.clientHeight >= el.scrollHeight - 24) {
    page.value += 1
    void load(false)
  }
}

function onDocClick(evt: MouseEvent) {
  if (!root.value?.contains(evt.target as Node)) open.value = false
}

onMounted(() => document.addEventListener('mousedown', onDocClick))
onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocClick)
  window.clearTimeout(timer)
})
</script>

<style scoped lang="scss">
.el-select {
  --el-color-primary: var(--oscar-theme, #0b6b4f);
  position: relative;
  display: block;
  width: 100%;
}

.el-select__wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 32px;
  padding: 1px 8px 1px 12px;
  background: #fff;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  cursor: pointer;
  color: #606266;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.el-select__wrapper:hover {
  border-color: #c0c4cc;
}

.el-select.is-focus .el-select__wrapper {
  border-color: var(--el-color-primary);
  box-shadow: 0 0 0 1px var(--el-color-primary) inset;
}

.el-select__selected-item {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  line-height: 30px;
}

.el-select__selected-item.is-placeholder {
  color: #a8abb2;
}

.el-select__clear {
  color: #c0c4cc;
  font-size: 16px;
  line-height: 1;
  width: 16px;
  text-align: center;
}

.el-select__clear:hover {
  color: #909399;
}

.el-select__caret {
  width: 12px;
  height: 12px;
  color: #a8abb2;
  flex-shrink: 0;
  transition: transform 0.3s;
}

.el-select__caret.is-reverse {
  transform: rotate(180deg);
}

.el-select-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  z-index: 30;
  width: 100%;
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
  color: #606266;
}

.el-select-dropdown__search {
  padding: 8px 8px 0;
}

.el-input__inner {
  width: 100%;
  height: 32px;
  padding: 0 11px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  color: #606266;
  outline: none;
  font-size: 13px;
}

.el-input__inner:focus {
  border-color: var(--el-color-primary);
}

.el-select-dropdown__list {
  max-height: 220px;
  overflow-y: auto;
  margin: 6px 0;
  padding: 0;
  list-style: none;
}

.el-select-dropdown__item {
  padding: 0 32px 0 20px;
  height: 34px;
  line-height: 34px;
  font-size: 13px;
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.el-select-dropdown__item.is-indented {
  padding-left: 32px;
}

.el-select-dropdown__item.is-hover {
  background: #f5f7fa;
}

.el-select-dropdown__item.is-selected {
  color: var(--el-color-primary);
  font-weight: 700;
}

.el-select-group__title {
  padding: 0 20px;
  height: 30px;
  line-height: 30px;
  font-size: 12px;
  color: #909399;
}

.el-select-dropdown__empty {
  padding: 10px 0;
  text-align: center;
  color: #909399;
  font-size: 13px;
}

.el-select--dark .el-select__wrapper {
  min-height: 36px;
  padding: 2px 12px 2px 14px;
  background: #0a2248;
  border: 1px solid #3a6eb3;
  border-radius: 8px;
  color: #d7e4f5;
}

.el-select--dark .el-select__wrapper:hover {
  border-color: #5b8fd4;
}

.el-select--dark.is-focus .el-select__wrapper {
  border-color: #5eb0ff;
  box-shadow: 0 0 0 1px #5eb0ff inset;
}

.el-select--dark .el-select__selected-item {
  line-height: 32px;
}

.el-select--dark .el-select__selected-item.is-placeholder {
  color: #8aa4c7;
}

.el-select--dark .el-select__caret,
.el-select--dark .el-select__clear {
  color: #8aa4c7;
}

.el-select--dark .el-select-dropdown {
  background: #0f2b57;
  border-color: #3a6eb3;
  color: #d7e4f5;
}

.el-select--dark .el-input__inner {
  background: #0a2248;
  border-color: #3a6eb3;
  color: #d7e4f5;
}

.el-select--dark .el-input__inner:focus {
  border-color: #5eb0ff;
}

.el-select--dark .el-select-dropdown__item.is-hover {
  background: #1a3f73;
}

.el-select--dark .el-select-dropdown__item.is-selected {
  color: #5eb0ff;
}

.el-select--dark .el-select-group__title,
.el-select--dark .el-select-dropdown__empty {
  color: #8aa4c7;
}
</style>
