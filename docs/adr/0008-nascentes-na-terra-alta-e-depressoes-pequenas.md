# 0008. Rios nascem na terra alta fixa, e depressões pequenas não viram lago

- Status: Aceita
- Data: 2026-11-11
- Questão: de onde os rios nascem e o que acontece numa depressão pequena, sem quebrar a regra dos sliders do ADR 0006? (#43, `docs/specs/geracao-terreno.md`)
- Substitui: [ADR 0006](0006-rios-com-sliders-de-forma.md)

## Contexto

O ADR 0006 decidiu que os rios nascem em células de montanha e descem pelo gradiente até o mar ou
um lago, e que a depressão onde a descida fica presa vira lago. Decidiu também que os sete sliders
de limiar não mudam o traçado dos rios.

Ao implementar (#43), dois pontos do 0006 entraram em conflito com o resto dele ou com o resultado:

- **Montanha é um limiar.** O bioma montanha vem do slider Montanhas (percentil da elevação). Se a
  nascente tem de estar numa célula de montanha, mexer em Montanhas muda as nascentes e, com elas,
  os rios, o que o próprio 0006 proíbe.
- **O ruído tem muitas covas pequenas.** Com toda depressão virando lago, quase todo rio parava
  num laguinho a 3–10 células da nascente (na prévia 256²): rios curtos demais e lagos demais.

Este ADR repete a decisão do 0006 e ajusta só esses dois pontos.

## Decisão

- **Rios:** nascem na terra alta, escolhidos pelo RNG da seed, e descem pelo gradiente da
  elevação até o mar ou um lago. Não há slider de rios.
- **Terra alta:** uma faixa fixa, os 6% mais altos do mapa, e não o bioma montanha. Com os sliders
  no padrão, essa faixa coincide com a zona das montanhas. As nascentes são sorteadas em
  coordenadas de 0 a 1, para a prévia e o mapa final sortearem os mesmos pontos.
- **Lagos:** se a descida fica presa numa depressão grande, a depressão vira lago e o rio termina
  nele. Uma depressão pequena (abaixo de um tamanho mínimo, em fração do mapa) não vira lago: o rio
  a enche e segue pelo transbordo. O rio nunca sobe acima da nascente: se o transbordo fica acima
  dela, essa nascente é descartada.
- **Modelo:** lago é um bioma no `WorldField`, e não conta como oceano. Rio é uma polilinha nas
  coordenadas do mapa, devolvida pelo worker e desenhada na textura do terreno.
- **Sliders:** os sete sliders de limiar não mudam a elevação, então não mudam o traçado dos rios;
  mexer no oceano só corta o rio na costa nova. Tamanho do continente e Rugosidade da costa mudam a
  elevação, e o traçado dos rios é refeito com a elevação nova.
- **Determinismo:** só operações exatas, como no resto do núcleo.

## Alternativas consideradas

- **Nascente no bioma montanha, como no 0006** — o slider Montanhas mudaria os rios, contra a
  regra dos sliders do mesmo ADR.
- **Toda depressão vira lago, como no 0006** — rios curtos que terminam em laguinhos logo depois
  da nascente (medido na #43).
- **Preencher todas as depressões antes da descida (sem lagos pequenos nem grandes)** — some com
  os lagos, que o produto pede.
- **Simulação de vazão e erosão** — é hidrologia, fora de escopo, e cara demais para a prévia de
  150 ms (já descartada no 0005).

## Consequências

- Os rios ficam mais longos (cerca de metade chega ao mar) e os lagos cobrem cerca de 1,4% do mapa,
  igual na prévia e no mapa final.
- Com Montanhas em 0 ainda há rios, nascendo na terra alta sem montanha.
- Atravessar uma depressão pequena é a única vez em que o rio não desce a cada passo; ele segue no
  nível da água, sempre abaixo da nascente.
- O tamanho mínimo e o máximo de lago, a faixa de terra alta e o número de rios são constantes do
  gerador: mudar exige subir `GENERATOR_VERSION`.
