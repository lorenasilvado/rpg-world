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
    include: ['alea', 'simplex-noise', 'comlink'],
  },
  // Quatro páginas: o app, o mockup estático do mapa do spike visual (#7), em /mockup.html, a
  // medição da geração no worker (#9), em /bench.html, e a medição dos 5.000 sprites (#10), em
  // /sprites.html.
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        mockup: fileURLToPath(new URL('./mockup.html', import.meta.url)),
        bench: fileURLToPath(new URL('./bench.html', import.meta.url)),
        sprites: fileURLToPath(new URL('./sprites.html', import.meta.url)),
      },
    },
  },
  // O worker de geração (src/workers) é um módulo ES, como no `npm run dev`.
  worker: {
    format: 'es',
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
  },
}))
