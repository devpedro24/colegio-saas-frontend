import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: "/",
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    chunkSizeWarningLimit: 3000,
  },
  server: {
    // Permite acceder por subdominio del colegio en desarrollo:
    // http://<slug>.localhost:5173 (ej: http://colegio-rbac.localhost:5173)
    host: true,
    allowedHosts: true,
    proxy: {
      // Las llamadas /api se redirigen al backend Laravel CONSERVANDO el Host
      // (changeOrigin: false), para que el backend resuelva el tenant por el
      // subdominio. Asi evitamos CORS en desarrollo.
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: false,
      },
    },
  },
})
