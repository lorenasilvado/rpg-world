---
feature: F5
area: area:estradas
updated: 2026-11-04
---

# F5 · Estradas e rotas

Descreve como a feature funciona **hoje**. Planos e mudanças ficam nas issues; o PR que muda
o comportamento atualiza esta spec.

> Nada implementado ainda: o conteúdo abaixo vem do PRD (RF-5, desejável).

## Resumo

Estradas, trilhas e rotas marítimas ligam pontos e pins do mapa. Podem ser desenhadas à mão ou
geradas automaticamente pela rota mais barata pelo terreno. Estilo dos traços em
[design-system.md](../design/design-system.md#traços).

## Rotas/Telas

| Rota ou tela | O que mostra | Referência |
|---|---|---|
| E1 · Editor | Estradas (contínua) e trilhas (pontilhada) no mapa; ferramentas "Desenhar estrada" e "Rota automática" na toolbar | `../assets/design/editor-claro.png`, `../assets/design/editor-escuro.png` |
| Drawer da estrada | Nome, tipo de via, pins conectados e excluir | TODO: sem tela no material |

## Estados

| Estado | Quando acontece | O que o usuário vê |
|---|---|---|
| Desenhando | Ferramenta "Desenhar estrada" ativa | Prévia tracejada |
| Selecionada | Clique numa estrada | Halo âmbar; drawer da estrada aberto |
| Vazio | Mundo sem estradas | TODO: não descrito no material |
| Erro | Rota automática sem caminho possível | TODO: não descrito no material |

## Ações

| Ação | Resultado |
|---|---|
| "Desenhar estrada" (R) + cliques no mapa | Traça uma estrada; a curva é suavizada automaticamente |
| "Rota automática" (A) + dois pins | Gera a rota mais barata pelo terreno (evita água e montanhas, prefere planos) |
| "Conectar cidades" | Gera uma malha de estradas entre todos os pins do tipo Cidade |
| Clicar numa estrada | Abre o drawer da estrada |
| Excluir no drawer | Remove a estrada |

## Regras

- Tipos de via com estilos distintos: estrada, trilha, rota marítima.
- A rota automática nunca cruza água (exceto rota marítima) e evita montanhas quando há desvio.
- Desfazer e refazer cobrem estradas (ver [mundos.md](mundos.md)).

## Critérios de aceite vigentes

IDs `AC-F5-NN`, em sequência. AC novo recebe o próximo número livre; AC removido sai da
lista e o número não volta a ser usado.

Nenhum ainda: os ACs nascem no `/planejar M<n>`.

## Pendências

> Pendente: como a rota automática trata rios e lagos (pontes, custo, desvio)?

> Pendente: onde fica o botão "Conectar cidades" (não aparece nas telas)?
