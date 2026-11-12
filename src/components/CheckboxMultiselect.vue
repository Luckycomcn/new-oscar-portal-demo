<template>
  <div class="el-select" :class="{ 'is-focus': open, 'el-select--dark': theme === 'dark' }" ref="root">
    <div class="el-select__wrapper" @click="open = !open" :title="displayText">
      <span class="el-select__selected-item" :class="{ 'is-placeholder': !selected.length }">{{ displayText }}</span>
      <svg class="el-select__caret" :class="{ 'is-reverse': open }" viewBox="0 0 1024 1024" aria-hidden="true">
        <path
          fill="currentColor"
          d="M831.872 340.864 512 652.672 192.128 340.864a42.752 42.752 0 0 0-60.416 60.416l351.744 343.168a42.624 42.624 0 0 0 60.416 0l351.744-343.168a42.752 42.752 0 0 0-60.416-60.416z"
        />
      </svg>
    </div>
    <ul v-show="open" class="el-select-dropdown" role="menu">
      <li
        v-for="option in options"
        :key="option.id"
        class="el-select-dropdown__item"
        :class="{ 'is-child': !!option.parentId }"
        @click.prevent="toggle(option.id)"
      >
        <span class="el-checkbox" :class="{ 'is-checked': selected.includes(option.id) }">
          <span class="el-checkbox__inner"></span>
        </span>
        <span class="el-select-dropdown__label">{{ option.label }}</span>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

export interface CheckboxOption {
  id: string
  label: string
  parentId?: string
}

const props = defineProps<{
  buttonText: string
  options: CheckboxOption[]
  selected: string[]
  theme?: 'light' | 'dark'
}>()

const emit = defineEmits<{
  'update:selected': [ids: string[]]
}>()

const root = ref<HTMLElement | null>(null)
const open = ref(false)

const displayText = computed(() => {
  if (!props.selected.length) return props.buttonText
  const labelById = new Map(props.options.map((o) => [o.id, o.label]))
  // 只展示叶子节点，避免父子同时选中时重复（如 WIGOS + GOS）
  const leafIds = props.selected.filter((id) => !props.options.some((o) => o.parentId === id))
  const labels = (leafIds.length ? leafIds : props.selected).map((id) => labelById.get(id) ?? id)
  return labels.join(', ')
})

function toggle(id: string) {
  const option = props.options.find((item) => item.id === id)
  const selected = new Set(props.selected)
  const children = props.options.filter((item) => item.parentId === id)
  const turningOn = !selected.has(id)

  if (children.length) {
    if (turningOn) {
      selected.add(id)
      children.forEach((child) => selected.add(child.id))
    } else {
      selected.delete(id)
      children.forEach((child) => selected.delete(child.id))
    }
  } else if (turningOn) {
    selected.add(id)
  } else {
    selected.delete(id)
  }

  const parentId = option?.parentId
  if (parentId) {
    const siblings = props.options.filter((item) => item.parentId === parentId)
    if (siblings.every((item) => selected.has(item.id))) selected.add(parentId)
    else selected.delete(parentId)
  }

  emit(
    'update:selected',
    props.options.filter((item) => selected.has(item.id)).map((item) => item.id),
  )
}

function onDocClick(evt: MouseEvent) {
  if (!root.value?.contains(evt.target as Node)) open.value = false
}

onMounted(() => document.addEventListener('mousedown', onDocClick))
onBeforeUnmount(() => document.removeEventListener('mousedown', onDocClick))
</script>

<style scoped lang="scss">
.el-select {
  --el-color-primary: var(--oscar-theme, #005BAB);
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
  margin: 0;
  padding: 6px 0;
  list-style: none;
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
  color: #606266;
  max-height: 280px;
  overflow-y: auto;
}

.el-select-dropdown__item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 20px;
  min-height: 34px;
  font-size: 13px;
  cursor: pointer;
}

.el-select-dropdown__item.is-child {
  padding-left: 36px;
}

.el-select-dropdown__item:hover {
  background: var(--oscar-theme-soft);
}

.el-checkbox__inner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 1px solid #dcdfe6;
  border-radius: 2px;
  background: #fff;
  position: relative;
  box-sizing: border-box;
}

.el-checkbox.is-checked .el-checkbox__inner {
  background: var(--el-color-primary);
  border-color: var(--el-color-primary);
}

.el-checkbox.is-checked .el-checkbox__inner::after {
  content: '';
  position: absolute;
  left: 4px;
  top: 1px;
  width: 3px;
  height: 7px;
  border: 1px solid #fff;
  border-left: 0;
  border-top: 0;
  transform: rotate(45deg);
}

.el-select-dropdown__label {
  line-height: 1.4;
}

.el-select--dark .el-select__wrapper {
  min-height: 36px;
  padding: 1px 12px 1px 14px;
  background: #0a1b3a;
  border: 1px solid #3d6aa8;
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

.el-select--dark .el-select__selected-item.is-placeholder {
  color: #8aa4c7;
}

.el-select--dark .el-select__caret {
  color: #7aa3d4;
}

.el-select--dark .el-select-dropdown {
  background: #10284f;
  border-color: #3d6aa8;
  color: #d7e4f5;
}

.el-select--dark .el-select-dropdown__item:hover {
  background: #1a3d70;
}

.el-select--dark .el-checkbox__inner {
  background: transparent;
  border-color: #5b8fd4;
}

.el-select--dark .el-checkbox.is-checked .el-checkbox__inner {
  background: #3b9eff;
  border-color: #3b9eff;
}
</style>
