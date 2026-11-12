# render/style

Estilo visual do mapa, isolado do resto do renderer para a arte poder ser trocada sem mexer no
código de desenho.

| Arquivo | O que guarda |
|---|---|
| `palette.ts` | 3 tons por bioma (sombra, base, luz), traço da costa e fundo do canvas, copiados de `docs/design/tokens.json → map`; cores e larguras do rio (`RIVER_STYLE`), do `design-system.md → Traços` |
| `decor.png` | Spritesheet inicial dos ícones decorativos: 4 quadros de 128 px (montanha, montanha nevada, pinheiro, cacto) |
| `decor.ts` | Quadros do spritesheet, tamanho de cada ícone no mapa e quais ícones cada bioma usa |
| `LICENSE-kenney-cartography-pack.txt` | Licença original do pacote dos ícones |

## Origem dos ícones

| Quadro | Origem | Licença |
|---|---|---|
| `mountain`, `snowMountain` | `rocksMountain.png` | CC0 1.0 |
| `pine` | `treePineLarge.png` | CC0 1.0 |
| `cactus` | `cactus.png` | CC0 1.0 |

Todos vêm do [Kenney "Cartography Pack"](https://kenney.nl/assets/cartography-pack) (Kenney,
2020), recortados de `Spritesheet/spritesheet_retina.png`. Licença:
[CC0 1.0](http://creativecommons.org/publicdomain/zero/1.0/). O CC0 não exige crédito; o crédito
fica aqui por cortesia.

Alterações feitas no recorte: o traço foi recolorido com a tinta do design system (`#3A2A1C` nas
montanhas, `#1C1511` nos demais) e o miolo foi preenchido com o tom de luz do bioma (montanha
`#A9A39C`, montanha nevada `#FFFFFF`, pinheiro `#55A55E`). O cacto fica só no traço.
