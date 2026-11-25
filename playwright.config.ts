import { defineConfig, devices } from '@playwright/test'

// E2E do app. Os projetos app e pages usam o Google Chrome instalado (channel 'chrome').
// Projetos:
// - app: o servidor de desenvolvimento, na raiz (porta 5199);
// - pages: o build servido pelo `vite preview` no caminho base do GitHub Pages
//   (porta 5198, /rpg-world/). No CI ele serve o dist/ do passo Build; localmente,
//   faz o build antes;
// - determinismo-chrome, -firefox e -webkit: o hash do núcleo de geração nos 3 motores
//   (#8, RNF-4), no servidor de desenvolvimento. Firefox e WebKit são os do Playwright:
//   instale uma vez com `npx playwright install firefox webkit`;
// - fluxos-firefox e fluxos-webkit: os fluxos principais do M1 (#55) e os de pins e mundos do M2
//   (#168) de ponta a ponta, no servidor de desenvolvimento; no Chrome, eles rodam no projeto app;
// - desempenho: a medição da geração no worker (#9, RNF-2) e o fps de pan e zoom (#55, #168), no
//   servidor de desenvolvimento.
//   Roda depois de todos os outros projetos e sozinha: em paralelo com eles, a disputa pela CPU
//   atrasa os quadros da UI e a medição deixa de valer. Para rodar só ela:
//   `npx playwright test --project=desempenho --no-deps`.
const DEV = 'http://localhost:5199'
const DETERMINISMO = /determinismo\.spec\.ts/
const DESEMPENHO = /(desempenho|fps)\.spec\.ts/
const FLUXOS = /fluxos(-m2)?\.spec\.ts/
const PREVIEW = 'npx vite preview --port 5198 --strictPort'

// Os testes abrem o editor com as dicas de boas-vindas já vistas (AC-F1-31), para o cartão não
// cobrir o mapa; o e2e/boas-vindas.spec.ts começa sem a marca.
const WELCOME_DONE = [{ name: 'rpg-world:welcome-tips', value: 'done' }]
const TIPS_SEEN = {
  cookies: [],
  origins: [
    { origin: DEV, localStorage: WELCOME_DONE },
    { origin: 'http://localhost:5198', localStorage: WELCOME_DONE },
  ],
}

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  reporter: process.env.CI ? 'github' : 'list',
  use: { storageState: TIPS_SEEN },
  projects: [
    {
      name: 'app',
      testIgnore: [/pages\.spec\.ts/, DETERMINISMO, DESEMPENHO],
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
    {
      name: 'fluxos-firefox',
      testMatch: FLUXOS,
      // No Linux sem GPU do CI, o Firefox desliga o WebGL2; `webgl.force-enabled` pede que ele o
      // ligue mesmo assim, por software. Se continuar sem, o fluxo é pulado com o motivo.
      use: {
        ...devices['Desktop Firefox'],
        baseURL: DEV,
        launchOptions: { firefoxUserPrefs: { 'webgl.force-enabled': true } },
      },
    },
    {
      name: 'fluxos-webkit',
      testMatch: FLUXOS,
      use: { ...devices['Desktop Safari'], baseURL: DEV },
    },
    {
      name: 'desempenho',
      testMatch: DESEMPENHO,
      dependencies: [
        'app',
        'pages',
        'determinismo-chrome',
        'determinismo-firefox',
        'determinismo-webkit',
        'fluxos-firefox',
        'fluxos-webkit',
      ],
      use: { channel: 'chrome', baseURL: DEV },
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
