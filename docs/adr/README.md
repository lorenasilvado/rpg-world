# Decisões (ADRs)

Cada arquivo `NNNN-<slug>.md` registra uma decisão técnica duradoura: por que foi feito assim.

## Índice

| # | Título | Status | Data |
|---|---|---|---|
| [0001](0001-stack-da-v1.md) | Stack da v1: React + TypeScript, PixiJS e núcleo de geração num Web Worker | Aceita | 2026-11-04 |
| [0002](0002-hospedagem-github-pages.md) | Hospedagem no GitHub Pages, com o repositório público | Aceita | 2026-11-04 |
| [0003](0003-app-so-local-na-v1.md) | App só local na v1: sem contas, backend nem sincronização | Aceita | 2026-11-04 |
| [0004](0004-go-no-go-m0.md) | Go no M0: seguir para o M1 com a stack e os spikes validados | Aceita | 2026-11-09 |
| [0005](0005-rios-e-lagos-por-descida-de-gradiente.md) | Rios por descida de gradiente e lagos nas depressões, sem hidrologia | Superada por 0006 | 2026-11-09 |
| [0006](0006-rios-com-sliders-de-forma.md) | Rios e lagos com sliders de forma: o traçado acompanha Continente e Costa | Aceita | 2026-11-10 |
| [0007](0007-campo-gelado-bioma-proprio.md) | O campo gelado é um bioma próprio, separado da neve de montanha | Aceita | 2026-11-11 |
| [0008](0008-nascentes-na-terra-alta-e-depressoes-pequenas.md) | Rios nascem na terra alta fixa, e depressões pequenas não viram lago | Proposta | 2026-11-11 |

Mantenha este índice em dia ao criar um ADR ou mudar o status de um.

## Status

| Status | Significa |
|---|---|
| `Proposta` | Em discussão; ainda pode mudar |
| `Aceita` | Vale para o projeto; o texto não muda mais |
| `Superada por NNNN` | Substituída por um ADR mais novo |
| `Revertida` | Desfeita sem substituta |

## Regras

- Número sequencial com 4 dígitos (`0001`), nunca reaproveitado.
- ADR `Aceita` é imutável. Para mudar a decisão, crie um ADR novo e marque o antigo como
  `Superada por NNNN` (só a linha de status do antigo muda).
- `Questão:` é opcional: a pergunta que o ADR responde ou a issue que o motivou.
- O Claude propõe ADRs como `Proposta` e só os cria depois do ok do usuário.

## Template

Copie [`_template.md`](_template.md):

```markdown
# NNNN. <Decisão em uma frase>

- Status: Proposta      <!-- Proposta | Aceita | Superada por NNNN | Revertida -->
- Data: AAAA-MM-DD
- Questão: <opcional>

## Contexto
## Decisão
## Alternativas consideradas
## Consequências
```
