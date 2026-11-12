<template>
  <div
    id="about_gawsis"
    style="
      display: flex;
      justify-content: space-between;
      align-items: center;
      min-height: 48px;
      flex-wrap: wrap;
      gap: 10px 18px;
      padding: 4px 10px;
      border-top: 0.5px solid #dbe8e1;
      color: #6b8077;
      width: 100%;
      font-size: 1rem;
    "
  >
    <a href="https://www.wmo.int" target="_blank" rel="noopener noreferrer" class="footer-wmo">
      <img src="../assets/wmoLogo.jpeg" alt="World Meteorological Organization" />
      <span>{{ $t('header.wmo1') }}<br />{{ $t('header.wmo2') }}<br />{{ $t('header.wmo3') }}</span>
    </a>
    <span>
      {{ $t('footer.disclaimer') }}
    </span>
    <span>{{ $t('footer.version', { version }) }}</span>
  </div>
</template>

<script setup lang="ts">
import { version } from '../../package.json'
</script>

<style scoped>
.footer-wmo {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  color: #005288;
  text-decoration: none;
}
.footer-wmo img {
  height: 32px;
  width: auto;
}
.footer-wmo span {
  font-size: 7px;
  line-height: 1.35;
  letter-spacing: 0.04em;
  font-weight: 600;
}
</style>
