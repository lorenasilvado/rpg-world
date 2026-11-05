import { defineConfig } from '@playwright/test'

// E2E do app. Usa o Google Chrome instalado (channel 'chrome'), sem baixar navegadores.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:5199',
    channel: 'chrome',
  },
  webServer: {
    command: 'npm run dev -- --port 5199 --strictPort',
    url: 'http://localhost:5199',
    reuseExistingServer: !process.env.CI,
  },
})
