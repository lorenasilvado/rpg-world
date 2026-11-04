---
updated: 2026-11-04
fase: pronto
---

# Preparo do projeto

Checklist do que o projeto precisa antes do `/planejar`. Você pode abri-lo antes, para saber o que
separar em `_import/`; o `/preparar` o usa como estado da entrevista (retoma de onde parou).

`fase`: `inventario` · `entrevista` · `pronto`

Status: `tem` · `parcial` · `falta` · `n/a`
Nível: **trava** (sem isso o /planejar não roda) · **ajuda** (pode ficar para depois)

| # | Item | Nível | Status | Evidência (arquivo §seção) | Destino | Em aberto |
|---|------|-------|--------|----------------------------|---------|-----------|
| 1 | Visão, problema e público | trava | tem | PRD §Visão geral e objetivos | prd.md |  |
| 2 | Features com IDs e MoSCoW | trava | tem | PRD §Requisitos funcionais (RF-1 a RF-5), §Fora de escopo | prd.md (Features) | F1–F4 Must, F5 e Medir distância Should; áreas uma por feature (rodadas 1 e 2) |
| 3 | Decisões técnicas: stack, plataformas, hospedagem, banco | trava | tem | PRD §Stack de tecnologias, §RNF-6; ADRs 0001, 0002 | overview.md + ADRs | |
| 4 | Fluxos de usuário com erros e estados vazios | trava | tem | Telas.md §Fluxo, 02, 03, E3; DS PDF §05 Feedback | specs/ | rodadas 4 e 5; os textos dos avisos ficaram como TODO nas specs (item 10) |
| 5 | Modelo de dados e glossário | trava | parcial | PRD §Modelo de dados, §Pipeline | overview.md + specs | bordas: limitado; rios e lagos na v1; pins com hierarquia (rodada 3). Pendentes: sizeKm, versões do gerador, campo da hierarquia no Pin, rios e lagos no modelo |
| 6 | Integrações externas (APIs, auth, limites) | trava | n/a | ADR 0003 | specs + ADRs | n/a: app só local na v1, sem contas, backend nem integrações (ADR 0003); fontes e ícones vêm de CDN no protótipo |
| 7 | Design system e tokens | trava | tem | design-system.md §1–9; DS PDF | design/design-system.md + tokens.json (PDF em design/, depois do .md) | valores dos presets em rpg-kit.js (não veio) |
| 8 | Telas ou mockups das features Must | trava | tem | Telas.md; screens/*.png (7 telas × 2 temas) | assets/design/ (imagens); PDF em design/; specs (Referência) | as telas sem mockup (busca, exportar, renomear, excluir mundo, abas Detalhes/Conexões, mobile, boas-vindas, drawer da estrada) seguem o design system, com prints revistos no PR (rodada 5) |
| 9 | Requisitos não funcionais | ajuda | tem | PRD §Requisitos não funcionais | prd.md + specs |  |
| 10 | Textos da interface (microcopy, erros) | ajuda | parcial | Telas PDF; DS PDF §05; screens | specs | poucos textos de erro |
| 11 | Logo, ícones, fontes | ajuda | parcial | design-system.md §2, §5, §9 | assets/design/ (imagens) + tokens.json | logo só nas telas, sem arquivo; pins em rpg-kit.js |
| 12 | Dispositivos e tamanhos de tela | ajuda | parcial | Telas.md §Fundamentos (1440×900); PRD RNF-6, RNF-7 | qa/print-rules.md | tamanhos dos prints não definidos |
| 13 | Métricas de sucesso do MVP | ajuda | tem | PRD §Métricas de sucesso | prd.md |  |
| 14 | Referências e moodboard | ajuda | parcial | PRD §Alternativas e diferencial; §Análise do RPG-land | assets/design/ (imagens); PDF em design/ | sem imagens de referência |
| 15 | Dados de exemplo para testes | ajuda | falta |  | issue de setup |  |

- PDFs e imagens guardados são referência para pessoas; os agentes leem os `.md`. O material
  original fica em `_import/`, fora do git, e o `/preparar` pergunta se pode apagá-lo no final.
- Item que não se aplica (ex.: projeto sem integrações) → `n/a`, com o motivo em Em aberto.
- O item 3 também alimenta a issue de setup (stack) e o `.github/workflows/ci.yml` (lint e testes).
- Item `trava` que ficou `parcial` só por `> Pendente:` não impede o `pronto` se o usuário aceitar;
  o `/planejar` deixa as issues que dependem dele para depois.

## Para o /planejar

<!-- Preenchido pelo /preparar. O que o material diz sobre ordem de entrega e trabalho a fazer.
     Não é decisão: é ponto de partida para o /planejar, que decide com o usuário. -->

### Fases, milestones e ordem de entrega

| # | O que o material diz | Fonte (arquivo §seção) | Features (F#) |
|---|----------------------|------------------------|---------------|
| 1 | Fase 0 de validação visual e dez fases em sequência; a v1 fecha na Fase 7, estradas são a Fase 8 e o 3D fica para depois. Cada fase termina com app funcionando e critério de aceite verificável | PRD §Roadmap | — |
| 2 | Fase 0 — Spike visual: mockup estático do mapa (paleta posterizada, contorno de costa, água rasa, 3 a 4 ícones decorativos) antes de qualquer código de produção. Aceite: mockup aprovado como referência visual da v1; paleta e spritesheet inicial definidos | PRD §Roadmap | F1 |
| 3 | Fase 1 — Fundação: Vite + React + TS, Tailwind, shadcn/ui, ESLint, Vitest, estrutura de pastas e layout vazio (sidebar, mapa, drawer). Aceite: `npm run dev`, `lint` e `test` passam; layout responde abaixo de 768 px | PRD §Roadmap | — |
| 4 | Fase 2 — Núcleo de geração: RNG com seed, ruído 3D, campos em arrays tipados, classificação por quantis. Aceite: determinismo (hash igual para a mesma seed) e oceano = 30% gera 30% ± 2% de água | PRD §Roadmap | F1 |
| 5 | Fase 3 — Worker e prévia: Comlink, transferência sem cópia, prévia 256² e final 1024² com cancelamento. Aceite: UI a 60 fps durante a geração; metas do RNF-2 | PRD §Roadmap | F1 |
| 6 | Fase 4 — Renderer e câmera: Pixi, pixi-viewport, textura com paleta posterizada, costa, hillshade, minimapa, barra de escala. Aceite: pan, zoom no cursor e pinça a 60 fps; o mapa não sai da tela | PRD §Roadmap | F2 |
| 7 | Fase 5 — Sidebar completa: sliders com debounce, seed, presets, avançados, assistente; acessível por teclado. Aceite: cada slider muda o mapa de forma visível e previsível; preset "Deserto árido" gera maioria de deserto; sliders só com teclado | PRD §Roadmap | F1 |
| 8 | Fase 6 — Decoração cartoon: spritesheet, Poisson-disk por bioma, culling e nível de detalhe por zoom. Aceite: 5.000 ícones sem cair abaixo de 55 fps | PRD §Roadmap | F1, F2 |
| 9 | Fase 7 — Pins, drawer e persistência (marco v1): modo adicionar, ícones e upload, agrupamento, drawer, busca, undo, Dexie, lista de mundos, export/import JSON e PNG. Aceite: criar, editar, mover e excluir pin; recarregar mantém tudo; JSON exportado reimporta idêntico | PRD §Roadmap | F3, F4 |
| 10 | Fase 8 — Estradas: desenho manual com Catmull-Rom; A\* no worker com custo por bioma e inclinação; "Conectar cidades"; drawer da estrada. Aceite: rota automática nunca cruza água (exceto marítima) e evita montanhas quando há desvio | PRD §Roadmap | F5 |
| 11 | Fase 9 — Polimento: rótulos com fonte de fantasia, atalhos, dicas de boas-vindas, medir distância, auditoria de acessibilidade, E2E com Playwright. Aceite: fluxos principais em E2E; navegação completa só com teclado | PRD §Roadmap | F1, F2, F3 |
| 12 | Fase 10 — Preparação 3D: projeção esférica no core, renderer Three.js (cube-sphere), pins de (u, v) para lat/lon. Aceite: o mesmo mundo no plano e na esfera com os mesmos continentes e pins | PRD §Roadmap | — (fora do escopo da v1) |

### Trabalho a construir

| # | Item | Fonte (arquivo §seção) | Feature (F#) | Observação |
|---|------|------------------------|--------------|------------|
| 1 | Decidir se há rios e lagos na v1 antes do núcleo de geração (rios mudam o custo do A\* das estradas) | PRD §Questões em aberto | F1, F5 | Decidido na rodada 3: rios e lagos na v1; método pendente na spec de F1 |
| 2 | Começar os ícones com um pacote CC0 (ex.: Kenney), spritesheet isolado em `render/style` | PRD §Riscos | F1 | |
| 3 | Teste de hash do mapa em Chrome, Firefox e WebKit no CI (Playwright) | PRD §Riscos; RNF-4 | F1 | |
| 4 | Manter as versões antigas do gerador (`generatorVersion`) | PRD §Riscos | F4 | Quantas e por quanto tempo está em aberto (overview.md) |

- Uma linha por trecho do material, citando a fonte, sem reescrever nem decidir nada.
- "Features" e "Feature" usam os ids `F#` do PRD; se o trecho não casa com nenhuma feature, deixe
  vazio e escreva o motivo em Observação.
- Contradições entre fontes (ex.: duas ordens diferentes) entram como linhas separadas, e a
  contradição vai para a entrevista como as outras.

## Registro da entrevista

<!-- uma linha por rodada: data, itens tratados, decisões, o que virou Pendente -->

- 2026-11-04 · inventário: material de `_import/` (PRD, Telas.md, design-system.md, 2 PDFs, demo, 14 telas) organizado em `docs/`. Telas PDF e demo não importados.
- 2026-11-04 · rodada 1: contradições e item 2. Presets: "Deserto árido" e "Terras geladas" (contra as telas). Seed: sortear e copiar, sem "Gerar". Neve em Relevo e seção Avançado na sidebar. F5 e Medir distância: Should.
- 2026-11-04 · rodada 2: itens 2, 3 e 6. Áreas: area:geracao, area:mapa, area:pins, area:mundos, area:estradas. Stack do PRD aceita (ADR 0001). Hospedagem no GitHub Pages com o repositório público (ADR 0002). Só local na v1 (ADR 0003).
- 2026-11-04 · rodada 3: item 5. Mapa limitado, com oceano nas bordas. Rios e lagos na v1, sem hidrologia (método, modelo e estilo viraram Pendente). Pins com hierarquia (detalhes Pendente). sizeKm: decido depois (Pendente).
- 2026-11-04 · rodada 4: item 4. Sem WebGL2: aviso no lugar do editor, a lista funciona. Pin excluído sem confirmação, com Desfazer (muda o PRD, que pedia confirmação); mundo excluído com confirmação. Erro ao salvar: tenta de novo e oferece Tentar de novo e Exportar .json. Imagem acima de 1 MB: mensagem, e o usuário escolhe recusar ou aceitar com redução; formato errado é recusado.
- 2026-11-04 · rodada 5: itens 4 e 8. Lista carregando: cartões esqueleto. Editor abrindo: prévia borrada como no E3. Rota automática sem caminho: toast com "Criar rota marítima". Telas sem mockup seguem o design system, com prints revistos no PR.
- 2026-11-04 · fechamento: fase pronto, com o item 5 parcial só por Pendente (aceito pelo usuário).
