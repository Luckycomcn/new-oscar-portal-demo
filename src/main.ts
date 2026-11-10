import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { i18n, setLocale, getLocale } from './i18n'
import './style.scss'

setLocale(getLocale())
createApp(App).use(router).use(i18n).mount('#app')
