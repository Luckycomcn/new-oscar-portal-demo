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
    <span class="footer-version">
      @ 2026 <a :href="repositoryUrl" target="_blank" rel="noopener noreferrer">new-oscar-portal-demo</a> {{ version }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { version } from '../../package.json'

const repositoryUrl = 'https://github.com/Luckycomcn/new-oscar-portal-demo'
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
.footer-version a {
  color: #005288;
  text-decoration: none;
}
.footer-version a:hover,
.footer-version a:focus-visible {
  text-decoration: underline;
}
</style>
