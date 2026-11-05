/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Caminho base do GitHub Pages (ADR 0002): https://<owner>.github.io/rpg-world/.
// O build e o `vite preview` (que serve o build) usam o base; o `npm run dev` e o E2E ficam na raiz.
const PAGES_BASE = '/rpg-world/'

// https://vite.dev/config/
export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? PAGES_BASE : '/',
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
  },
}))
