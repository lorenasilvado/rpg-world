// @vitest-environment node
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { build } from 'vite'
import { afterAll, describe, expect, it } from 'vitest'

// O build de produção usa o caminho base do GitHub Pages (AC-M0-05).
describe('build para o GitHub Pages', () => {
  const outDir = mkdtempSync(join(tmpdir(), 'rpg-world-build-'))
  afterAll(() => rmSync(outDir, { recursive: true, force: true }))

  it('gera o index.html com os assets em /rpg-world/', async () => {
    await build({ logLevel: 'silent', build: { outDir, emptyOutDir: true } })
    const html = readFileSync(join(outDir, 'index.html'), 'utf-8')
    const refs = [...html.matchAll(/(?:src|href)="(\/[^"]*)"/g)].map((m) => m[1])
    expect(refs.length).toBeGreaterThan(0)
    for (const ref of refs) expect(ref.startsWith('/rpg-world/assets/')).toBe(true)

    const assets = readdirSync(join(outDir, 'assets'))
    for (const ref of refs) expect(assets).toContain(ref.replace('/rpg-world/assets/', ''))
  }, 60_000)
})
