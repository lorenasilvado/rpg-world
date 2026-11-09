# 0004. Go no M0: seguir para o M1 com a stack e os spikes validados

- Status: Aceita
- Data: 2026-11-09
- Questão: o M0 — Fundação e spike atingiu o critério de saída para começar o M1? (`docs/milestones/m0.md`)

## Contexto

O M0 testou os maiores riscos antes do código de produção: o estilo visual, o determinismo entre
navegadores e o desempenho da geração e dos sprites. O critério de saída era um go/no-go, decidido
pelo usuário no `/fechar` do M0.

| Item do critério | Resultado |
|---|---|
| 1. `dev`, `lint`, `test` e CI (#1) | atendido |
| 2. Layout vazio responde abaixo de 768 px (#5) | atendido |
| 3. Mockup aprovado, com paleta e spritesheet (#7) | atendido |
| 4. Hash igual nos 3 navegadores (#8) | atendido |
| 5. Metas de tempo (#9) | atendido, para o núcleo mínimo (`elevation` e `biome`) |
| 5. Meta de fps com 5.000 sprites (#10, #38) | atendido com ressalva |

Medições de fps (5.000 sprites, meta de pelo menos 55 de mínimo):

- **AMD Radeon RX 7600 (dedicada):** 2 de 6 medições logo depois de abrir o Chrome ficaram abaixo
  da meta (52 e 1 fps; o caso de 1 fps ficou sem causa confirmada).
- **Apple M4 (integrada):** 59,9 fps de mínimo em "Medir automático" (#38). A medição manual e a
  medição logo depois de abrir o Chrome não foram feitas.

A descrição do milestone no GitHub foi escrita antes dessa medição e ainda cita a #38 como
pendente. A #38 foi fechada depois, por decisão do usuário, que considerou o Apple M4 suficiente
para o projeto.

## Decisão

**Go.** O projeto segue para o M1 com a stack do ADR 0001. A cena gasta cerca de 0,2 ms de JS por
quadro (mediana), e o M1 inclui culling e nível de detalhe.

## Alternativas consideradas

- **No-go até medir num Intel Iris Xe** — não há esse notebook disponível, e o risco que resta não
  justifica parar o projeto.

## Consequências

- A GPU de referência do RNF-1 (Intel Iris Xe, 1080p) não foi medida, e o Apple M4 é bem mais forte
  que ela. O RNF-1 segue sem prova nessa GPU.
- As metas de tempo só valem para o núcleo mínimo: o M1 mede de novo com o pipeline completo.
- O código dos spikes pode ser descartado: o M1 reescreve o que for de produção.
