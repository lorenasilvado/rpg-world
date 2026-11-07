/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

// Caminho base do GitHub Pages (ADR 0002): https://<owner>.github.io/rpg-world/.
// O build e o `vite preview` (que serve o build) usam o base; o `npm run dev` e o E2E ficam na raiz.
const PAGES_BASE = '/rpg-world/'

// https://vite.dev/config/
export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? PAGES_BASE : '/',
  plugins: [react(), tailwindcss()],
  // O núcleo de geração (src/core) ainda não é importado pelo app: sem isto, o Vite só descobre
  // alea e simplex-noise no import() do teste de determinismo, otimiza de novo e recarrega a
  // página no meio do teste (#8).
  optimizeDeps: {
    include: ['alea', 'simplex-noise'],
  },
  // Duas páginas: o app e o mockup estático do mapa do spike visual (#7), em /mockup.html.
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        mockup: fileURLToPath(new URL('./mockup.html', import.meta.url)),
      },
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
  },
}))
