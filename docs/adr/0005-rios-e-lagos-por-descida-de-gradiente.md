# 0005. Rios por descida de gradiente e lagos nas depressões, sem hidrologia

- Status: Aceita
- Data: 2026-11-09
- Questão: como os rios e lagos da v1 são gerados e entram no modelo? (`docs/specs/geracao-terreno.md`)

## Contexto

A v1 tem rios e lagos, sem hidrologia (rios hidrológicos são Won't no PRD). O método precisa estar
definido antes do núcleo de geração, porque muda o modelo do mundo e o custo das rotas do M3. O
protótipo não tem rios, e o PRD só sugere a descida de gradiente.

Duas regras da geração limitam a escolha: o ruído fica fixo pela seed, só os limiares mudam quando
um slider se mexe; e o núcleo precisa dar o mesmo resultado em qualquer navegador (RNF-4).

## Decisão

- **Rios:** nascem em células de montanha, escolhidas pelo RNG da seed, e descem pelo gradiente da
  elevação até o mar ou um lago. Não há slider de rios.
- **Lagos:** se a descida fica presa numa depressão, a depressão vira lago e o rio termina nele.
- **Modelo:** lago é um bioma no `WorldField`, e não conta como oceano. Rio é uma polilinha nas
  coordenadas do mapa, devolvida pelo worker e desenhada na textura do terreno.
- **Sliders:** a elevação não muda com os sliders, então o traçado dos rios também não muda. Mexer
  no oceano só corta o rio na costa nova.
- **Determinismo:** só operações exatas, como no resto do núcleo.

## Alternativas consideradas

- **Simulação de vazão e erosão** — é hidrologia, fora de escopo, e cara demais para a prévia de
  150 ms.
- **Rio como bioma em cada célula** — fica serrilhado no zoom e não dá um traçado para desenhar com
  o estilo do mapa.
- **Rio como sprite ou objeto vetorial separado no renderer** — criaria uma camada a mais só para
  um traço que não muda durante a navegação.

## Consequências

- Os rios acompanham o terreno, e nada muda de lugar enquanto os sliders se mexem.
- A rota automática do M3 terá de decidir como tratar rios e lagos (pontes).
- Como é desenhado na textura, o rio engrossa junto com o terreno no zoom.
