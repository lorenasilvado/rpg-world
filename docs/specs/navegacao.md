---
feature: F2
area: area:mapa
updated: 2026-11-25
---

# F2 · Câmera e navegação

Descreve como a feature funciona **hoje**. Planos e mudanças ficam nas issues; o PR que muda
o comportamento atualiza esta spec.

> Implementado: a câmera (pan, inércia, zoom no cursor, pinça, teclado, limites e movimento
> reduzido), a camada de decoração, com culling e nível de detalhe, o minimapa, o controle de zoom
> (escala, porcentagem, −, + e centralizar), a barra de ações e a toolbar inferior (com as funções
> que ainda não existem desabilitadas), Camadas (interruptores "Decoração" e um por tipo de pin), Ajuda (modal "Atalhos
> de teclado") e Medir distância.

## Resumo

O mapa ocupa a tela inteira atrás dos painéis e é navegado com pan e zoom fluidos (60 fps num
notebook com GPU integrada, RNF-1), com minimapa, barra de escala e as ferramentas do editor na
barra inferior.

## Rotas/Telas

| Rota ou tela | O que mostra | Referência |
|---|---|---|
| E1 · Editor | Mapa em tela cheia, barra de ações, toolbar inferior, minimapa, escala e zoom | `../assets/design/editor-claro.png`, `../assets/design/editor-escuro.png` |

### Elementos do editor

- Barra flutuante no topo direito (pílula, h 56): Buscar (Ctrl K), desfazer, refazer, exportar,
  alternar tema, ajuda. Buscar abre a busca dos pins (ver [pins.md](pins.md)). Exportar abre o
  menu com "Arquivo do mundo (.json)" e "Imagem (.png)" (desabilitado até a função existir; ver
  [mundos.md](mundos.md)); desfazer e refazer ficam desabilitados enquanto não há o que desfazer ou refazer
  (ver [mundos.md](mundos.md)). Buscar aparece como um campo com "Buscar" e a tecla "Ctrl K" a
  partir de 768 px de tela e com a área livre de pelo menos 420 px; senão, só com o ícone. Abaixo de
  768 px, os botões de abrir o painel e os detalhes vêm antes, e os botões ficam sem folga entre si
  (a barra tem 360 px e cabe numa tela de 390).
- Barra de ferramentas inferior (h 56, 309 px): navegar, adicionar pin, desenhar estrada, rota
  automática, um separador, camadas, medir distância. A ferramenta em uso (navegar, ao abrir,
  adicionar pin ou medir distância) fica ativa, em âmbar. Desenhar estrada e rota automática aparecem
  desabilitadas (opacidade .55), até as funções existirem. Hover com o mouse numa ferramenta (mesmo desabilitada) ou o foco do teclado numa
  ferramenta habilitada (as desabilitadas não recebem foco) mostra o tooltip com o nome e o atalho.
  Ícones e atalhos em
  [design-system.md](../design/design-system.md#ícones-de-interface).
- A toolbar se ajusta à largura da linha inferior (a área livre, menos o drawer quando ele está
  aberto). Vale a largura final: ao abrir ou fechar o drawer ou recolher a sidebar, a toolbar, o
  minimapa e os toasts vão para o lugar novo logo no começo do deslize, não no meio dele. Com pelo menos 829 px (ex.: 1280 com a sidebar e sem pin: 960 px; 1440 com a sidebar e
  sem pin: 1120 px; 1280 com a sidebar recolhida e o drawer: 832 px), a
  toolbar fica deitada no centro da linha inferior (entre o minimapa e o zoom completo, sem chegar a
  eles). De 341 a 828 px (ex.: 1440 com a sidebar e o drawer: 720 px; 1280 com a sidebar e o
  drawer: 560 px; celular 390), ela fica deitada e centrada numa segunda linha, 12 px acima do mais alto entre o
  minimapa (aberto ou recolhido) e o zoom, e sobe e desce junto quando o minimapa abre e recolhe. Em
  ambos, o tooltip e o popover de Camadas abrem acima dela. Abaixo de 341 px (tablet com a sidebar
  aberta: 304 px), ela fica em pé, 12 px acima do controle de zoom e alinhada à direita dele; o
  tooltip abre à esquerda, e o popover, acima, alinhado à direita.
- Camadas abre um popover (248 px) com o título "Camadas" e um interruptor por camada do mapa:
  "Decoração" (ícone `trees`) e, abaixo dela, depois de um traço, um por tipo de pin (Cidade, Vila,
  Castelo, Masmorra, NPC, Ponto de interesse e Personalizado, com o ícone do tipo; ver
  [pins.md](pins.md)). O popover fica entre a barra superior e a toolbar, com a toolbar em qualquer
  lugar; sem espaço para todas as linhas (celular, tablet com a toolbar em pé, tela baixa), ele rola. O popover fecha por Camadas de novo, Esc (o foco volta a Camadas)
  ou um clique fora dele (inclusive no mapa).
- Ajuda (ou a tecla ?) abre o modal "Atalhos de teclado", com os atalhos que já funcionam: navegar (V), adicionar
  pin (P), medir distância (M), mover o mapa (setas / WASD), zoom (+ / −), centralizar mapa (0), excluir pin (Delete / Backspace), buscar pins (Ctrl K), desfazer (Ctrl Z), refazer (Ctrl Shift Z), recolher painel ([), cancelar / fechar
  (Esc) e atalhos (?). Duas colunas a partir de 640 px. Fecha pelo X, Esc ou clique fora, e o foco
  volta para onde estava ao abrir.
- Medir distância (ou a tecla M): com a ferramenta ativa, o cursor sobre o mapa é a cruz, e uma dica
  (pílula escura, 84 px do topo, centrada na área livre) diz "Clique em dois pontos para medir" e,
  depois do primeiro ponto, "Clique no ponto final". O primeiro clique marca um ponto (círculo claro
  com borda escura); até o segundo, uma linha tracejada clara vai dele até o mouse, com a distância
  em km numa pílula escura acima do meio da linha (com o mouse sobre um controle, como a toolbar ou
  o minimapa, a linha fica no último ponto do mapa). O segundo clique fixa a outra ponta e a
  distância. Com as duas pontas, a região de status da dica anuncia ao leitor de tela a distância
  ("Distância: 400 km").
- Minimapa recolhível no canto inferior esquerdo da área do mapa (160 × 100), com retângulo da área
  visível arrastável. O cabeçalho "Minimapa" (ícone `map` e seta) recolhe e abre; recolhido, fica
  só o cabeçalho. Abre aberto. O cabeçalho tem 32 px de altura com mouse e 44 px em telas de toque
  (a área de toque mínima).
- Canto inferior direito: escala (ex.: 17 km), zoom (ex.: 92%) com − e +, centralizar.
- Minimapa e controle de zoom ficam na linha inferior, entre a sidebar e a borda direita (ou a
  borda esquerda do drawer, quando ele está aberto), 16 px da base (o minimapa a 16 px da sidebar,
  o zoom a 12 px da borda direita ou do drawer). Os toasts ficam logo acima do
  controle de zoom, no canto direito. Com a toolbar na segunda linha, o toast fica 12 px acima
  dela; com a toolbar em pé, à esquerda dela (12 px). Se a área livre tem menos de 566 px (à
  esquerda da toolbar em pé, quando ela está ali), onde o toast cobriria o minimapa, o toast ocupa a
  largura da área livre (até a toolbar em pé) e fica acima da toolbar na segunda linha, ou do
  minimapa aberto (ou do zoom, com o minimapa recolhido), inclusive quando o minimapa está
  empilhado.
- Sem pin selecionado, o drawer fica fora da tela, e a barra superior e os controles de zoom ficam a
  12 px da borda direita. Com o drawer aberto (um pin selecionado), eles se alinham à borda esquerda
  dele, deslizando junto com ele (200 ms), e voltam ao fechá-lo (ver [pins.md](pins.md)).

## Estados

| Estado | Quando acontece | O que o usuário vê |
|---|---|---|
| Carregando | Abrir um mundo (o mapa final 1024² leva até 1,5 s) | Os painéis aparecem na hora; o mapa mostra a prévia 256² borrada e "Distribuição do mapa" mostra "Gerando", como no E3 (ver [geracao-terreno.md](geracao-terreno.md)) |
| Vazio | — | n/a: o editor sempre abre com um mapa |
| Erro | TODO: não descrito no material | |

## Ações

| Ação | Resultado |
|---|---|
| Arrastar o mapa (mouse e toque) | Pan, com inércia suave ao soltar |
| Setas / WASD | Pan |
| Roda do mouse | Zoom centrado no cursor |
| Pinça no touchpad | Zoom |
| Botões + / − (atalhos + / −) | Zoom |
| Centralizar (atalho 0) | Centraliza o mapa |
| Arrastar o retângulo do minimapa | Move a área visível |
| Tocar no minimapa fora do retângulo | Centra a área visível no ponto tocado (e o arrasto continua dali) |
| Setas com o foco no minimapa | Movem a área visível 1/10 do mapa (10 px do minimapa), na hora |
| Recolher o minimapa | Esconde o minimapa |
| Camadas | Abre um popover com interruptores de liga/desliga para cada camada do mapa ("Decoração" e os 7 tipos de pin) |
| Interruptor "Decoração" | Mostra ou esconde os ícones decorativos |
| Interruptor de um tipo de pin (Cidade, Vila…) | Mostra ou esconde os pins daquele tipo (ver [pins.md](pins.md)) |
| Ajuda (atalho ?) | Abre o modal "Atalhos de teclado" |
| Buscar (Ctrl K) | Abre a busca dos pins por nome e tag (ver [pins.md](pins.md)) |
| Exportar | Abre o menu de exportar: "Arquivo do mundo (.json)" baixa o mundo (ver [mundos.md](mundos.md)); "Imagem (.png)" fica desabilitado |
| Desenhar estrada, rota automática | Desabilitados: as funções ainda não existem |
| Desfazer, refazer (Ctrl+Z, Ctrl+Shift+Z) | Desfazem e refazem as mudanças nos pins e nos parâmetros de geração (ver [mundos.md](mundos.md)) |
| Adicionar pin (atalho P) | Liga a ferramenta de criar pin (ver [pins.md](pins.md)) |
| Medir distância (atalho M) | Liga a ferramenta de medir |
| Dois cliques no mapa, com Medir distância | Marcam as pontas e mostram a distância em km entre elas; um terceiro clique começa outra medida |
| Navegar (atalho V) | Volta para a navegação (sem medida) |
| Esc, com Medir distância | Apaga a medida; sem medida, volta para Navegar |

## Regras

- O zoom é relativo à área livre (a tela menos a sidebar fixa, a partir de 768 px; abaixo disso, a
  tela toda): 1× é o mapa inteiro, centrado na área livre. O drawer não entra na área livre: abrir
  ou fechar o drawer não muda a porcentagem nem mexe na câmera por si. Ao abrir, a câmera já desliza
  até o pin, no centro do que sobra entre a sidebar e o drawer (ver [pins.md](pins.md)); ao fechar,
  ela fica onde está, a não ser que o mapa tenha ido para baixo de onde o drawer estava: aí ele
  volta deslizando (350 ms) para os limites sem o drawer. O editor abre em 1×, e
  centralizar (0) volta para 1×. Um mapa novo (slider ou seed) não mexe na câmera.
- Limites de zoom (0,4× a 4×) e de pan: o mapa não some da tela. Em cada eixo, se o mapa é maior
  que a área livre, ele a cobre toda: o pan para quando a borda do mapa chega à borda da área, sem
  mostrar o fundo além dela. Se é menor, o mapa fica inteiro dentro da área livre. Ao bater no
  limite, a inércia para naquele eixo (no outro, continua), sem jogar o mapa de volta. Com o drawer
  aberto, na largura vale também o limite da área à esquerda dele: o mapa pode ir para a esquerda
  até a borda direita dele chegar à do drawer (o que estava embaixo do drawer vem à vista).
- Arrastar (mouse ou um dedo) faz pan e, ao soltar, a câmera continua com inércia e desacelera.
  A roda faz zoom mantendo parado o ponto sob o cursor; a pinça (dois dedos, ou a pinça do touchpad,
  que chega como roda com Ctrl) faz zoom.
- Teclado: setas e WASD (pela posição da tecla, em qualquer layout) movem a câmera 20% do menor lado
  da área livre por toque; + (ou =) e − aproximam e afastam 1,25× no centro da área livre; 0
  centraliza. Os atalhos deslizam em 350 ms (`cubic-bezier(.4,0,.2,1)`), e toques seguidos somam a
  partir do destino. Não valem com Ctrl, Alt ou Meta (o zoom do navegador), com o foco num campo
  ou dentro de um modal (o assistente de novo mundo) nem com um painel sobreposto aberto no celular. Campo é o elemento com o foco (ou um ancestral
  dele) que seja input, textarea, select ou conteúdo editável, ou cujo `role` mais próximo seja
  textbox, searchbox, combobox, listbox, option, slider, spinbutton, menu, menuitem, radiogroup,
  tablist ou tab: controles que usam as setas ou digitam.
- Com o foco no minimapa (ele entra na ordem do Tab), as setas são dele: movem a área visível 1/10
  do mapa, sem deslizar, e o pan das setas da câmera não soma outro passo. WASD continua com a
  câmera.
- A borda do mapa não mostra corte reto quando o fundo aparece (mapa inteiro ou afastado): o
  oceano escurece até a cor do fundo perto dela (ver o desenho do terreno em
  [geracao-terreno.md](geracao-terreno.md)).
- Ao redimensionar a janela, o ponto no centro da área livre e o zoom relativo se mantêm.
- Decoração: todos os ícones do campo (onda, areia, tufo, árvore, duna, cacto, colina, montanha e
  montanha nevada) são desenhados por cima do terreno, com o pé no ponto do núcleo, no estilo
  Medieval do design system (desenho em [geracao-terreno.md](geracao-terreno.md)). Só são desenhados os ícones perto
  da área livre (culling, com uma folga de 25% de cada lado). Abaixo de 0,8× de zoom, aparece metade
  dos ícones, e abaixo de 0,55×, um quarto; o nível de detalhe nunca tira montanhas e montanhas
  nevadas (o culling, sim, quando estão longe da área livre). Afastar só tira ícones, e aproximar
  devolve os mesmos. A camada liga e desliga pelo interruptor "Decoração" de Camadas
  (o estado fica no `uiStore`, ligada ao abrir). Se o spritesheet dos ícones não pode ser desenhado (sem o canvas
  2D), o mapa aparece só com o terreno, sem decoração.
- Barra de escala em km, calculada a partir da largura do mundo (`sizeKm`). Hoje ela é sempre
  800 km: o assistente não pergunta o tamanho, e o mundo salvo guarda o dele (`sizeKm`). A
  barra tem 32 px, e o texto é quantos km cabem nela no zoom atual (inteiro a partir de 10 km;
  abaixo, uma casa decimal, com vírgula). A porcentagem é o zoom relativo (100% = mapa inteiro na
  área livre). Os botões −, + e centralizar fazem o mesmo que as teclas −, + e 0, deslizando.
- Com a área livre abaixo de 450 px, onde o controle de zoom completo não cabe ao lado do minimapa
  (ex.: tablet 1024 com a sidebar aberta: 304 px; celular 390), ele fica só com −, + e centralizar.
  Nos tamanhos comuns de desktop (1280 e 1440 px, com a sidebar aberta ou recolhida, com ou sem o
  drawer), a escala e a porcentagem aparecem.
- Os botões −, + e centralizar têm 44 × 44 px em telas de toque (celular e tablet) e 40 × 44 px
  com mouse.
- Minimapa: o mapa (quadrado) aparece inteiro e centrado nos 160 × 100, com o fundo do oceano dos
  lados, e é redesenhado a cada mapa novo (a prévia e o final). O retângulo da área visível é
  cortado na borda do mapa (afastado, ele cobre o mapa todo) e acompanha a câmera a cada quadro.
  Arrastar o retângulo move a área visível na hora, sem deslizar, mantendo o ponto pego sob o
  ponteiro, dentro dos limites de pan.
- Se a área livre tem menos de 360 px (estreita demais para o minimapa e o controle de zoom lado a
  lado: tablet com a sidebar aberta, celular estreito), o minimapa sobe para 12 px acima do
  controle de zoom, sem sobreposição. Com a área de novo larga (ex.: sidebar recolhida), ele volta
  para o lado, deslizando; ao abrir o editor numa área estreita, ele já aparece no lugar.
- A tecla ? abre a Ajuda, com as mesmas exceções dos atalhos da câmera (Ctrl, Alt ou Meta, foco
  num campo, dentro de um modal, painel sobreposto aberto no celular).
- Medir distância: a distância é a reta entre os dois pontos, em km, pela largura do mundo
  (`sizeKm`), com o mesmo arredondamento da barra de escala (inteiro a partir de 10 km; abaixo, uma
  casa decimal, com vírgula): 32 px na tela medem o mesmo que a barra. Um clique é apertar e soltar
  sem andar mais de 5 px; arrastar continua fazendo pan (e a pinça, zoom), sem marcar ponto. Um
  clique fora do mapa (no fundo) marca a borda mais próxima. A medida fica presa ao mapa: acompanha
  o pan e o zoom. As teclas M e V (Navegar) têm as mesmas exceções dos atalhos da câmera (Ctrl, Alt ou Meta, foco
  num campo, dentro de um modal, painel sobreposto aberto no celular), e o Esc também não vale com
  o foco num campo ou dentro de um modal. Com o popover de Camadas aberto, o Esc fecha só o popover. Voltar para Navegar apaga a medida.
  Um mapa novo (seed, preset, slider ou um mundo novo pelo assistente) não apaga a medida: os pontos
  ficam no mesmo lugar, e a distância segue a largura do mundo (um mundo de outro tamanho muda os
  km).
- Rótulos dos pins aparecem a partir do zoom 1,5×, ou em hover/seleção.
- `prefers-reduced-motion: reduce` → sem deslizamento de câmera (saltos diretos) e sem inércia ao
  soltar o arrasto. Vale também se a preferência muda com o editor aberto.

## Critérios de aceite vigentes

IDs `AC-F2-NN`, em sequência. AC novo recebe o próximo número livre; AC removido sai da
lista e o número não volta a ser usado.

- AC-F2-01: arrastar o mapa, com mouse ou toque, faz pan, com inércia suave ao soltar
- AC-F2-02: a roda do mouse faz zoom centrado no cursor
- AC-F2-03: a pinça faz zoom
- AC-F2-04: setas e WASD fazem pan, + e − fazem zoom e 0 centraliza o mapa
- AC-F2-05: o zoom fica entre 0,4× e 4×, e o mapa não some da tela
- AC-F2-06: com `prefers-reduced-motion: reduce`, a câmera salta direto, sem deslizar
- AC-F2-07: com 5.000 ícones decorativos, pan e zoom ficam em 60 fps de média e pelo menos 55 fps de mínimo
- AC-F2-08: o minimapa acompanha o mapa, o retângulo da área visível é arrastável e o minimapa recolhe
- AC-F2-09: o canto inferior direito mostra a escala em km, a porcentagem de zoom, − e +, e centralizar; com menos de 450 px de área livre, esconde a escala e a porcentagem
- AC-F2-10: a barra superior e a toolbar seguem o design system, e as ações de funções que ainda não existem aparecem desabilitadas
- AC-F2-11: Camadas abre o popover, e o interruptor "Decoração" mostra e esconde os ícones decorativos
- AC-F2-12: Ajuda abre o modal "Atalhos de teclado"
- AC-F2-13: Medir distância (M) mostra a distância em km entre dois pontos clicados
- AC-F2-14: em tela baixa (altura menor que 500 px, como o celular deitado), a sidebar e o drawer são painéis sobrepostos, como abaixo de 768 px, mesmo com 768 px ou mais de largura, e todas as seções da sidebar (com os sliders) são alcançáveis
- AC-F2-15: em tela baixa, a toolbar fica deitada na própria linha inferior, nunca numa segunda linha nem em pé, e não cobre o meio do mapa; o minimapa começa recolhido (sem mudar a preferência de aberto ou recolhido das telas altas) e, se a linha não comporta o minimapa, a toolbar e o zoom (ex.: 667×375), fica no canto superior esquerdo; um toque num pin no centro do mapa o seleciona

## Pendências

Layout abaixo de 768 px (RNF-7: sidebar e drawer viram painéis sobrepostos): sem mockup: segue o [design system](../design/design-system.md), e os prints são revistos no PR.
