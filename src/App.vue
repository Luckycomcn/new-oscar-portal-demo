<template>
  <el-config-provider :locale="elementLocale">
    <AppLayout />
  </el-config-provider>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElConfigProvider } from 'element-plus'
import 'element-plus/es/components/config-provider/style/css'
import elementEn from 'element-plus/es/locale/lang/en'
import elementZh from 'element-plus/es/locale/lang/zh-cn'
import elementFr from 'element-plus/es/locale/lang/fr'
import elementEs from 'element-plus/es/locale/lang/es'
import type { Locale } from './i18n'
import AppLayout from './components/AppLayout.vue'

const { locale } = useI18n()
const elementLocales = { en: elementEn, zh: elementZh, fr: elementFr, es: elementEs }
const elementLocale = computed(() => elementLocales[locale.value as Locale] ?? elementEn)
</script>
