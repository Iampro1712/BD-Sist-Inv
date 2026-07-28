import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// La versión sale de package.json y se inyecta en el bundle. Una sola fuente de
// verdad: al subir la versión para un release no hay que acordarse de tocar
// además un archivo del frontend, que es como se termina mostrando un número
// viejo en pantalla.
const { version } = JSON.parse(readFileSync('./package.json', 'utf-8'))

// https://vite.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks (solo librerías importadas estáticamente).
          // jspdf, jspdf-autotable y exceljs se cargan vía import() dinámico
          // (ver utils/exportReportes.js), por lo que Rollup ya los emite como
          // chunks async bajo demanda — no deben listarse aquí.
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'query-vendor': ['@tanstack/react-query'],
          'motion-vendor': ['framer-motion'],
          'charts-vendor': ['recharts'],
          'form-vendor': ['axios', 'zustand'],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
    // Copiar archivos públicos adicionales
    copyPublicDir: true,
  },
  publicDir: 'public',
})
