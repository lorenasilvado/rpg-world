---
updated: 2026-11-21
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
- **Escopo:** F1, F2. Dois itens de F1 dependem de F3 e F4 e entram no M2: o aviso de pins sobre a
  água e as dicas de boas-vindas.
- **Critério de saída:** cada slider muda o mapa de forma visível e previsível; oceano = 30% gera
  30% ± 2% de água; no preset "Deserto árido", mais de 50% da terra firme sem montanhas é deserto;
  pan, zoom no cursor e pinça a 60 fps de média e pelo menos 55 fps de mínimo, com 5.000 ícones
  decorativos; todos os sliders funcionam só com teclado; os fluxos principais estão cobertos por
  E2E.
- **Depende de / decisões abertas:** go do M0 ([ADR 0004](adr/0004-go-no-go-m0.md)). Rios e lagos
  no [ADR 0006](adr/0006-rios-com-sliders-de-forma.md), que substituiu o 0005. Medir distância (Should) entra
  no fim e pode ser cortada.
- **Tamanho:** G

### M2 — Pins e mundos (v1)
- **Objetivo:** usar o mapa como caderno de campanha, com pins editáveis e mundos salvos,
  exportados e importados. **Marco: v1.**
- **Escopo:** F3, F4, e os dois itens de F1 que dependem delas: o aviso de pins sobre a água e as
  dicas de boas-vindas.
- **Critério de saída:** criar, editar, mover e excluir pin (com Desfazer); recarregar a página
  mantém tudo; JSON exportado reimporta idêntico; um usuário novo cria um mundo e marca 10 pins
  em menos de 10 minutos; pan e zoom sem travar com 500 pins.
- **Depende de / decisões abertas:** fim do M1. Hierarquia de pins, abas Detalhes e Conexões e
  motivos de recusa na importação decididos no [plano do M2](milestones/m2.md). Em aberto: quantas
  versões antigas do gerador manter.
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
| 5 | #8 | [chore] Spike de determinismo entre navegadores | done | — | #30 |
| 6 | #9 | [chore] Spike de desempenho: geração no worker | done | — | #33 |
| 7 | #10 | [chore] Spike de desempenho: 5.000 sprites no PixiJS | done | — | #37 |

### M1 — Mapa gerado e navegável

| Ordem | Issue | Título | Status | Spec | PR |
|---|---|---|---|---|---|
| 8 | #41 | [feat] Núcleo: elevação, continente e costa | done | specs/geracao-terreno.md | #58 |
| 9 | #31 | [chore] Proteger os parâmetros padrão do núcleo e validar os params | done | — | #58 |
| 10 | #59 | [docs] Decidir o AC-F1-04 e o ADR 0005 para Continente e Costa | done | specs/geracao-terreno.md | #62 |
| 11 | #42 | [feat] Núcleo: clima, biomas e praias | done | specs/geracao-terreno.md | #65 |
| 12 | #68 | [chore] Distinguir campo gelado da neve de montanha | done | specs/geracao-terreno.md | #72 |
| 13 | #43 | [feat] Núcleo: rios e lagos | done | specs/geracao-terreno.md | #74 |
| 14 | #44 | [feat] Núcleo: decoração por Poisson-disk | done | specs/geracao-terreno.md | #77 |
| 15 | #45 | [feat] Worker de produção e prévia contínua | done | specs/geracao-terreno.md | #79 |
| 16 | #34 | [chore] Tratar falha ao carregar o worker de geração | done | specs/geracao-terreno.md | #81 |
| 17 | #36 | [chore] Medir o worker novo, sem aquecimento, no bench | done | — | #85 |
| 18 | #46 | [feat] Renderer: terreno em textura | done | specs/geracao-terreno.md | #89 |
| 19 | #93 | [feat] Renderer: rios a partir do pé da montanha e foz suave | done | specs/geracao-terreno.md | #96 |
| 20 | #47 | [feat] Câmera: pan, zoom, pinça e teclado | done | specs/navegacao.md | #100 |
| 21 | #91 | [chore] E2E do mapa: conferir o enquadramento no celular e no tablet | done | specs/geracao-terreno.md | #103 |
| 22 | #92 | [chore] Borda do mapa sem corte reto nas faixas do oceano | done | specs/navegacao.md | #106 |
| 23 | #48 | [feat] Camada de decoração com culling e nível de detalhe | done | specs/navegacao.md | #110 |
| 24 | #90 | [chore] Medir o custo da textura do terreno (terrainPixels) | done | specs/geracao-terreno.md | #111 |
| 25 | #27 | [chore] Decoração do mapa: traços do design system | done | specs/geracao-terreno.md | #115 |
| 26 | #94 | [feat] Núcleo: deserto com oásis e água interior como lago | done | specs/geracao-terreno.md | #121 |
| 27 | #49 | [feat] Sidebar: seções e sliders | done | specs/geracao-terreno.md | #122 |
| 28 | #50 | [feat] Sidebar: seed, presets e restaurar | done | specs/geracao-terreno.md | #125 |
| 29 | #51 | [feat] Distribuição do mapa, Gerando e sem WebGL2 | done | specs/geracao-terreno.md | #128 |
| 30 | #52 | [feat] Assistente de novo mundo | done | specs/geracao-terreno.md | #133 |
| 31 | #53 | [feat] Minimapa, escala e controles de zoom | done | specs/navegacao.md | #136 |
| 32 | #54 | [feat] Barras do editor, Camadas e Ajuda | done | specs/navegacao.md | #139 |
| 33 | #55 | [chore] E2E dos fluxos e medição de saída do M1 | done | specs/geracao-terreno.md | #142 |
| 34 | #56 | [feat] Medir distância | done | specs/navegacao.md | #146 |
| 35 | #104 | [chore] E2E do mapa: nome dos testes do tablet e do celular | done | specs/geracao-terreno.md | #151 |
| 36 | #105 | [chore] E2E do mapa: conferir o enquadramento em 767 e 768 px | done | specs/geracao-terreno.md | #153 |

### M2 — Pins e mundos (v1)

| Ordem | Issue | Título | Status | Spec | PR |
|---|---|---|---|---|---|
| 37 | #154 | [feat] Mundos: salvar no navegador e reabrir | done | specs/mundos.md | #170 |
| 38 | #155 | [feat] Lista de mundos: tela inicial, vazia e abrir | done | specs/mundos.md | #176 |
| 39 | #156 | [feat] Lista de mundos: renomear, duplicar e excluir | done | specs/mundos.md | #183 |
| 40 | #157 | [feat] Pins no mapa: adicionar, desenhar e selecionar | done | specs/pins.md | #188 |
| 41 | #158 | [feat] Pins: arrastar, excluir e desfazer | done | specs/pins.md | #192 |
| 42 | #199 | [bug] E2E do assistente: o print do mapa leva os controles por cima e às vezes difere entre as abas | done | specs/geracao-terreno.md | #200 |
| 43 | #159 | [feat] Drawer do pin: ficha, descrição, tags e rodapé | done | specs/pins.md | #198 |
| 44 | #137 | [chore] Escala e porcentagem do zoom à vista com o drawer aberto | done | specs/navegacao.md | #205 |
| 45 | #160 | [feat] Drawer do pin: Detalhes, ícone e imagem enviada | done | specs/pins.md | #206 |
| 46 | #208 | [bug] No iPhone, focar um campo do drawer do pin aproxima a página, e ela não volta | done | specs/pins.md | #209 |
| 47 | #210 | [bug] No iPhone, focar a seed ou o nome do mundo aproxima a página, e ela não volta | done | specs/geracao-terreno.md | #211 |
| 48 | #212 | [bug] No desktop, sem pin selecionado, o drawer fica à vista vazio e corta o mapa | done | specs/pins.md | #214 |
| 49 | #161 | [feat] Hierarquia de pins e aba Conexões | doing | specs/pins.md | |
| 50 | #162 | [feat] Pins: agrupamento e ocultar por tipo | todo | specs/pins.md | |
| 51 | #163 | [feat] Buscar pins (Ctrl K) | todo | specs/pins.md | |
| 52 | #140 | [chore] Opacidade do Buscar desabilitado igual à dos outros botões da barra | todo | specs/navegacao.md | |
| 53 | #164 | [feat] Exportar e importar o mundo em JSON | todo | specs/mundos.md | |
| 54 | #165 | [feat] Aviso de pins sobre a água | todo | specs/geracao-terreno.md | |
| 55 | #166 | [feat] Dicas de boas-vindas | todo | specs/geracao-terreno.md | |
| 56 | #167 | [feat] Exportar o mapa como PNG | todo | specs/mundos.md | |
| 57 | #168 | [chore] E2E dos fluxos e medição de saída do M2 | todo | specs/pins.md | |
