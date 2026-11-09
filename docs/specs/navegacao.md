---
feature: F2
area: area:mapa
updated: 2026-11-09
---

# F2 · Câmera e navegação

Descreve como a feature funciona **hoje**. Planos e mudanças ficam nas issues; o PR que muda
o comportamento atualiza esta spec.

> Nada implementado ainda: o conteúdo abaixo vem do material de design e do PRD.

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
  alternar tema, ajuda.
- Barra de ferramentas inferior central: navegar (ativa por padrão), adicionar pin, desenhar
  estrada, rota automática, camadas, medir distância. Ícones e atalhos em
  [design-system.md](../design/design-system.md#ícones-de-interface).
- Minimapa recolhível no canto inferior esquerdo da área do mapa (160 × 100), com retângulo da área
  visível arrastável.
- Canto inferior direito: escala (ex.: 17 km), zoom (ex.: 92%) com − e +, centralizar.
- Quando a área livre fica abaixo de 860 px, o controle de zoom esconde escala e porcentagem.
- Com o drawer aberto, a barra superior e os controles de zoom se alinham à borda esquerda do
  drawer.

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
| Recolher o minimapa | Esconde o minimapa |
| Camadas | Abre um popover com interruptores de liga/desliga para cada camada do mapa |
| Ajuda | Abre o modal "Atalhos de teclado" |
| Medir distância (M) (Should) | Mede a distância entre dois pontos |

## Regras

- Limites de zoom (0,4× a 4×) e de pan (o mapa não some da tela).
- Barra de escala em km, calculada a partir da largura do mundo (`sizeKm`, 800 km por padrão).
- Rótulos dos pins aparecem a partir do zoom 1,5×, ou em hover/seleção.
- `prefers-reduced-motion: reduce` → sem deslizamento de câmera (saltos diretos).

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
- AC-F2-09: o canto inferior direito mostra a escala em km, a porcentagem de zoom, − e +, e centralizar; com menos de 860 px de área livre, esconde a escala e a porcentagem
- AC-F2-10: a barra superior e a toolbar seguem o design system, e as ações de funções que ainda não existem aparecem desabilitadas
- AC-F2-11: Camadas abre o popover, e o interruptor "Decoração" mostra e esconde os ícones decorativos
- AC-F2-12: Ajuda abre o modal "Atalhos de teclado"
- AC-F2-13: Medir distância (M) mostra a distância em km entre dois pontos clicados

## Pendências

Layout abaixo de 768 px (RNF-7: sidebar e drawer viram painéis sobrepostos): sem mockup: segue o [design system](../design/design-system.md), e os prints são revistos no PR.
