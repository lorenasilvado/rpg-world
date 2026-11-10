# 0006. Rios e lagos com sliders de forma: o traçado acompanha Continente e Costa

- Status: Aceita
- Data: 2026-11-10
- Questão: como os rios ficam quando Tamanho do continente ou Rugosidade da costa mudam a elevação? (`docs/specs/geracao-terreno.md`)
- Substitui: [ADR 0005](0005-rios-e-lagos-por-descida-de-gradiente.md)

## Contexto

O ADR 0005 decidiu rios por descida de gradiente e lagos nas depressões, sem hidrologia, partindo de
uma regra da geração: o ruído fica fixo pela seed, e só os limiares mudam quando um slider se mexe.
Por isso ele concluiu que o traçado dos rios nunca muda com os sliders.

A #41 (PR #58) mudou essa premissa para dois sliders. Tamanho do continente e Rugosidade da costa
precisam mudar a forma da terra, então mudam a elevação: as camadas de ruído continuam fixas pela
seed, mas o peso com que elas se combinam depende desses dois sliders. Os outros sete sliders
(Oceano, Praias, Desertos, Florestas, Montanhas, Neve e Temperatura) só mudam limiares e não tocam
na elevação. Este ADR repete a decisão do 0005 e ajusta só a regra dos sliders.

## Decisão

- **Rios:** nascem em células de montanha, escolhidas pelo RNG da seed, e descem pelo gradiente da
  elevação até o mar ou um lago. Não há slider de rios.
- **Lagos:** se a descida fica presa numa depressão, a depressão vira lago e o rio termina nele.
- **Modelo:** lago é um bioma no `WorldField`, e não conta como oceano. Rio é uma polilinha nas
  coordenadas do mapa, devolvida pelo worker e desenhada na textura do terreno.
- **Sliders:** os sete sliders de limiar não mudam a elevação, então não mudam o traçado dos rios;
  mexer no oceano só corta o rio na costa nova. Tamanho do continente e Rugosidade da costa mudam a
  elevação, e o traçado dos rios é refeito com a elevação nova.
- **Determinismo:** só operações exatas, como no resto do núcleo.

## Alternativas consideradas

- **Manter o 0005 e tirar Continente e Costa da elevação** — os dois passariam a agir só na
  classificação, mas não dariam a forma de ilhas e de costa recortada que a #41 pede, e o código já
  mergeado teria de mudar.
- **Calcular os rios com uma elevação de referência fixa** (Continente e Costa no padrão) — o traçado
  nunca mudaria, mas os rios deixariam de acompanhar o terreno visível e poderiam atravessar o mar.
- **Simulação de vazão e erosão** — é hidrologia, fora de escopo, e cara demais para a prévia de
  150 ms (já descartada no 0005).

## Consequências

- Os rios acompanham o terreno. Com os sete sliders de limiar, nada muda de lugar; com Continente ou
  Costa, os rios mudam junto com a terra.
- O cache do ruído no worker (#45) precisa refazer os rios ao mudar Continente ou Costa, não só ao
  mudar a seed.
- A rota automática do M3 terá de decidir como tratar rios e lagos (pontes).
- Como é desenhado na textura, o rio engrossa junto com o terreno no zoom.
