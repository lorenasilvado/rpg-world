# 0007. O campo gelado é um bioma próprio, separado da neve de montanha

- Status: Aceita
- Data: 2026-11-11
- Questão: como o campo gerado distingue a neve de montanha do campo gelado? (#68, `docs/specs/geracao-terreno.md`)

## Contexto

Desde a #42, o bioma `snow` tinha dois sentidos: os picos nevados (escolhidos pelo slider Neve entre
as montanhas mais frias) e o campo abaixo da temperatura de geada (escolhido pela Temperatura
global). Quem lê o `CoreField` só separava um do outro recalculando os limiares de elevação
(`elevationLevels`). Com Neve em 0 ainda aparecia neve no mapa, e os próximos consumidores precisam
da distinção: os rios nascem nas montanhas (#43), a decoração depende do bioma (#44) e a barra
"Distribuição do mapa" conta cada bioma (AC-F1-18).

## Decisão

O campo gelado ganha um bioma próprio, `frozenField` (índice 9, depois de `snow`), em
`BIOME` (`src/core/types.ts`), em `BIOMES` (`src/render/style/palette.ts`) e em
`docs/design/tokens.json` → `map.biome`. `snow` passa a ser só a neve de montanha.

Por ora `frozenField` usa os mesmos três tons de `snow`: o mapa fica com a mesma cor, e só o modelo
muda. Tons próprios, se vierem, são uma mudança visual (`type:design`) à parte. O campo gelado não
tem decoração.

O gerador sobe de versão (`GENERATOR_VERSION` 5), e os hashes de `golden.ts` são refeitos.

## Alternativas consideradas

- Bioma novo com tons próprios já agora — muda a cor do mapa e pede prints e escolha de paleta,
  fora do escopo da #68.
- Manter `snow` nos dois casos e adicionar ao `CoreField` uma máscara de montanha — cada consumidor
  passaria a ler dois campos para saber o que é uma célula, e o bioma deixaria de ser a resposta
  completa.

## Consequências

- Quem lê o campo sabe se a célula é pico nevado ou campo gelado só pelo bioma.
- O slider Neve só muda `snow`; o campo gelado depende só da Temperatura global (e da geada).
- Todo `Record<Biome, …>` (paleta, decoração) precisa da entrada `frozenField`; o teste da paleta
  confere que tokens, paleta e núcleo têm os mesmos biomas na mesma ordem.
- Mundos com hash da versão 4 não batem mais: a geração é a mesma, mas o valor do bioma muda.
