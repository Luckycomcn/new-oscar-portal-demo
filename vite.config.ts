import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'

export default defineConfig({
  base: './',
  server: { proxy: { '/wmdr-source': {
    target: 'https://oscar.wmo.int', changeOrigin: true,
    rewrite: (path) => path.replace(/^\/wmdr-source/, '/oai/provider'),
  }, '/oscar-station': {
    target: 'https://oscar.wmo.int', changeOrigin: true,
    rewrite: (path) => path.replace(/^\/oscar-station/, '/surface/rest/api/stations/station'),
  }, '/oscar-pdf': {
    target: 'https://oscar.wmo.int', changeOrigin: true,
    rewrite: (path) => path.replace(/^\/oscar-pdf/, '/surface/rest/api/stations/download/station'),
  } } },
  preview: { proxy: { '/wmdr-source': {
    target: 'https://oscar.wmo.int', changeOrigin: true,
    rewrite: (path) => path.replace(/^\/wmdr-source/, '/oai/provider'),
  }, '/oscar-station': {
    target: 'https://oscar.wmo.int', changeOrigin: true,
    rewrite: (path) => path.replace(/^\/oscar-station/, '/surface/rest/api/stations/station'),
  }, '/oscar-pdf': {
    target: 'https://oscar.wmo.int', changeOrigin: true,
    rewrite: (path) => path.replace(/^\/oscar-pdf/, '/surface/rest/api/stations/download/station'),
  } } },
  plugins: [
    vue(),
    AutoImport({
      resolvers: [ElementPlusResolver()],
    }),
    Components({
      resolvers: [ElementPlusResolver()],
    }),
  ],
})

