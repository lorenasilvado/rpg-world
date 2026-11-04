# 0003. App só local na v1: sem contas, backend nem sincronização

- Status: Aceita
- Data: 2026-11-04
- Questão: haverá contas e sincronização em nuvem, ou o app será só local? (PRD, Questões em aberto)

## Contexto

O "Fora de escopo" da v1 já exclui colaboração em tempo real e backend. O PRD deixava em aberto se
haveria contas e sincronização em nuvem.

## Decisão

Na v1 o app é só local: os mundos e as imagens enviadas ficam no IndexedDB do navegador (Dexie), e
a troca entre máquinas é por exportar e importar JSON. Não há contas, login, backend nem
integrações externas.

## Alternativas consideradas

- **Contas e sincronização em nuvem na v1** — exigiria auth e backend, contra o "Fora de escopo".

## Consequências

- Sem custos de servidor e sem dados pessoais guardados fora do navegador.
- Limpar os dados do navegador apaga os mundos: exportar o JSON é o único backup.
- Nuvem, se vier depois da v1, entra num ADR novo que substitui este.
