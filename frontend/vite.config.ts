import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    // Explicit target so mobile Safari (iOS 14+) and equivalent Android
    // browsers don't choke on syntax newer Vite defaults may emit.
    target: ['es2020', 'safari14', 'chrome87', 'edge88', 'firefox78'],
    cssTarget: ['safari14', 'chrome87'],
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (
              id.includes('/react/') ||
              id.includes('/react-dom/') ||
              id.includes('/react-router-dom/') ||
              id.includes('/react-router/')
            ) {
              return 'vendor-react'
            }
            if (id.includes('/recharts/')) {
              return 'vendor-charts'
            }
            if (id.includes('/date-fns/')) {
              return 'vendor-date'
            }
          }
        },
      },
    },
  },
})
