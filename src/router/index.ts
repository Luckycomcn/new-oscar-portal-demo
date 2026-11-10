import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(),
  scrollBehavior() {
    return { top: 0 }
  },
  routes: [
    { path: '/', name: 'home', component: () => import('../views/HomeView.vue'), meta: { title: 'route.home', crumbs: [] } },
    {
      path: '/search',
      name: 'stationSearch',
      component: () => import('../views/SearchView.vue'),
      meta: { title: 'route.stationSearch', crumbs: ['route.search', 'route.stationSearch'] },
    },
    {
      path: '/search/station/stationReportDetails/:wigosId',
      name: 'stationReportDetails',
      component: () => import('../views/StationReportView.vue'),
      meta: { title: 'route.stationReport', crumbs: ['route.search', 'route.stationSearch', 'route.stationReport'] },
    },
    { path: '/export', name: 'export', component: () => import('../views/ExportView.vue'), meta: { title: 'route.export', crumbs: ['route.export'] } },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

const OSCAR_TITLE = 'Observing Systems Capability Analysis and Review Tool (OSCAR)'

router.afterEach(() => {
  document.title = OSCAR_TITLE
})

export default router