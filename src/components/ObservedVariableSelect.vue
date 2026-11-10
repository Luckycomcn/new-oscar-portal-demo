<template>
  <div ref="root" class="ov-select" :class="{ open }">
    <button type="button" class="ov-input" @click="toggle">
      <span class="ov-text" :class="{ placeholder: !buttonLabel }">{{ buttonLabel || placeholder }}</span>
      <span class="ov-suffix">
        <span v-if="selectedIds.length" class="ov-count">{{ selectedIds.length }}</span>
        <svg viewBox="0 0 1024 1024"><path fill="currentColor" d="M176 416l336 336 336-336z" /></svg>
      </span>
    </button>
    <div v-show="open" class="ov-dropdown" @click.stop>
      <div class="ov-search"><input v-model="keyword" :placeholder="$t('common.searchPlaceholder')" /></div>
      <div class="ov-tree">
        <div v-if="!visibleRows.length" class="ov-empty">{{ $t('common.noData', { count: roots.length }) }}</div>
        <div
          v-for="row in visibleRows"
          :key="row.node.id"
          class="ov-row"
          :style="{ paddingLeft: 6 + row.depth * 20 + 'px' }"
          :class="{ match: isMatch(row.node) }"
        >
          <span
            class="ov-caret"
            :class="{ open: expandedMap[row.node.id], empty: !(row.node.children || []).length }"
            @click="toggleExpand(row.node.id)"
          >{{ (row.node.children || []).length ? '+' : '' }}</span>
          <label class="el-checkbox" @click.stop>
            <span class="el-checkbox__input" :class="{ 'is-checked': !!checkedMap[row.node.id] }" @click="toggleCheck(row.node.id)">
              <span class="el-checkbox__inner"></span>
            </span>
            <span class="el-checkbox__label" @click="toggleCheck(row.node.id)">{{ row.node.text }}</span>
          </label>
        </div>
      </div>
      <div class="ov-footer">
        <button type="button" class="ov-btn" @click="clearAll">{{ $t('common.clear') }}</button>
        <button type="button" class="ov-btn primary" @click="confirmSearch">{{ $t('common.search') }}</button>
        <button type="button" class="ov-btn" @click="open = false">{{ $t('common.close') }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import rawTree from '../data/variableTree.json'

interface VNode { id: number; text: string; children?: VNode[] }
interface Row { node: VNode; depth: number }

const props = defineProps({ placeholder: { type: String, default: 'Observed variable' } })
const emit = defineEmits<{ (e: 'change', ids: number[]): void }>()
const router = useRouter()

const open = ref(false)
const keyword = ref('')
const selectedIds = ref<number[]>([])
const checkedMap = ref<Record<number, boolean>>({})
const expandedMap = ref<Record<number, boolean>>({})
const flat = ref<Record<number, { text: string; parentId: number | null; childrenIds: number[] }>>({})
const roots = ref<VNode[]>(Array.isArray(rawTree) ? (rawTree as unknown as VNode[]) : [])

function build(nodes: VNode[], parentId: number | null) {
  for (const n of nodes) {
    const kids = n.children ?? []
    flat.value[n.id] = { text: n.text, parentId, childrenIds: kids.map((k) => k.id) }
    if (parentId === null && expandedMap.value[n.id] === undefined) expandedMap.value[n.id] = true
    build(kids, n.id)
  }
}
// 模拟接口：同步装载 + 延迟 150ms 再刷新一次（模拟异步返回）
build(roots.value, null)
setTimeout(() => {
  roots.value = [...roots.value]
}, 150)

function flatten(nodes: VNode[], depth: number, out: Row[]) {
  for (const n of nodes) {
    out.push({ node: n, depth })
    if (expandedMap.value[n.id] || keyword.value.trim()) flatten(n.children ?? [], depth + 1, out)
  }
  return out
}
function filterNodes(nodes: VNode[], kw: string): VNode[] {
  if (!kw.trim()) return nodes
  const k = kw.toLowerCase()
  const out: VNode[] = []
  for (const n of nodes) {
    const kids = filterNodes(n.children ?? [], kw)
    if (n.text.toLowerCase().includes(k) || kids.length) out.push({ ...n, children: kids })
  }
  return out
}
const visibleRows = computed(() => flatten(filterNodes(roots.value, keyword.value), 0, []))
function isMatch(node: VNode) {
  const k = keyword.value.trim().toLowerCase()
  return k && node.text.toLowerCase().includes(k)
}

function descendants(id: number): number[] {
  const out: number[] = []
  const stack = [...(flat.value[id]?.childrenIds ?? [])]
  while (stack.length) {
    const cur = stack.pop()!
    out.push(cur)
    stack.push(...(flat.value[cur]?.childrenIds ?? []))
  }
  return out
}
function toggleCheck(id: number) {
  const next = !checkedMap.value[id]
  checkedMap.value[id] = next
  for (const d of descendants(id)) { if (next) checkedMap.value[d] = true; else delete checkedMap.value[d] }
  if (!next) delete checkedMap.value[id]
  else checkedMap.value[id] = true
  let p = flat.value[id]?.parentId
  while (p != null) {
    const sibs = flat.value[p]?.childrenIds ?? []
    if (sibs.length && sibs.every((s) => checkedMap.value[s])) checkedMap.value[p] = true
    else delete checkedMap.value[p]
    p = flat.value[p]?.parentId ?? null
  }
  selectedIds.value = Object.keys(checkedMap.value).map(Number)
}
function toggleExpand(id: number) { expandedMap.value[id] = !expandedMap.value[id] }

const buttonLabel = computed(() => {
  if (!selectedIds.value.length) return ''
  const names = selectedIds.value.slice(0, 2).map((id) => flat.value[id]?.text ?? String(id))
  return selectedIds.value.length > 2 ? `${names.join(', ')} (+${selectedIds.value.length - 2})` : names.join(', ')
})

function clearAll() { checkedMap.value = {}; selectedIds.value = []; emit('change', []) }
function confirmSearch() {
  emit('change', [...selectedIds.value])
  open.value = false
  const names = selectedIds.value.map((id) => flat.value[id]?.text ?? String(id))
  router.push({ name: 'stationSearch', query: { variableIds: selectedIds.value.join(','), variables: names.join(',') } })
}
function toggle() { open.value = !open.value }

const root = ref<HTMLElement | null>(null)
function onDocClick(e: MouseEvent) { if (root.value && !root.value.contains(e.target as Node)) open.value = false }
onMounted(() => document.addEventListener('click', onDocClick))
onUnmounted(() => document.removeEventListener('click', onDocClick))
</script>

<style scoped lang="scss">
.ov-select { position: relative; }
.ov-input { width: 100%; display: flex; align-items: center; justify-content: space-between; height: 34px; padding: 0 10px; background: #fff; border: 1px solid #dcdfe6; border-radius: 4px; color: #606266; font-size: 13px; cursor: pointer; }
.open .ov-input { border-color: #409eff; }
.ov-text.placeholder { color: #a8abb2; }
.ov-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ov-suffix { display: flex; align-items: center; gap: 6px; color: #909399; }
.ov-suffix svg { width: 12px; height: 12px; }
.ov-count { background: #409eff; color: #fff; font-size: 11px; border-radius: 9px; padding: 0 7px; line-height: 18px; }
.ov-dropdown { position: absolute; z-index: 50; top: calc(100% + 6px); left: 0; width: 320px; max-width: 78vw; background: #fff; border: 1px solid #e4e7ed; border-radius: 6px; box-shadow: 0 6px 24px rgba(0,0,0,.12); }
.ov-search { padding: 10px 10px 6px; }
.ov-search input { width: 100%; height: 32px; padding: 0 12px; border: 1px solid #409eff; border-radius: 4px; outline: none; }
.ov-tree { max-height: 340px; overflow: auto; padding: 4px 4px 8px; border-top: 1px solid #eee; margin: 0 10px 0; }
.ov-empty { padding: 16px; text-align: center; color: #909399; }
.ov-row { display: flex; align-items: center; gap: 4px; padding: 3px 2px; border-left: 1px dotted #bbb; }
.ov-row.match { background: #f0f7ff; }
.ov-caret { width: 18px; height: 18px; line-height: 16px; text-align: center; cursor: pointer; color: #606266; border: 1px solid #aaa; border-radius: 2px; font-size: 12px; flex-shrink: 0; background: #fff; }
.ov-caret.empty { border: none; cursor: default; }
.ov-caret.open { color: #409eff; border-color: #409eff; }
.el-checkbox { display: flex; align-items: center; gap: 6px; cursor: pointer; font-weight: 400; }
.el-checkbox__input { display: inline-flex; }
.el-checkbox__inner { width: 15px; height: 15px; border: 1px solid #999; border-radius: 2px; background: #fff; display: inline-block; position: relative; }
.el-checkbox__input.is-checked .el-checkbox__inner { background: #fff; border-color: #606266; }
.el-checkbox__input.is-checked .el-checkbox__inner::after { content: ''; position: absolute; left: 4px; top: 1px; width: 4px; height: 8px; border: solid #333; border-width: 0 2px 2px 0; transform: rotate(45deg); }
.el-checkbox__label { font-size: 13px; color: #333; }
.ov-footer { display: flex; justify-content: flex-end; gap: 8px; padding: 10px; border-top: 1px solid #eee; }
.ov-btn { height: 28px; padding: 0 12px; border: 1px solid #dcdfe6; background: #fff; border-radius: 4px; cursor: pointer; font-size: 12px; }
.ov-btn.primary { background: #409eff; border-color: #409eff; color: #fff; }
</style>
