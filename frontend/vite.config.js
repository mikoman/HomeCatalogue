import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        // Local vision models (Ollama/oMLX) can take minutes; keep the dev
        // proxy from 504'ing long-running scan requests. Values are in ms.
        // Mirrors the proxy_read_timeout in nginx.conf.
        timeout: 360000,
        proxyTimeout: 360000,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
