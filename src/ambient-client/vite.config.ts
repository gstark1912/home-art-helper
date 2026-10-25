import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

// El puerto concreto del backend se acuerda en T005; hasta entonces es un
// parámetro de desarrollo. Se puede sobrescribir con VITE_PROXY_TARGET.
// El cliente sólo llama rutas relativas /api y /hubs: el proxy reenvía al
// servidor .NET preservando el Origin del navegador (changeOrigin: false).
const DEFAULT_PROXY_TARGET = 'http://127.0.0.1:5173'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const target = env.VITE_PROXY_TARGET ?? DEFAULT_PROXY_TARGET

  return {
    plugins: [vue()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      proxy: {
        '/api': {
          target,
          changeOrigin: false,
        },
        '/hubs': {
          target,
          changeOrigin: false,
          ws: true,
        },
      },
    },
    build: {
      // El servidor .NET sirve este directorio como SPA (T003/T005).
      outDir: 'dist',
      emptyOutDir: true,
    },
  }
})
