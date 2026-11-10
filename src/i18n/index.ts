import { createI18n } from 'vue-i18n'
import en from './locales/en'
import zh from './locales/zh'
import fr from './locales/fr'
import es from './locales/es'

export type Locale = 'en' | 'zh' | 'fr' | 'es'

export const SUPPORTED_LOCALES: Locale[] = ['en', 'zh', 'fr', 'es']

const DEFAULT_LOCALE: Locale = 'en'
const STORAGE_KEY = 'oscar-locale'

function isLocale(value: unknown): value is Locale {
  return SUPPORTED_LOCALES.includes(value as Locale)
}

function resolveInitialLocale(): Locale {
  if (typeof localStorage === 'undefined') return DEFAULT_LOCALE
  const stored = localStorage.getItem(STORAGE_KEY)
  return isLocale(stored) ? stored : DEFAULT_LOCALE
}

export const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: resolveInitialLocale(),
  fallbackLocale: DEFAULT_LOCALE,
  messages: { en, zh, fr, es },
})

export function getLocale(): Locale {
  return (i18n.global.locale.value as Locale) || DEFAULT_LOCALE
}

export function setLocale(next: Locale) {
  if (!isLocale(next)) return
  i18n.global.locale.value = next
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, next)
  }
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('lang', next === 'zh' ? 'zh-CN' : next)
  }
}

export function getCurrentLanguageLabel(locale: Locale) {
  return { en: 'English', zh: '中文', fr: 'Français', es: 'Español' }[locale]
}

export function translate(key: string): string {
  return i18n.global.t(key)
}

export { en, zh, fr, es }
