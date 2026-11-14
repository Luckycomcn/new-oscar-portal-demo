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
      path: '/station/report/:wigosId',
      name: 'stationReportDetails',
      component: () => import('../views/StationReportView.vue'),
      meta: { title: 'route.stationReport', crumbs: ['route.search', 'route.stationSearch', 'route.stationReport'] },
    },
    { path: '/export', name: 'export', component: () => import('../views/ExportView.vue'), meta: { title: 'route.export', crumbs: ['route.export'] } },
    { path: '/about', name: 'about', component: () => import('../views/AboutView.vue'), meta: { title: 'route.about', crumbs: ['route.about'] } },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

const OSCAR_TITLE = 'New OSCAR Portal – Demo'

router.afterEach(() => {
  document.title = OSCAR_TITLE
})

export default router
