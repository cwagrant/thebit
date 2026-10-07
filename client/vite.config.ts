import { fileURLToPath, URL } from 'node:url'

import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// The API server reads PORT from server/.env - read the same file here so the
// dev proxy follows it.
const serverEnv = loadEnv('', '../server', '')
const apiTarget = `http://localhost:${serverEnv.PORT || 3131}`

// https://vite.dev/config/
export default defineConfig({
  build: {
    outDir: "../dist/client"
  },
  plugins: [
    vue(),
    vueDevTools(),
  ],
  server: {
    proxy: {
      '/api': {
        target: apiTarget,
        // The live status feed (/api/events) is a WebSocket.
        ws: true
      },
      '/oauth': {
        target: apiTarget
      },
    }
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
})
