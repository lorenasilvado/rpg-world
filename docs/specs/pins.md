---
feature: F3
area: area:pins
updated: 2026-11-04
---

# F3 · Pins e drawer

Descreve como a feature funciona **hoje**. Planos e mudanças ficam nas issues; o PR que muda
o comportamento atualiza esta spec.

> Nada implementado ainda: o conteúdo abaixo vem do material de design e do PRD.

## Resumo

Pins marcam cidades, NPCs e locais no mapa e funcionam como fichas de campanha. Clicar num pin abre
um drawer à direita para ver e editar nome, tipo, descrição em texto rico, tags, imagem de capa e
campos livres. Aparência dos pins em [design-system.md](../design/design-system.md#pins).

## Rotas/Telas

| Rota ou tela | O que mostra | Referência |
|---|---|---|
| E1 · Editor | Pins por tipo no mapa | `../assets/design/editor-claro.png`, `../assets/design/editor-escuro.png` |
| E2 · Editor com pin selecionado | Drawer do pin aberto, câmera centralizada no pin | `../assets/design/editor-drawer-claro.png`, `../assets/design/editor-drawer-escuro.png` |

### E2 · Drawer do pin

- Drawer à direita (400 px, altura total), com botão fechar no topo e área "Adicionar imagem de capa
  (16:9)".
- Cabeçalho: ícone do pin, nome (ex.: "Valdora"), etiqueta do tipo (ex.: "Cidade"), bioma e
  coordenadas (ex.: "Colina · x 710, y 580"). O bioma é preenchido automaticamente.
- Abas: Descrição (ativa), Detalhes, Conexões.
- Descrição: editor de texto com negrito, itálico, título H2, lista e link.
- Tags: chips removíveis (ex.: capital, porto), campo "+ tag" e sugestões "Usadas no mundo".
- Rodapé fixo: Centralizar, Duplicar, Excluir (botão destrutivo vermelho).
- A aba Conexões lista estradas e pins ligados ao pin.

### Tipos de pin

Cidade, Vila, Castelo, Masmorra, NPC, Ponto de interesse, Personalizado. Cada tipo tem um ícone
padrão; o ícone pode vir de uma biblioteca embutida ou de uma imagem enviada pelo usuário
(PNG/JPG/SVG até 1 MB, redimensionada para 256 px ao enviar). Acima de 1 MB, o usuário escolhe
entre recusar o arquivo ou aceitá-lo com a redução.

## Estados

| Estado | Quando acontece | O que o usuário vê |
|---|---|---|
| Nenhum selecionado | Padrão do editor | Ferramenta Navegar ativa, sem drawer |
| Selecionado | Clique num pin | Drawer aberto; o pin ganha rótulo com o nome, anel âmbar e pulsação; a câmera centraliza o pin na área livre entre os dois painéis |
| Hover | Mouse sobre o pin | `scale(1.1)` + nome |
| Arrastando | Arrastar um pin | Opacidade .6, sobe 14 px, marca tracejada no chão |
| Agrupado | Zoom < 0,8 e pins a < 34 px | Círculo com contador |
| Excluído | Excluir | O pin encolhe (180 ms); toast "Pin excluído" com a ação "Desfazer" |
| Vazio | Mundo sem pins | TODO: não descrito no material |
| Imagem grande | Imagem enviada acima de 1 MB | Mensagem explicando o limite e duas opções: recusar o arquivo (o ícone anterior continua) ou aceitar com a redução. TODO: texto da mensagem e dos botões |
| Formato não aceito | Arquivo que não é PNG, JPG nem SVG | O arquivo é recusado, com uma mensagem dos formatos aceitos; o ícone anterior continua. TODO: texto da mensagem |

## Ações

| Ação | Resultado |
|---|---|
| Ferramenta "Adicionar pin" (P) + clique no mapa | Cria um pin naquele ponto (quique de 420–460 ms) |
| Clicar num pin | Abre o drawer (E2) |
| Arrastar um pin | Muda a posição |
| Ocultar por tipo | Esconde os pins daquele tipo |
| Excluir (Delete) | Exclui na hora, sem confirmação; o toast "Pin excluído" oferece "Desfazer", e Ctrl+Z também desfaz |
| Duplicar | TODO: não descrito no material |
| Centralizar | Centraliza a câmera no pin |
| Buscar (Ctrl K) | Busca pins por nome e tag; a câmera foca no resultado |
| Clicar num grupo | Zoom no grupo |
| Fechar o drawer (Esc) | Fecha o drawer |

## Regras

- Pins têm hierarquia: um pin pode pertencer a outro (ex.: uma vila pertence a um reino).
- Pins mantêm tamanho constante na tela (32 px) em qualquer zoom; o rótulo com o nome aparece a
  partir do zoom 1,5×.
- Pins guardam coordenadas `(u, v)` de 0 a 1, independentes da projeção (RNF-9).
- Desfazer e refazer cobrem pins (ver [mundos.md](mundos.md)).
- Pan e zoom sem travar com 500 pins.

## Critérios de aceite vigentes

IDs `AC-F3-NN`, em sequência. AC novo recebe o próximo número livre; AC removido sai da
lista e o número não volta a ser usado.

Nenhum ainda: os ACs nascem no `/planejar M<n>`.

## Pendências

> Pendente: hierarquia de pins. Quais tipos podem ser pai de quais? Quantos níveis? Onde o usuário
> escolhe o pai (aba Detalhes?) e o que acontece com os filhos quando o pai é excluído?

> Pendente: conteúdo das abas Detalhes e Conexões (sem tela no material; os campos livres
> chave/valor ficam em Detalhes?).

> Pendente: telas da busca (Ctrl K) e da escolha de ícone/upload (sem tela no material).
