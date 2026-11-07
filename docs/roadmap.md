---
updated: 2026-11-05
---

# Roadmap

Duas seções. **Milestones** é a visão geral, escrita pelo `/planejar` (sem argumento): todos os
milestones, só em prosa, sem tasks. **Issues por milestone** tem as tasks, e só do milestone que
já foi detalhado pelo `/planejar M<n>`: nunca existem issues de milestones futuros.

Status das issues: `todo` · `doing` · `done`. O roadmap guarda o destino de cada linha: `doing`
quando a task começa (`/implementar`) e `done` já no PR dela (`/abrir-pr`), para entrar na `main`
com o merge. O andamento real (PR aberto, issue fechada) o board mostra, pelo `./scripts/sync-board.sh`.

A ordem das linhas é a ordem de execução (a coluna Ordem é global): a primeira linha `todo` é
sempre a próxima. Linhas são criadas por `./scripts/new-issue.sh` e o status muda por
`./scripts/task-status.sh`; a coluna PR é preenchida pelo `./scripts/open-pr.sh`.

## Milestones

### M0 — Fundação e spike
- **Objetivo:** projeto rodando na stack do ADR 0001 e os três maiores riscos testados antes do
  código de produção.
- **Escopo:** setup do projeto (#1), layout vazio do editor e publicação no GitHub Pages
  (ADR 0002) + spikes de risco: **visual** (mockup estático do mapa com
  paleta posterizada, contorno de costa, água rasa e 3 a 4 ícones decorativos), **determinismo**
  (mesmo hash do campo de terreno para a mesma seed no Chrome, Firefox e WebKit, RNF-4) e
  **desempenho** (prévia 256² ≤ 150 ms e mapa 1024² ≤ 1,5 s num worker, RNF-2; 5.000 sprites no
  PixiJS ≥ 55 fps, RNF-1).
- **Critério de saída:** go/no-go: `npm run dev`, `lint` e `test` passam e o layout vazio
  (sidebar, mapa, drawer) responde abaixo de 768 px; o mockup é aprovado como referência visual
  da v1, com paleta e spritesheet inicial definidos; o teste de hash passa nos 3 navegadores; as
  metas de tempo e de fps são atingidas.
- **Depende de / decisões abertas:** repositório público para o GitHub Pages e a proteção da
  `main` (ADR 0002); licença dos ícones (começar com um pacote CC0, ex.: Kenney).
- **Tamanho:** M

### M1 — Mapa gerado e navegável
- **Objetivo:** criar um mundo pelo assistente e ajustar o terreno pelos sliders, vendo o mapa
  cartoon mudar de forma previsível, com pan e zoom fluidos.
- **Escopo:** F1, F2.
- **Critério de saída:** cada slider muda o mapa de forma visível e previsível; oceano = 30% gera
  30% ± 2% de água; o preset "Deserto árido" gera maioria de deserto; pan, zoom no cursor e pinça
  a 60 fps com 5.000 ícones decorativos; todos os sliders funcionam só com teclado; os fluxos
  principais estão cobertos por E2E.
- **Depende de / decisões abertas:** go do M0. Antes do núcleo de geração: método dos rios e
  lagos. Também em aberto: valores dos presets, `sizeKm` padrão, comportamento de Camadas e Ajuda.
  Medir distância (Should) entra no fim e pode ser cortada.
- **Tamanho:** G

### M2 — Pins e mundos (v1)
- **Objetivo:** usar o mapa como caderno de campanha, com pins editáveis e mundos salvos,
  exportados e importados. **Marco: v1.**
- **Escopo:** F3, F4.
- **Critério de saída:** criar, editar, mover e excluir pin (com Desfazer); recarregar a página
  mantém tudo; JSON exportado reimporta idêntico; um usuário novo cria um mundo e marca 10 pins
  em menos de 10 minutos; pan e zoom sem travar com 500 pins.
- **Depende de / decisões abertas:** fim do M1. Em aberto: regras da hierarquia de pins e o campo
  dela no `Pin`; conteúdo das abas Detalhes e Conexões; outros motivos de recusa na importação.
- **Tamanho:** G

### M3 — Estradas e rotas
- **Objetivo:** ligar os pins com estradas desenhadas à mão ou geradas pelo terreno.
- **Escopo:** F5 (Should).
- **Critério de saída:** a rota automática entre dois pins nunca cruza água (exceto rota
  marítima) e evita montanhas quando há desvio; "Conectar cidades" gera a malha; o drawer da
  estrada edita e exclui.
- **Depende de / decisões abertas:** fim do M2. Em aberto: como a rota trata rios e lagos
  (pontes); onde fica o botão "Conectar cidades".
- **Tamanho:** M

Fora dos milestones: a preparação 3D (Fase 10 do material), porque o planeta 3D é Won't na v1. O
polimento (Fase 9) foi distribuído pelos milestones das features que ele toca.

## Issues por milestone

### M0 — Fundação e spike

| Ordem | Issue | Título | Status | Spec | PR |
|---|---|---|---|---|---|
| 1 | #1 | [chore] Setup do projeto | done | — | #12 |
| 2 | #5 | [chore] Layout vazio do editor | done | — | #17 |
| 3 | #6 | [chore] Publicar no GitHub Pages | done | — | #22 |
| 4 | #7 | [chore] Spike visual: mockup estático do mapa | done | — | #26 |
| 5 | #8 | [chore] Spike de determinismo entre navegadores | done | — | |
| 6 | #9 | [chore] Spike de desempenho: geração no worker | todo | — | |
| 7 | #10 | [chore] Spike de desempenho: 5.000 sprites no PixiJS | todo | — | |
