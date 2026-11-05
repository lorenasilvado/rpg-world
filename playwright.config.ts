import { defineConfig } from '@playwright/test'

// E2E do app. Usa o Google Chrome instalado (channel 'chrome'), sem baixar navegadores.
// Dois projetos:
// - app: o servidor de desenvolvimento, na raiz (porta 5199);
// - pages: o build servido pelo `vite preview` no caminho base do GitHub Pages
//   (porta 5198, /rpg-world/). No CI ele serve o dist/ do passo Build; localmente,
//   faz o build antes.
const PREVIEW = 'npx vite preview --port 5198 --strictPort'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    channel: 'chrome',
  },
  projects: [
    {
      name: 'app',
      testIgnore: /pages\.spec\.ts/,
      use: { baseURL: 'http://localhost:5199' },
    },
    {
      name: 'pages',
      testMatch: /pages\.spec\.ts/,
      use: { baseURL: 'http://localhost:5198/rpg-world/' },
    },
  ],
  webServer: [
    {
      command: 'npm run dev -- --port 5199 --strictPort',
      url: 'http://localhost:5199',
      reuseExistingServer: !process.env.CI,
    },
    {
      command: process.env.CI ? PREVIEW : `npx vite build && ${PREVIEW}`,
      url: 'http://localhost:5198/rpg-world/',
      reuseExistingServer: !process.env.CI,
    },
  ],
})
