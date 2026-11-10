<template>
  <div
    id="about_gawsis"
    style="
      display: flex;
      justify-content: space-between;
      align-items: center;
      height: 40px;
      padding: 4px 10px;
      border-top: 0.5px solid #dbe8e1;
      color: #6b8077;
      width: 100%;
      font-size: 1rem;
    "
  >
    <span>{{ $t('footer.attribution') }}</span>
    <span>
      {{ $t('footer.disclaimer') }}
    </span>
    <span>{{ $t('footer.version', { version }) }}</span>
  </div>
</template>

<script setup lang="ts">
import { version } from '../../package.json'
</script>
