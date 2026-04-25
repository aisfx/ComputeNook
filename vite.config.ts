import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      // xpra-html5-client 的 exports 字段不含 dist 子路径，直接指向主文件
      'xpra-html5-client': resolve(__dirname, 'node_modules/xpra-html5-client/dist/xpra.es.js'),
    }
  },
  server: {
    port: 3000,
    proxy: {
      '/config.js': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        ws: true,
      },
      '/novnc': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      }
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'esnext',
    commonjsOptions: {
      include: [/@novnc\/novnc/, /node_modules/],
    },
    rollupOptions: {
      external: [],
    }
  },
  optimizeDeps: {
    include: ['@novnc/novnc/lib/rfb.js'],
  }
})
