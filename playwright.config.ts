import { defineConfig, devices } from '@playwright/test'

// E2E do app. Os projetos app e pages usam o Google Chrome instalado (channel 'chrome').
// Projetos:
// - app: o servidor de desenvolvimento, na raiz (porta 5199);
// - pages: o build servido pelo `vite preview` no caminho base do GitHub Pages
//   (porta 5198, /rpg-world/). No CI ele serve o dist/ do passo Build; localmente,
//   faz o build antes;
// - determinismo-chrome, -firefox e -webkit: o hash do núcleo de geração nos 3 motores
//   (#8, RNF-4), no servidor de desenvolvimento. Firefox e WebKit são os do Playwright:
//   instale uma vez com `npx playwright install firefox webkit`.
const DEV = 'http://localhost:5199'
const DETERMINISMO = /determinismo\.spec\.ts/
const PREVIEW = 'npx vite preview --port 5198 --strictPort'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  reporter: process.env.CI ? 'github' : 'list',
  projects: [
    {
      name: 'app',
      testIgnore: [/pages\.spec\.ts/, DETERMINISMO],
      use: { channel: 'chrome', baseURL: DEV },
    },
    {
      name: 'pages',
      testMatch: /pages\.spec\.ts/,
      use: { channel: 'chrome', baseURL: 'http://localhost:5198/rpg-world/' },
    },
    {
      name: 'determinismo-chrome',
      testMatch: DETERMINISMO,
      use: { channel: 'chrome', baseURL: DEV },
    },
    {
      name: 'determinismo-firefox',
      testMatch: DETERMINISMO,
      use: { ...devices['Desktop Firefox'], baseURL: DEV },
    },
    {
      name: 'determinismo-webkit',
      testMatch: DETERMINISMO,
      use: { ...devices['Desktop Safari'], baseURL: DEV },
    },
  ],
  webServer: [
    {
      command: 'npm run dev -- --port 5199 --strictPort',
      url: DEV,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: process.env.CI ? PREVIEW : `npx vite build && ${PREVIEW}`,
      url: 'http://localhost:5198/rpg-world/',
      reuseExistingServer: !process.env.CI,
    },
  ],
})
