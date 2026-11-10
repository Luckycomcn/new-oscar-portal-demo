<template>
  <div class="oscar-header">
    <div class="oscar-header__left">
      <a target="_blank" href="https://www.wmo.int" class="oscar-header__wmo">
        <!-- <img src="/images/logo_wmo.png" alt="World Meteorological Organization" /> -->
        <img src="../assets/wmoLogo.jpeg" alt="World Meteorological Organization" />
        <span class="oscar-header__wmo-text">{{ $t('header.wmo1') }}<br />{{ $t('header.wmo2') }}<br />{{ $t('header.wmo3') }}</span>
      </a>
      <span class="oscar-header__divider"></span>
      <router-link :to="{ name: 'home' }" class="oscar-header__brand">
        <span class="oscar-header__brand-name">{{ $t('header.brandName') }}</span>
        <span class="oscar-header__brand-sub">{{ $t('header.brandSub1') }}<br /> {{ $t('header.brandSub2') }} <br />{{ $t('header.brandSub3') }}</span>
      </router-link>
    </div>
    <div class="oscar-header__right">
      <AppNavbar />
    </div>
  </div>
</template>

<script setup lang="ts">
import AppNavbar from './AppNavbar.vue'
</script>

<style scoped lang="scss">
$header-wmo-blue: #005288;
$header-ink: #333;
$header-border: #e5e5e5;
$header-sep: #9db3ad;

.oscar-header {
  $root: &;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  background: #fff;
  padding: 10px 18px 8px;
  border-bottom: 1px solid $header-border;

  &__left {
    display: flex;
    align-items: center;
    gap: 14px;
    min-width: 0;
  }

  &__wmo {
    display: flex;
    align-items: center;
    gap: 8px;
    text-decoration: none;

    img {
      height: 52px;
      width: auto;
    }

    &-text {
      font-size: 9px;
      line-height: 1.35;
      letter-spacing: 0.04em;
      color: $header-wmo-blue;
      font-weight: 600;
    }
  }

  &__divider {
    width: 1px;
    align-self: stretch;
    background: $header-sep;
    margin: 4px 2px;
  }

  &__brand {
    display: flex;
    align-items: center;
    gap: 8px;
    text-decoration: none;

    &-name {
      font-size: 32px;
      font-weight: 800;
      letter-spacing: 0.02em;
      color: var(--oscar-theme);
      line-height: 1;
    }

    &-sub {
      font-size: 10px;
      line-height: 1.3;
      color: $header-ink;
    }
  }

  &__ch {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    text-decoration: none;
    color: $header-ink;
    font-size: 8.5px;
    line-height: 1.35;
    text-align: left;
  }

  @media (max-width: 900px) {
    flex-wrap: wrap;

    #{$root}__brand-sub,
    #{$root}__ch {
      display: none;
    }
  }
}
</style>
