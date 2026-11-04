# Design system

Os valores vivem em [tokens.json](tokens.json); este arquivo explica como usá-los. O PDF
[design-system.pdf](design-system.pdf) é referência para pessoas: se divergir deste arquivo, vale
este arquivo.

Princípio: **duas camadas de estilo**. O mapa é cartoon, colorido e chapado, com ícones a nanquim
em estilo medieval; a interface é sóbria, em pergaminho, translúcida por cima do mapa.

Cada tela existe em tema claro e escuro, com layout, conteúdo e comportamento idênticos; só as
cores mudam. A paleta do mapa não muda com o tema. Idioma da interface: português do Brasil.
Viewport de referência das telas: 1440 × 900 px, desktop.

> Pendente: o material original cita como fonte da verdade visual `Design System.dc.html`,
> `Telas.dc.html` e `Editor.dc.html`, e como gerador de mapa, pins e ícones `rpg-kit.js` +
> `rpg-decor-medieval.js` (incluindo os valores de `PRESETS` e `RPG.pinSVG`). Esses arquivos não
> vieram no material: eles entram no repositório ou ficam só como referência externa?

## Cores

Todos os tokens são CSS custom properties aplicadas no elemento raiz do tema
(`:root, [data-theme="light"]` e `[data-theme="dark"]`). Valores por tema em `tokens.json →
color.light` e `color.dark`.

| Token | Claro | Escuro | Uso |
|---|---|---|---|
| `--bg` | `#E9E0CC` | `#14120F` | Fundo da Lista de mundos (mesa) |
| `--paper` | `rgba(247,241,227,.92)` | `rgba(30,27,24,.90)` | Painéis sobre o mapa (com `backdrop-filter: blur(14px)`) |
| `--paper-solid` | `#F7F1E3` | `#1E1B18` | Painéis opacos, modais, menus, cartões |
| `--field` | `#FFFBF2` | `#26221E` | Inputs, cartões internos, botão secundário |
| `--sunken` | `#EDE4D0` | `#171512` | Trilhos de slider, chips, teclas de atalho |
| `--line` | `rgba(43,36,32,.14)` | `rgba(239,232,218,.12)` | Bordas e divisores |
| `--line-2` | `rgba(43,36,32,.26)` | `rgba(239,232,218,.24)` | Bordas de inputs e botões secundários |
| `--ink` | `#2B2420` | `#EFE8DA` | Texto principal |
| `--ink-2` | `#5A4F45` | `#CFC5B3` | Texto secundário |
| `--ink-3` | `#726558` | `#A39886` | Legendas, placeholders |
| `--amber` | `#C8892B` | `#D99A3A` | Botão primário, ferramenta ativa, seleção, anel de foco |
| `--amber-hover` | `#B87A20` | `#E5A84A` | Primário em hover |
| `--amber-press` | `#A06A18` | `#C68A2E` | Primário pressionado |
| `--amber-ink` | `#8A5A12` | `#E8B465` | Texto âmbar (links, aba ativa, chip selecionado) |
| `--amber-soft` | `rgba(200,137,43,.18)` | `rgba(217,154,58,.18)` | Halo de foco em inputs, fundo de item selecionado |
| `--on-amber` | `#2B2420` | `#1E1B18` | Texto/ícone sobre âmbar |
| `--brick` | `#B33A2E` | `#B33A2E` | Somente ações destrutivas (fundo) |
| `--brick-ink` | `#A3352A` | `#E58377` | Texto de erro |
| `--brick-soft` | `rgba(179,58,46,.10)` | `rgba(229,131,119,.14)` | Fundo de área com erro |
| `--hover` | `rgba(43,36,32,.06)` | `rgba(239,232,218,.07)` | Fundo de hover em botões transparentes |
| `--press` | `rgba(43,36,32,.11)` | `rgba(239,232,218,.12)` | Fundo pressionado |
| `--scrim` | `rgba(43,36,32,.38)` | `rgba(0,0,0,.55)` | Fundo de modal |
| `--ok` | `#4C7A34` | `#8DBF6A` | Indicador "Salvo" |

Texto sobre `--brick` é sempre `#FFFFFF` nos dois temas. Hover/pressionado do destrutivo:
`#9C2F25` / `#86281F`.

### Contraste (AA)

Todos os textos atendem 4,5:1 sobre `--paper-solid` no respectivo tema: `--ink`, `--ink-2`,
`--ink-3`, `--amber-ink`, `--brick-ink`, `--ok`. Não use `--amber` como cor de texto sobre
pergaminho no tema claro (≈2,9:1): use `--amber-ink`.

### Copiar e colar

```css
:root, [data-theme="light"] {
  --bg:#E9E0CC; --paper:rgba(247,241,227,.92); --paper-solid:#F7F1E3; --field:#FFFBF2; --sunken:#EDE4D0;
  --line:rgba(43,36,32,.14); --line-2:rgba(43,36,32,.26);
  --ink:#2B2420; --ink-2:#5A4F45; --ink-3:#726558;
  --amber:#C8892B; --amber-hover:#B87A20; --amber-press:#A06A18; --amber-ink:#8A5A12; --amber-soft:rgba(200,137,43,.18); --on-amber:#2B2420;
  --brick:#B33A2E; --brick-ink:#A3352A; --brick-soft:rgba(179,58,46,.10);
  --hover:rgba(43,36,32,.06); --press:rgba(43,36,32,.11); --scrim:rgba(43,36,32,.38); --ok:#4C7A34;
  --shadow-sm:0 1px 2px rgba(74,48,20,.16);
  --shadow:0 6px 20px rgba(74,48,20,.18), 0 1px 3px rgba(74,48,20,.12);
  --shadow-lg:0 18px 48px rgba(43,30,15,.30), 0 2px 6px rgba(74,48,20,.14);
}
[data-theme="dark"] {
  --bg:#14120F; --paper:rgba(30,27,24,.90); --paper-solid:#1E1B18; --field:#26221E; --sunken:#171512;
  --line:rgba(239,232,218,.12); --line-2:rgba(239,232,218,.24);
  --ink:#EFE8DA; --ink-2:#CFC5B3; --ink-3:#A39886;
  --amber:#D99A3A; --amber-hover:#E5A84A; --amber-press:#C68A2E; --amber-ink:#E8B465; --amber-soft:rgba(217,154,58,.18); --on-amber:#1E1B18;
  --brick:#B33A2E; --brick-ink:#E58377; --brick-soft:rgba(229,131,119,.14);
  --hover:rgba(239,232,218,.07); --press:rgba(239,232,218,.12); --scrim:rgba(0,0,0,.55); --ok:#8DBF6A;
  --shadow-sm:0 1px 2px rgba(0,0,0,.4);
  --shadow:0 8px 24px rgba(0,0,0,.42), 0 1px 3px rgba(0,0,0,.3);
  --shadow-lg:0 20px 56px rgba(0,0,0,.55), 0 2px 6px rgba(0,0,0,.35);
}
```

## Tipografia

Fontes (Google Fonts):

```html
<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;700&family=Nunito:wght@400;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
```

| Família | Uso |
|---|---|
| **Nunito** | Toda a interface. Base 14/20. |
| **Cinzel** | Títulos de tela/painel/modal, nome do mundo, nome do pin, rótulos do mapa |
| **JetBrains Mono** | Seed e valores técnicos |

### Escala

| Nome | Fonte | Tamanho/linha | Peso | Exemplo |
|---|---|---|---|---|
| Display | Cinzel | 40/48 | 600 | Título de tela grande |
| Título de tela | Cinzel | 34/40 | 600 | "Seus mundos" |
| Título de modal | Cinzel | 24/32 (26/34 no assistente) | 600 | "Novo mundo", "Exportar" |
| Nome do pin (drawer) | Cinzel | 21/28 | 600 | "Valdora" |
| Nome do mundo (barra) | Cinzel | 16/20 | 600 | "Terras de Valdora" |
| Rótulo de mapa | Cinzel | 13/16 | 700 | Nome do pin no mapa |
| Região (futuro) | Cinzel | 15/16 | 600, `letter-spacing:.32em`, caixa alta | "MAR DE BRUMAS" |
| Título 20 | Nunito | 20/28 | 700 | |
| Título de cartão | Nunito | 16/22 | 700 | Nome do mundo no cartão |
| Corpo | Nunito | 14/20 | 400 | Texto padrão |
| Rótulo | Nunito | 14/20 | 700 | Nome de slider, label de campo |
| Legenda | Nunito | 12–13/16–18 | 600 | "Editado há 2 h · 14 pins" |
| Overline | Nunito | 11–12/16 | 800, `letter-spacing:.08em`, caixa alta | Cabeçalho de seção da sidebar |
| Valores | Nunito | 13 | 700, `font-variant-numeric: tabular-nums` | "45%", "100 km" |
| Seed | JetBrains Mono | 13–14 | 500 | "valdora-7f3a" |

### Rótulo de mapa com contorno

Contorno claro de 2 px para legibilidade sobre qualquer bioma:

```css
.map-label {
  font: 700 13px/16px Cinzel, serif; color: #2B2420;
  text-shadow: 0 0 2px #F7F1E3, 1px 1px 0 #F7F1E3, -1px -1px 0 #F7F1E3, 1px -1px 0 #F7F1E3,
               -1px 1px 0 #F7F1E3, 0 2px 0 #F7F1E3, 0 -2px 0 #F7F1E3, 2px 0 0 #F7F1E3, -2px 0 0 #F7F1E3;
}
```

Rótulos aparecem a partir do zoom 1,5×, ou em hover/seleção.

## Espaçamento

Escala em múltiplos de `space.unit` (4): `4 · 8 · 12 · 16 · 24 · 32 · 48`.

- Margem dos painéis flutuantes até a borda: 12 px.
- Padding interno de painel: 16 px (sidebar), 20 px (drawer), 28–32 px (modais).
- Gap entre controles em linha: 4–12 px. Entre cartões da Lista: 24 px.

### Raios

| Token | Valor | Uso |
|---|---|---|
| `radius.control` | 8 px | Botões, inputs, botões de ícone |
| `radius.panel` | 12 px | Painéis, cartões, popovers, toasts |
| `radius.modal` | 16 px | Modais e diálogos |
| `radius.pill` | 999 px | Chips, tags, indicador de salvamento |

### Sombras

`--shadow-sm` (controles), `--shadow` (painéis flutuantes), `--shadow-lg` (modais, menus,
drawer). Sombras quentes no claro, pretas no escuro.

### Anel de foco

Sempre âmbar e visível:

```css
/* botões */  box-shadow: 0 0 0 2px var(--paper-solid), 0 0 0 4px var(--amber);
/* inputs */  border-color: var(--amber); box-shadow: 0 0 0 3px var(--amber-soft);
```

**Área de toque mínima:** 44×44 px (botões de ícone, ferramentas, itens de menu). Exceção atual:
controles de zoom em 36 px no desktop.

## Movimento

| Elemento | Duração | Easing |
|---|---|---|
| Painéis (sidebar, drawer, popovers) | 200 ms | `cubic-bezier(.2,.8,.2,1)` |
| Câmera (centralizar pin, zoom animado) | 350 ms (300–400) | `cubic-bezier(.4,0,.2,1)` |
| Pin novo (quique) | 420–460 ms | `cubic-bezier(.3,1.6,.5,1)` |
| Pin excluído (encolhe) | 180 ms | ease-in |
| Pulsação do pin selecionado | 1,6 s loop | ease-out |
| Toast entrando | 200 ms | ease |
| Slider "recuou" (Desertos ↔ Florestas) | 700 ms flash âmbar | ease |
| Prévia do mapa ao gerar | `filter: blur(3px)` → nítido em 260 ms | ease |

`prefers-reduced-motion: reduce` → sem quique, sem pulsação, sem deslizamento de câmera (saltos
diretos).

## Ícones de interface

Lucide (linha simples), 20 px padrão, `currentColor`. CDN usado no protótipo:
`https://cdn.jsdelivr.net/npm/lucide-static@0.460.0/icons/{nome}.svg`.

| Ação | Ícone | Atalho |
|---|---|---|
| Buscar | `search` | Ctrl+K |
| Desfazer / Refazer | `undo-2` / `redo-2` | Ctrl+Z / Ctrl+Shift+Z |
| Exportar / Importar | `download` / `upload` | |
| Tema claro / escuro | `sun` / `moon` | |
| Ajuda | `circle-help` | ? |
| Navegar | `hand` | V |
| Adicionar pin | `map-pin-plus` | P |
| Desenhar estrada | `route` | R |
| Rota automática | `waypoints` | A |
| Camadas | `layers` | |
| Medir distância | `ruler` | M |
| Aproximar / Afastar | `plus` / `minus` | + / − |
| Centralizar | `locate-fixed` | 0 |
| Minimapa | `map` | |
| Recolher / abrir painel | `panel-left-close` / `panel-left-open` | [ |
| Seed aleatória / Copiar | `dices` / `copy` | |
| Restaurar padrão | `rotate-ccw` | |
| Mais ações | `ellipsis` | |
| Renomear / Excluir / Fechar | `pencil` / `trash-2` / `x` | / Delete / Esc |
| Sanfona | `chevron-down` | |
| Tags / Conexões / Enviar imagem | `tag` / `link` / `image-plus` | |
| Salvo / Erro ao salvar / Salvando | `cloud` / `cloud-off` / `loader-circle` | |
| Aviso | `triangle-alert` | |
| Sliders | Oceano `waves`, Praias `shell`, Desertos `sun`, Florestas `trees`, Montanhas `mountain`, Neve `mountain-snow`, Tamanho `globe`, Rugosidade `spline`, Temperatura `thermometer` | |

## Componentes

Estados obrigatórios: padrão, hover, foco, ativo, desabilitado. Foco em todos: anel âmbar (ver
Anel de foco).

| Componente | Padrão | Hover | Ativo | Desabilitado |
|---|---|---|---|---|
| Botão primário (h 40–44, px 16) | bg `--amber`, texto `--on-amber`, 700 14 | bg `--amber-hover` + `--shadow` | bg `--amber-press`, `translateY(1px)` | bg `--sunken`, texto `--ink-3`, borda tracejada `--line-2` |
| Botão secundário | bg `--field`, borda `--line-2` | bg `--sunken`, borda `--ink-3` | bg `--press` | transparente, borda tracejada |
| Destrutivo | bg `--brick`, texto branco | `#9C2F25` | `#86281F` | igual ao primário desabilitado |
| Botão de ícone (44×44) | transparente, `--ink` | bg `--hover` | bg `--press` | opacidade .4–.55 |
| Ferramenta da toolbar (44×44) | transparente | bg `--hover` + tooltip com atalho | bg `--amber`, ícone `--on-amber`, `inset 0 -2px 0 rgba(0,0,0,.18)` | opacidade .55 |
| Campo de texto (h 40) | bg `--field`, borda `--line-2` | borda `--ink-3` | — | bg `--sunken`, borda tracejada |
| Slider | trilho 6 px `--sunken`, preenchimento `--amber`, thumb 18 px `--paper-solid` borda 2 px `--amber` | halo 6 px `--amber-soft` | thumb 22 px âmbar + balão com valor | tudo em `--ink-3`, opacidade .5 |
| Aba | 700 14 `--ink-2` | `--ink` + sublinhado `--line-2` | `--amber-ink` + sublinhado 2 px `--amber` | opacidade .6 |
| Chip / tag (h 28) | bg `--sunken`, borda `--line` | bg `--press` | bg `--amber-soft`, borda `--amber`, texto `--amber-ink` | borda tracejada |
| Toast | `--paper-solid`, `--shadow-lg`, ação em `--amber-ink` 800 | | | |
| Toast de erro | bg `#B33A2E`, texto branco, ação com bg `rgba(255,255,255,.18)` | | | |
| Tooltip | bg `#2B2420`, texto `#F7F1E3`, 600 12, raio 6, tecla com bg `rgba(247,241,227,.18)` | | | |

### Feedback

**Indicador de salvamento:** "Salvo" (`cloud`, `--ok`) · "Salvando…" (`loader-circle` girando,
`--ink-2`) · "Erro ao salvar" (`cloud-off`, `--brick-ink` sobre `--brick-soft`). Sem botão
"Salvar".

Exemplos de toast do design system (o uso de cada um está nas specs):

| Toast | Ação |
|---|---|
| "Pin excluído" | Desfazer |
| "Não foi possível gerar o mapa" (toast de erro) | Tentar de novo |
| "2 pins ficaram sobre a água" (aviso) | — |

## Layout do Editor

Direção escolhida: **B — Margem encadernada**.

| Elemento | Posição | Tamanho |
|---|---|---|
| Cabeçalho (logo, nome, salvamento) | topo esquerdo, encostado | 320 × 56 |
| Sidebar de geração | esquerda, encostada, altura total abaixo do cabeçalho; fundo `--paper-solid`, sombra `4px 0 24px rgba(43,30,15,.18)` | 320 (recolhida 48) |
| Ações (buscar, desfazer, refazer, exportar, tema, ajuda) | pílula flutuante no topo direito, 12 px da borda | h 56 |
| Drawer do pin / estrada | direita, encostado, altura total, por cima do mapa | 400 |
| Linha inferior | grade `1fr auto 1fr` entre sidebar e drawer, 16 px da base | minimapa à esquerda, toolbar horizontal no centro, zoom à direita, gap 12 |
| Minimapa | recolhível | 160 × 100 |
| Toasts | acima do controle de zoom | |

Quando a área livre fica abaixo de 860 px, o controle de zoom esconde escala e porcentagem.

## Estilo do mapa

Cores chapadas, 3 tons por bioma (sombra, base, luz). Valores em `tokens.json → map`.

| Bioma | Sombra | Base | Luz | Decoração |
|---|---|---|---|---|
| Oceano profundo | `#1F4E79` | `#2B6CA3` | `#3A82BF` | Traço de onda a nanquim |
| Água rasa | `#4A9CC9` | `#6BB8DD` | `#8FD0EB` | — |
| Praia | `#D9C08A` | `#EBD9A6` | `#F5EACB` | Pontilhado de areia |
| Campo | `#6FA544` | `#8CC152` | `#A8D672` | Tufos a nanquim |
| Floresta | `#2E6B3A` | `#3F8A4B` | `#55A55E` | Pinheiros + árvore redonda |
| Deserto | `#D19A4E` | `#E6B866` | `#F2D08A` | Dunas a traço e cactos |
| Colina | `#7E8F55` | `#98A86A` | `#B2C184` | Colinas a traço com hachura |
| Montanha rochosa | `#6B6560` | `#8A837C` | `#A9A39C` | Montanhas com hachura |
| Neve | `#C9D6DE` | `#E4ECF0` | `#FFFFFF` | Montanhas nevadas com hachura |

> Pendente: cores e traço de rios e lagos (a v1 terá os dois; o material não define o estilo).

### Traços

| Elemento | Estilo |
|---|---|
| Costa | 2 px `#163A5C` |
| Estrada | 3,5 px `#7A5230` sobre 7 px `#F5EACB` |
| Trilha | 3,2 px `#7A5230` pontilhada (1 / 7) |
| Rota marítima | 2,5 px `#FFFFFF` tracejada (10 / 8) |
| Estrada selecionada | halo 13 px `#C8892B` 55% |
| Prévia (desenho/rota) | tracejado `#2B2420` ou `#C8892B` |

Fundo do canvas fora do mapa: `#1F4E79`.

### Decoração

**Estilo dos ícones decorativos: Medieval (padrão).** Desenho a nanquim, traço levemente trêmulo,
tinta `#1C1511` 1–1,5 px (montanhas: `#3A2A1C` com hachura na face sombreada). Florestas: grupos
de pinheiros com uma árvore redonda. Montanhas e neve usam o desenho v1; demais biomas o v2.
Implementação no protótipo: `rpg-decor-medieval.js → RPG_MEDIEVAL_V2B`, carregado depois de
`rpg-kit.js`; escala 1,15 no editor. O estilo cartoon antigo segue disponível como
`RPG.drawDecor`.

### Parâmetros do gerador (padrão)

Oceano 45, praias 30, desertos 15, florestas 35, montanhas 30, neve 40, tamanho 50, rugosidade 50,
temperatura 50 (todos 0–100). Desertos + florestas ≤ 100.

**Presets:** Continente temperado · Arquipélago · Deserto árido · Terras geladas. As telas e o
PDF ainda mostram "Reinos áridos" e "Norte gelado": valem os nomes daqui.

> Pendente: os valores de cada preset estão em `rpg-kit.js → PRESETS`, que não veio no material.

## Pins

32 px no mapa (tamanho fixo em qualquer zoom), viewBox 40×48, âncora na base central. Contorno
`#2B2420` 1,5 px, dois tons (base deslocada −2,5 px sobre a sombra), glifo `#FFF8E8`, sombra no
chão elipse `#2B2420` 25%. Cada pin existe em 60, 32 e 24 px, e numa versão sem cor (só contorno):
a forma sozinha identifica o tipo.

| Tipo | Forma | Base | Sombra |
|---|---|---|---|
| Cidade | Gota | `#D9573F` | `#A93A26` |
| Vila | Etiqueta | `#4FB0A3` | `#2F8276` |
| Castelo | Escudo ameado | `#7B8FD0` | `#5466A8` |
| Masmorra | Losango | `#8E6BA8` | `#634580` |
| NPC | Hexágono | `#EE9443` | `#C06A1E` |
| Ponto de interesse | Estrela | `#F2CF4A` | `#C9A21F` |
| Personalizado | Círculo com imagem | `#C8892B` | `#9A6518` |

### Estados

| Estado | Aparência |
|---|---|
| Padrão | 32 px, sombra suave |
| Com rótulo | zoom ≥ 1,5× → nome abaixo (`.map-label`) |
| Hover | `scale(1.1)` + nome |
| Selecionado | anel elíptico 40×16 `#C8892B` 2,5 px com fundo 30% + pulsação; drawer aberto |
| Arrastando | opacidade .6, sobe 14 px, `drop-shadow(0 12px 8px rgba(43,36,32,.4))`, marca tracejada no chão |
| Agrupado | zoom < 0,8 e pins a < 34 px: círculo 38 px `#F7F1E3`, borda 2 px `#2B2420`, halo âmbar, contador 800 15 |

No protótipo, o SVG é gerado por `RPG.pinSVG(type, size, { img, mono })`.

## Referência visual

Telas em `../assets/design/` (tema claro e escuro de cada uma): `editor-*.png`,
`editor-drawer-*.png`, `editor-gerando-*.png`, `lista-*.png`, `lista-vazia-*.png`,
`erro-importar-*.png`, `assistente-*.png`. As specs citam cada uma em Referência.
