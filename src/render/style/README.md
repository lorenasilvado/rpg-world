# render/style

Estilo visual do mapa, isolado do resto do renderer para a arte poder ser trocada sem mexer no
código de desenho.

| Arquivo | O que guarda |
|---|---|
| `palette.ts` | 3 tons por bioma (sombra, base, luz), traço da costa e fundo do canvas, copiados de `docs/design/tokens.json → map` |
| `decor.png` | Spritesheet inicial dos ícones decorativos: 4 quadros de 128 px (pinheiro, árvore redonda, cacto, rocha) |
| `decor.ts` | Quadros do spritesheet e quais ícones cada bioma usa |
| `LICENSE-kenney-map-pack.txt` | Licença original do pacote dos ícones |

## Origem dos ícones

| Quadro | Origem | Licença |
|---|---|---|
| `pine`, `roundTree`, `cactus`, `rock` | [Kenney "Map Pack"](https://kenney.nl/assets/map-pack) (Kenney Vleugels, 2016), recortados de `Tilesheet/mapPack_tilesheet_2X.png` | [CC0 1.0](http://creativecommons.org/publicdomain/zero/1.0/) |

O CC0 não exige crédito; o crédito fica aqui por cortesia.
