import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'

export default defineConfig({
  base: './',
  server: {
    port: 5173,
    host: '0.0.0.0',
    proxy: { '/wmdr-source': {
    target: 'https://oscar.wmo.int', changeOrigin: true,
    rewrite: (path) => path.replace(/^\/wmdr-source/, '/oai/provider'),
  } } },
  preview: { proxy: { '/wmdr-source': {
    target: 'https://oscar.wmo.int', changeOrigin: true,
    rewrite: (path) => path.replace(/^\/wmdr-source/, '/oai/provider'),
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

