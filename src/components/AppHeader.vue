<template>
  <div class="oscar-header">
    <div class="oscar-header__left">
      <router-link :to="{ name: 'home' }" class="oscar-header__logo">
        <img src="../assets/oscar-logo.svg" alt="OSCAR — Observing Systems Capability Analysis and Review Tool" />
      </router-link>
      <!-- <span class="oscar-header__divider" aria-hidden="true"></span>
      <router-link :to="{ name: 'home' }" class="oscar-header__brand">
        <span class="oscar-header__brand-name">{{ $t('header.portalName') }}</span>
        <span class="oscar-header__brand-sub">{{ $t('header.portalTagline') }}</span>
      </router-link> -->
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
$header-border: #e5e5e5;
$header-sep: #9db3ad;

.oscar-header {
  $root: &;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  background: #fff url('../assets/header-grid.svg') no-repeat 48% center / 560px auto;
  min-height: 72px;
  box-sizing: border-box;
  padding: 10px 24px;
  border-bottom: 1px solid $header-border;

  &__left {
    display: flex;
    align-items: center;
    gap: 22px;
    min-width: 0;
  }

  &__logo {
    display: block;
    width: 300px;
    max-width: 55vw;
    flex-shrink: 0;

    img {
      display: block;
      width: 100%;
      height: auto;
    }
  }

  &__divider {
    width: 1px;
    height: 32px;
    flex-shrink: 0;
    background: $header-sep;
    margin: 4px 2px;
  }

  &__brand {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 5px;
    text-decoration: none;

    &-name {
      font-size: 18px;
      font-weight: 600;
      color: #174661;
      line-height: 1.25;
    }

    &-sub {
      font-size: 11px;
      letter-spacing: 0.08em;
      line-height: 1.3;
      color: #718793;
    }
  }

  &__right {
    flex-shrink: 0;
    background: #fff;
  }

  @media (max-width: 1200px) {
    #{$root}__brand-name { font-size: 15px; }
    #{$root}__left { gap: 14px; }
    #{$root}__logo { width: 270px; }
  }

  @media (max-width: 900px) {
    flex-wrap: wrap;

    #{$root}__left {
      flex-wrap: wrap;
    }

    #{$root}__brand,
    #{$root}__divider {
      display: none;
    }
  }
}
</style>
