---
feature: F2
area: <a definir>
updated: 2026-11-04
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
| Carregando | TODO: não descrito no material | |
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
| Medir distância (M) (desejável) | Mede a distância entre dois pontos |

## Regras

- Limites de zoom (ex.: 0,25× a 8×) e de pan (o mapa não some da tela).
- Barra de escala em km, calculada a partir da largura do mundo (`sizeKm`).
- Rótulos dos pins aparecem a partir do zoom 1,5×, ou em hover/seleção.
- `prefers-reduced-motion: reduce` → sem deslizamento de câmera (saltos diretos).

## Critérios de aceite vigentes

IDs `AC-F2-NN`, em sequência. AC novo recebe o próximo número livre; AC removido sai da
lista e o número não volta a ser usado.

Nenhum ainda: os ACs nascem no `/planejar M<n>`.

## Pendências

> Pendente: o que fazem "Camadas" e "Ajuda"? O material lista os botões, mas não descreve o
> comportamento.

> Pendente: layout do editor abaixo de 768 px (RNF-7: sidebar e drawer viram painéis
> sobrepostos), sem tela no material.

> Pendente: limites exatos de zoom (o PRD dá 0,25× a 8× como exemplo).
