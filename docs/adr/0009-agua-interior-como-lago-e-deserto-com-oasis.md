# 0009. A água interior é lago, e o deserto só tem água no oásis

- Status: Proposta
- Data: 2026-11-16
- Questão: o que é oceano e o que é lago, e que água pode ficar dentro do deserto? (#94, `docs/specs/geracao-terreno.md`)
- Substitui em parte: [ADR 0008](0008-nascentes-na-terra-alta-e-depressoes-pequenas.md) (a água abaixo do nível do mar e o deserto)

## Contexto

Na aprovação dos rios (PR #89, #46), a usuária pediu que cada bioma tivesse só os elementos que
combinam com ele: o deserto sem rios nem lagos, só oásis, e a água no interior do continente sem
areia em volta. Até a versão 7 do gerador:

- **Toda a água abaixo do nível do mar era oceano**, inclusive a presa no meio do continente, e
  ganhava praia (#69). O ADR 0008 decidiu também que o lago dos rios abaixo do nível do mar é
  oceano.
- **O deserto era escolhido só pela aridez**, então rios e lagos podiam atravessá-lo.

## Decisão

- **Oceano é a água ligada à borda.** Só a água abaixo do nível do mar com ligação com a borda do
  mapa (pelas 8 vizinhas) é oceano. A que fica presa no continente é lago; um grupo dela menor que o
  lago mínimo do ADR 0008 volta a ser terra, como as depressões pequenas.
- **O alvo do Oceano conta só o oceano ligado.** Cada célula tem o seu nível de transbordo: o maior
  valor de elevação no caminho mais baixo dela até a borda (priority-flood). O oceano, com o nível
  do mar `L`, são as células com transbordo abaixo de `L`, e `L` é o quantil do transbordo na
  fração pedida: o oceano fica no alvo sem iteração. Uma bacia cheia tem o mesmo transbordo em
  todas as células; no empate com `L`, ela entra inteira ou fica inteira de fora, o que ficar mais
  perto do alvo. O transbordo só depende da elevação: é calculado com o traçado dos rios e fica no
  cache do worker, guardado só nas células em que passa da elevação (as depressões).
- **Margem de lago não é praia.** A praia é a terra perto do oceano, mais perto dele que de um lago
  e sem encostar num lago (também na diagonal).
- **O deserto recua da água doce.** A terra a até uma margem fixa (fração da largura do mapa, pelo
  menos as vizinhas) de um rio ou de um lago nunca é deserto e fica para a floresta ou o campo. O
  deserto pedido sai do resto da base, então o percentual de Desertos continua valendo até esse
  resto acabar.
- **Oásis.** A única água dentro do deserto é o oásis: um lago redondo pequeno, com um anel de campo
  e 2 ou 3 palmeiras (ícone novo da decoração). Os centros são sorteados pela seed em coordenadas
  de 0 a 1, só onde um disco inteiro em volta é deserto, afastados entre si, um para cada fração
  fixa do mapa em deserto. Os raios são frações da largura do mapa, então a prévia e o mapa final
  sorteiam e desenham os mesmos oásis. O oásis vem depois do deserto na ordem de classificação.
- **Determinismo:** só operações exatas, como no resto do núcleo. O gerador sobe para a versão 8.

O resto do ADR 0008 (nascentes na terra alta fixa, depressões pequenas, tamanho dos lagos dos rios,
sliders que não mudam o traçado) continua valendo.

## Alternativas consideradas

- **Subir o nível do mar por passos até o oceano ligado chegar ao alvo** — medido na #94: subir o
  nível liga à borda bacias inteiras de uma vez, e uma seed passou de 45% para 47% (fora dos ± 2%
  do AC-F1-02).
- **Contar a água interior no alvo do Oceano** — o oceano real ficaria abaixo do pedido em até 2,7%
  do mapa (medido com o Oceano em 45).
- **Tirar do deserto só as células de rio e de lago** — o rio ficaria encostado na areia, que é o que
  a usuária pediu para não ter.
- **Deixar o deserto em volta da água e trocar só a cor da margem** — não muda o bioma, e a barra
  "Distribuição do mapa" contaria deserto onde se vê vegetação.
- **Guardar o transbordo inteiro no cache** — 4 bytes por célula passaram o teto de 64 MB do mundo
  (AC-F1-09); só as depressões cabem.

## Consequências

- O mapa tem mais lagos: com os sliders no padrão, de 1,5% a 4% do mapa, contra cerca de 1,4% antes.
- Com Desertos perto de 100, o deserto fica abaixo do pedido: a terra junto dos rios e dos lagos não
  pode ser deserto.
- O oásis depende do slider Desertos (e dos que mudam o deserto): ele é o único lago que muda sem
  mexer na elevação. Os lagos dos rios e a água interior continuam só dependendo da elevação e do
  Oceano.
- Quantos oásis e de que tamanho é decidido por print no PR (pendência da spec); as constantes do
  oásis, a margem do deserto e a regra da água interior fazem parte do gerador: mudar exige subir
  `GENERATOR_VERSION`.
- Ao aceitar este ADR, o 0008 continua `Aceita` no que não foi substituído, com a nota de que a água
  abaixo do nível do mar segue este ADR.
