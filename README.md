# RPG World Builder

Aplicação web para mestres de RPG e worldbuilders gerarem, a partir de uma seed, um mapa cartoon
de um mundo fictício e marcarem nele cidades, NPCs e locais, com anotações em cada pin e estradas
entre eles. Roda no navegador e salva os mundos localmente, sem backend.

**No ar:** <https://lorenasilvado.github.io/rpg-world/> (GitHub Pages, publicado a cada merge na
`main`).

## O que o app faz

| ID | Feature | Spec |
|---|---|---|
| F1 | Geração de terreno determinística por seed, com sliders de bioma, rios e lagos | [geracao-terreno.md](docs/specs/geracao-terreno.md) |
| F2 | Pan, zoom no cursor, pinça e medir distância | [navegacao.md](docs/specs/navegacao.md) |
| F3 | Pins com ícones ou imagens próprias, editados num drawer lateral, com Desfazer | [pins.md](docs/specs/pins.md) |
| F4 | Mundos salvos no navegador (IndexedDB), exportação e importação em JSON | [mundos.md](docs/specs/mundos.md) |
| F5 | Estradas desenhadas à mão, rota automática pelo terreno, rota marítima e "Conectar cidades" | [estradas.md](docs/specs/estradas.md) |

Visão, escopo e requisitos não funcionais no [PRD](docs/prd.md); andamento no
[roadmap](docs/roadmap.md). M0 a M2 estão encerrados (a v1 é o M2); as tasks do M3 (Estradas e
rotas) estão todas feitas, falta o fechamento do milestone.

## Rodando localmente

Pré-requisito: o Node do `.nvmrc` (o mesmo do CI).

```bash
npm install
npm run dev        # http://localhost:5173
```

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento do Vite |
| `npm run lint` | oxlint |
| `npm run typecheck` | `tsc -b` (TypeScript strict) |
| `npm test` | Vitest (jsdom) |
| `npm run e2e` | Playwright em `e2e/`: Chrome instalado, mais Firefox e WebKit do Playwright (instale uma vez com `npx playwright install firefox webkit`) |
| `npm run build` | Build de produção em `dist/`, com o caminho base `/rpg-world/` do Pages |
| `npm run preview` | Serve o `dist/` em `http://localhost:4173/rpg-world/` |

Os projetos do Playwright (app, pages, determinismo nos 3 motores, fluxos, iPhone e desempenho)
estão descritos em [`playwright.config.ts`](playwright.config.ts) e no
[`docs/overview.md`](docs/overview.md#desenvolvimento).

## Stack e arquitetura

Vite, React 19, TypeScript strict, Tailwind + Radix, Zustand (+ zundo para desfazer), PixiJS v8
com pixi-viewport, simplex-noise num Web Worker via Comlink, TipTap, zod e Dexie
([ADR 0001](docs/adr/0001-stack-da-v1.md)). Hospedagem no GitHub Pages
([ADR 0002](docs/adr/0002-hospedagem-github-pages.md)); só local na v1
([ADR 0003](docs/adr/0003-app-so-local-na-v1.md)).

Quatro camadas que só conversam por contratos: a UI (React) escreve no estado (Zustand); o núcleo
de geração (TS puro, em `src/core/`) roda no worker e devolve arrays prontos; o renderer (Pixi)
só desenha o que o estado contém; a persistência guarda seed, parâmetros, pins e estradas (o
terreno é regerado).

| Pasta | O quê |
|---|---|
| `src/core/` | Geração (ruído, campos, biomas, decoração), rotas (A*) e projeção, sem React nem Pixi |
| `src/workers/` | Workers de geração e de rota, via Comlink |
| `src/render/` | App Pixi, viewport, camadas do mapa e paleta |
| `src/state/` | Stores do mundo, pins, estradas, UI e histórico |
| `src/features/` | Sidebar, pins, busca, estradas e mundos |
| `src/persistence/` | Dexie, salvamento automático, exportar e importar |
| `e2e/` | Testes E2E do Playwright |

Detalhes (pipeline de geração, modelo de dados, glossário) em
[`docs/overview.md`](docs/overview.md).

## Documentação

| O quê | Onde | Pergunta que responde |
|---|---|---|
| Visão, escopo, features | [`docs/prd.md`](docs/prd.md) | O que o produto é e por quê |
| Comportamento atual de cada feature | [`docs/specs/`](docs/specs/) | Como funciona **hoje** |
| Decisões | [`docs/adr/`](docs/adr/README.md) | Por que foi feito assim |
| Trabalho a fazer | **Issues do GitHub** | O que falta mudar |
| Milestones, ordem e status das issues | [`docs/roadmap.md`](docs/roadmap.md) | O que vem agora |
| Plano de cada milestone | [`docs/milestones/`](docs/milestones/) | O que entra no milestone |
| Design system e referências | [`docs/design/`](docs/design/README.md) | Como o app deve parecer |

- **A spec descreve o presente; a issue descreve a mudança.** Um PR que muda comportamento
  atualiza a spec no mesmo PR. Features têm IDs estáveis (`F1`…`F5`) e cada critério de aceite
  também (`AC-F2-03`).
- **O roadmap dá a ordem e o status** (`todo`, `doing`, `done`) de cada issue. A linha já entra
  como `done` no PR da task, então a `main` mostra o estado real depois de cada merge.
- **Sem board:** o projeto não usa GitHub Projects (`BOARD=nao` em `scripts/board.conf`). O
  andamento fica no roadmap, na página Milestones do GitHub e nos PRs abertos.

## Como o trabalho é feito

O processo é conduzido pelo Claude Code, com um comando por fase em `.claude/commands/`. A regra
completa está no [`CLAUDE.md`](CLAUDE.md); outras ferramentas (Codex, Cursor…) leem o
[`AGENTS.md`](AGENTS.md), que aponta para ele. Se este README divergir, vale o `CLAUDE.md`.

| Comando | Papel | Para quando |
|---|---|---|
| `/planejar M<n>` | PM | Doc do milestone, ACs nas specs e issues; PR `[docs] Planejar M<n>` aberto |
| `/implementar [issue]` | Dev | Branch `task/<N>-<slug>`, status `doing` e commits locais |
| `/qa [issue]` | Tester | Prints em `pr-assets/issue-<N>/<sha7>/` e relatório |
| `/abrir-pr [issue]` | Dev | PR aberto ou atualizado, com o head no corpo |
| `/revisar [pr \| local]` | Reviewer (subagente) | Review postado no PR, ou só na conversa no modo local |
| `/corrigir [pr ou issue]` | Dev | Só o apontado, commitado e enviado |
| `/fechar [pr]` | PM | Issue conferida, nits viram issues; no fim do milestone, critério de saída |

Ciclo de uma task: `/implementar` → seu teste contra os ACs → `/revisar local` e `/qa` →
`/abrir-pr` → `/revisar` → `/corrigir` → merge (`./scripts/merge.sh <pr> <head>`) → `/fechar`.
Depois do `/fechar` da última issue de um milestone, vem o `/planejar M<n+1>`.

Os scripts de `scripts/` fazem tudo no GitHub pela API REST do repositório (`gh api`); a tabela
"para quê → script" está no `CLAUDE.md`. Eles têm testes com `gh` simulado:
`./scripts/test/run.sh` (precisa de `jq`, `yq` e `python3` com `yaml`).

## Merge gate

O PR aprova um head. O ruleset da `main` exige dois checks verdes nesse head, com a branch
atualizada com a `main`:

| Check | Workflow | O que confere |
|---|---|---|
| `ci` | [`ci.yml`](.github/workflows/ci.yml) | Lint, tipos, testes, build e E2E; PR só de docs termina verde logo no início |
| `pr-gate` | [`pr-gate.yml`](.github/workflows/pr-gate.yml) → `scripts/pr-gate.sh` | O `**Head:**` do corpo é o head do PR e os prints citados são de um commit com o mesmo código |

- **Push num PR aberto:** rode `./scripts/open-pr.sh --update <pr>` para reescrever o `Head:` e a
  pasta de prints. Se o push mudou código, teste de novo e refaça os prints (`/qa`).
- **PR só de docs** (`./scripts/docs-only.sh`: tudo em `docs/` ou `*.md`, exceto o `CLAUDE.md`)
  dispensa prints e QA.
- **Merge travado no head:** `./scripts/merge.sh <pr> <head>`; se o head mudou depois da
  conferência, o GitHub recusa. O botão de merge da interface funciona, mas sem essa trava.
- **Squash:** o commit na `main` fica `<título do PR> (#N)`, com o corpo do PR como mensagem.
- **Nunca dê push na `main`.**

## Quando algo dá errado

| Sintoma | Causa | O que fazer |
|---|---|---|
| `pr-gate`: `Head do corpo desatualizado` | push depois de o corpo do PR ser escrito | `./scripts/open-pr.sh --update <pr>`; se o push mudou código, teste de novo |
| `pr-gate`: `O corpo do PR não tem a linha **Head:**` | PR aberto à mão | `./scripts/open-pr.sh --update <pr>` |
| `pr-gate`: `e o código mudou até o head` | prints de um commit anterior ao código atual | `/qa` de novo e `--update`, ou `--prints "n/a: <motivo>"` se a mudança não é visual |
| `open-pr.sh`: `Não há prints em pr-assets/issue-` | nenhum print vale para o head | `/qa`, ou `--prints "n/a: <motivo>"` |
| `open-pr.sh`: `Há commits sem push` | o PR só abre com tudo enviado | `git push -u origin task/<N>-<slug>` |
| merge bloqueado: branch atrás da `main` | a `main` andou | rebase em `origin/main`, `git push --force-with-lease` e `--update` |
| `merge.sh`: `Head branch was modified` | push depois do review ou do sha copiado | conferir o push; `/revisar` se mudou código; `merge.sh` com o head atual |
| `/implementar`: `ainda está aberta: falta o merge ou o /fechar` | o PR anterior não foi mergeado ou o `/fechar` não rodou | merge e `/fechar`, ou passar o número da issue |
| `/implementar`: `escreva o AC na spec` | a issue cita um AC que não existe na spec | escrever o AC (no PR da task ou pelo `/planejar M<n>`) |
| `/planejar M<n>`: `só planejo o milestone que for o próximo` | o milestone anterior não foi encerrado | `/fechar` do anterior |
