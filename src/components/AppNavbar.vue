<template>
  <nav class="navbar navbar-default mainNav hidden-xs hidden-sm site-nav" role="navigation" id="menu">
    <div class="collapse navbar-collapse" id="mainNav">
      <ul class="nav navbar-nav">
        <li :class="{ active: route.name === 'home' }">
          <router-link :to="{ name: 'home' }">
            <el-icon><HomeFilled /></el-icon>
            {{ t('nav.home') }}
          </router-link>
        </li>
        <li :class="{ active: route.name === 'stationSearch' }">
          <router-link :to="{ name: 'stationSearch' }">
            <el-icon><Search /></el-icon>
            {{ t('nav.search') }}
          </router-link>
        </li>
        <li :class="{ active: route.name === 'export' }">
          <router-link :to="{ name: 'export' }">
            <el-icon><Download /></el-icon>
            {{ t('nav.export') }}
          </router-link>
        </li>
        <li :class="{ active: route.name === 'about' }">
          <router-link :to="{ name: 'about' }">
            <el-icon><InfoFilled /></el-icon>
            {{ t('nav.about') }}
          </router-link>
        </li>
        <li class="nav-language">
          <el-dropdown trigger="click" popper-class="nav-language__menu" @command="handleLanguageChange">
            <span class="nav-language__trigger" :title="t('nav.language')">
              <svg class="nav-language__globe" viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="M3 12h18" />
                <path d="M12 3c2.5 2.5 3.8 5.7 3.8 9s-1.3 6.5-3.8 9" />
                <path d="M12 3c-2.5 2.5-3.8 5.7-3.8 9s1.3 6.5 3.8 9" />
              </svg>
              {{ currentLanguage.label }}
              <el-icon class="nav-language__arrow"><ArrowDown /></el-icon>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item
                  v-for="item in languages"
                  :key="item.value"
                  :command="item.value"
                  :class="{ 'is-active': locale === item.value }"
                >
                  {{ item.label }}
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </li>
      </ul>
      <QuickSearch />
    </div>
  </nav>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ElIcon } from 'element-plus'
import 'element-plus/es/components/icon/style/css'
import { ArrowDown, Download, HomeFilled, InfoFilled, Search } from '@element-plus/icons-vue'
import QuickSearch from './QuickSearch.vue'
import { setLocale, SUPPORTED_LOCALES, getCurrentLanguageLabel, type Locale } from '../i18n'

const route = useRoute()
const isSearch = computed(() => String(route.path).startsWith('/search'))
void isSearch

const { t, locale } = useI18n()

const languages = computed(() => SUPPORTED_LOCALES.map(value => ({
  value, label: getCurrentLanguageLabel(value),
})))
const currentLanguage = computed(
  () => languages.value.find((item) => item.value === locale.value) ?? languages.value[0],
)

function handleLanguageChange(value: Locale) {
  setLocale(value)
}
</script>

<style scoped lang="scss">
.site-nav.navbar.mainNav {
  background: transparent;
  background-image: none;
  border: 0;
  box-shadow: none;
  min-height: 0;
  margin-bottom: 0;
}

.site-nav :deep(.navbar-collapse) {
  padding: 0;
  border: 0;
}

.site-nav :deep(.navbar-nav) {
  display: flex;
  align-items: center;
  padding-left: 0;
  margin: 0;
  float: none;
}

.site-nav :deep(.navbar-nav > li) {
  float: none;
}

.oscar-header__right {
  display: flex;
  align-items: center;
  margin-left: auto;
  min-width: 0;
}

.site-nav :deep(.navbar-nav > li) {
  background-image: none;
}

.site-nav :deep(.navbar-nav > li > a) {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 48px;
  padding: 0 18px;
  color: #4b6073;
  font-size: 14px;
  border: 0;
  background: transparent;
}

.site-nav :deep(.navbar-nav > li > a .fa) {
  color: var(--oscar-theme);
  font-size: 15px;
}

.site-nav :deep(.navbar-nav > li > a .el-icon) {
  color: var(--oscar-theme);
}

.site-nav :deep(.navbar-nav > li.active > a),
.site-nav :deep(.navbar-nav > li.active > a:hover),
.site-nav :deep(.navbar-nav > li.active > a:focus) {
  background: transparent !important;
  color: var(--oscar-theme) !important;
  border: 0 !important;
  box-shadow: inset 0 -3px 0 var(--oscar-theme);
}

.site-nav :deep(.navbar-nav > li > a:hover),
.site-nav :deep(.navbar-nav > li > a:focus) {
  background: transparent;
  color: var(--oscar-theme);
  text-decoration: none;
}

.site-nav :deep(.navbar-nav > li.nav-language) {
  display: flex;
  align-items: center;
}

.nav-language__trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 48px;
  padding: 0 18px;
  color: #4b6073;
  font-size: 14px;
  cursor: pointer;
  outline: none;
  transition: color 0.2s ease;
}

.nav-language__trigger:hover,
.nav-language__trigger:focus {
  color: var(--oscar-theme);
}

.nav-language__trigger .el-icon {
  color: var(--oscar-theme);
  font-size: 15px;
}

.nav-language__globe {
  width: 15px;
  height: 15px;
  flex: none;
  fill: none;
  stroke: var(--oscar-theme);
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.nav-language__arrow {
  font-size: 12px !important;
  color: #778da1 !important;
}


.site-nav :deep(.navbar-form.navbar-right) {
  margin: 6px 12px 0 0;
}

.site-nav :deep(.navbar-form > .fa-search) {
  top: 10px;
  left: 22px;
  color: #778da1;
  z-index: 1;
}

.site-nav :deep(.navbar-form > .form-control) {
  width: 180px;
  height: 34px;
  padding-left: 34px;
  border-radius: 18px;
  background: #fff;
  border: 1px solid #c9daea;
  color: #243746;
  box-shadow: none;
}

.site-nav :deep(.navbar-form > .form-control::placeholder) {
  color: #778da1;
}

.site-nav :deep(.navbar-form > .form-control:focus) {
  width: 260px;
  border-color: var(--oscar-theme);
  color: #243746;
}
</style>

<style lang="scss">
.nav-language__menu .el-dropdown-menu__item.is-active {
  color: var(--oscar-theme);
  font-weight: 600;
}
</style>


