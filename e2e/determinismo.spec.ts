import { expect, test } from '@playwright/test'
import { GOLDEN_HASHES, GOLDEN_SIZE } from '../src/core/world/golden.ts'

// Spike de determinismo (#8, RNF-4): o núcleo roda dentro do navegador (importado do servidor
// de desenvolvimento do Vite) e o hash do campo tem que bater com o de referência, o mesmo que o
// Vitest confere no Node. Roda nos projetos determinismo-chrome, -firefox e -webkit.
test('o hash do campo 256² é o de referência neste navegador (AC-M0-10, AC-M0-11)', async ({ page, browserName }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/')

  const hashes = await page.evaluate(
    async ({ seeds, size }) => {
      const url = '/src/core/index.ts'
      const core = await import(/* @vite-ignore */ url)
      return seeds.map((seed: string) => {
        const field = core.generateField(seed, size)
        return { seed, size: field.width * field.height, hash: core.hashField(field) as string }
      })
    },
    { seeds: GOLDEN_HASHES.map((g) => g.seed), size: GOLDEN_SIZE },
  )

  for (const h of hashes) test.info().annotations.push({ type: `hash ${browserName}`, description: `${h.seed}: ${h.hash}` })
  expect(hashes).toEqual(GOLDEN_HASHES.map((g) => ({ ...g, size: GOLDEN_SIZE * GOLDEN_SIZE })))
  expect(errors).toEqual([])
})
