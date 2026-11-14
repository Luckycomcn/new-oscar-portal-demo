<template>
  <div id="wrapper" class="container">
    <div
      id="content-wrapper"
      class="wrapper row-offcanvas row-offcanvas-left"
      :class="{ active: offCanvasOpen }"
    >
      <div id="navigationDIV" class="clearfix">
        <p class="pull-left visible-xs visible-sm">
          <button type="button" class="btn btn-default btn-xs" aria-label="Toggle navigation" :aria-expanded="offCanvasOpen" aria-controls="xs-menu" @click="offCanvasOpen = !offCanvasOpen">
            <svg class="legacy-replacement-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
          </button>
        </p>
        <AppHeader />
      </div>

      <div>
        <div class="col-xs-12 col-sm-4 hidden-md hidden-lg sidebar-offcanvas" id="xs-menu">
          <ul class="list-group">
            <li class="list-group-item" :class="{ active: route.name === 'home' }">
              <router-link :to="{ name: 'home' }" @click="offCanvasOpen = false">{{ t('menu.home') }}</router-link>
            </li>
            <li class="list-group-item" :class="{ active: isSearch }">
              <router-link :to="{ name: 'stationSearch' }" @click="offCanvasOpen = false">{{ t('menu.search') }}</router-link>
              <ul class="nav nav-stacked sideBar list-group subNav">
                <li
                  v-for="item in searchNav"
                  :key="item.name"
                  :class="{ active: route.name === item.name }"
                >
                  <router-link :to="{ name: item.name }" @click="offCanvasOpen = false">{{ t(item.labelKey) }}</router-link>
                </li>
              </ul>
            </li>
            <li class="list-group-item" :class="{ active: route.name === 'export' }">
              <router-link :to="{ name: 'export' }" @click="offCanvasOpen = false">{{ t('nav.export') }}</router-link>
            </li>
            <li class="list-group-item" :class="{ active: route.name === 'about' }">
              <router-link :to="{ name: 'about' }" @click="offCanvasOpen = false">{{ t('nav.about') }}</router-link>
            </li>
          </ul>
        </div>

        <div id="mainContentArea">
          <div>
            <div class="col-xs-12 col-sm-12 hidden-md hidden-lg">
              <QuickSearch />
            </div>
            <div class="clearfix"></div>
            <div :class="{ 'is-expanded': sidebarCollapsed }">
              <div v-if="crumbs.length" class="crumbs-row">
                <ol class="breadcrumb">
                    <li><router-link :to="{ name: 'home' }">{{ t('route.home') }}</router-link></li>
                    <li v-for="(c, i) in crumbs" :key="c" :class="{ active: i === crumbs.length - 1 }">
                      <span v-if="i < crumbs.length - 1">{{ t(c) }}</span>
                      <span v-else>{{ t(c) }}</span>
                    </li>
                  </ol>
              </div>
              <router-view />
            </div>
          </div>
        </div>
        <AppFooter />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import AppHeader from './AppHeader.vue'
import AppFooter from './AppFooter.vue'
import QuickSearch from './QuickSearch.vue'
import { searchNav } from '../data/content'

const { t } = useI18n()
const route = useRoute()
const offCanvasOpen = ref(false)
const sidebarCollapsed = ref(false)
const isSearch = computed(() => String(route.path).startsWith('/search'))
const crumbs = computed(() => (route.meta.crumbs as string[] | undefined) ?? [])

watch(
  () => route.fullPath,
  () => {
    offCanvasOpen.value = false
  },
)
</script>

<style scoped lang="scss">
#mainContentArea {
  overflow-x: clip;
  min-width: 0;
}

.crumbs-row {
  margin: 0 0 10px;
}

.crumbs-row .breadcrumb {
  margin-bottom: 0;
}
</style>