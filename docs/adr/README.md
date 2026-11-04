# Decisões (ADRs)

Cada arquivo `NNNN-<slug>.md` registra uma decisão técnica duradoura: por que foi feito assim.

## Índice

| # | Título | Status | Data |
|---|---|---|---|
| [0001](0001-stack-da-v1.md) | Stack da v1: React + TypeScript, PixiJS e núcleo de geração num Web Worker | Aceita | 2026-11-04 |
| [0002](0002-hospedagem-github-pages.md) | Hospedagem no GitHub Pages, com o repositório público | Aceita | 2026-11-04 |
| [0003](0003-app-so-local-na-v1.md) | App só local na v1: sem contas, backend nem sincronização | Aceita | 2026-11-04 |

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
