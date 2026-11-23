---
feature: F3
area: area:pins
updated: 2026-11-22
---

# F3 · Pins e drawer

Descreve como a feature funciona **hoje**. Planos e mudanças ficam nas issues; o PR que muda
o comportamento atualiza esta spec.

> Hoje funcionam: Adicionar pin (P), o desenho dos 7 tipos no mapa, o hover e a seleção, com o
> drawer mostrando o ícone, o nome editável e o tipo; arrastar um pin; excluir o selecionado com a
> tecla Delete, com o toast "Pin excluído" e Desfazer; e desfazer e refazer as mudanças nos pins
> (ver [mundos.md](mundos.md)). O resto (o rodapé do drawer com Excluir, a ficha completa,
> agrupamento, busca) vem do material de design e do PRD e ainda não existe.

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
- Aba Detalhes: tipo, ícone (biblioteca embutida ou imagem enviada), pin pai e campos livres
  chave/valor.
- Aba Conexões: o pin pai e os pins filhos, clicáveis (clicar seleciona o pin). As estradas
  ligadas ao pin entram com F5.

### Tipos de pin

Cidade, Vila, Castelo, Masmorra, NPC, Ponto de interesse, Personalizado. Cada tipo tem um ícone
padrão; o ícone pode vir de uma biblioteca embutida ou de uma imagem enviada pelo usuário
(PNG/JPG/SVG até 1 MB, redimensionada para 256 px ao enviar). Acima de 1 MB, o usuário escolhe
entre recusar o arquivo ou aceitá-lo com a redução.

## Estados

| Estado | Quando acontece | O que o usuário vê |
|---|---|---|
| Nenhum selecionado | Padrão do editor | Ferramenta Navegar ativa, sem pin no drawer (a partir de 768 px, o painel do drawer fica vazio; abaixo, fechado) |
| Pin novo | Clique no mapa com Adicionar pin | O pin cai e quica no lugar (460 ms); fica selecionado, e o drawer abre com o nome "Novo pin" em edição (o campo com o foco e o texto selecionado) |
| Selecionado | Clique num pin | Drawer aberto (abaixo de 768 px, sobreposto); o pin fica 1,1× maior e por cima dos outros, com rótulo com o nome, anel âmbar (elipse 40 × 16 no chão) e pulsação (1,6 s); a câmera desliza (350 ms) até o pin ficar no centro da área livre entre os dois painéis, até onde os limites de pan deixam (no zoom 1×, o mapa não se move) |
| Hover | Mouse sobre o pin | `scale(1.1)` + nome; cursor de mãozinha |
| Movimento reduzido | `prefers-reduced-motion: reduce` | Sem quique nem pulsação; a câmera salta direto para o pin |
| Arrastando | Arrastar um pin | Opacidade .6, sobe 14 px, sombra do desenho 12 px abaixo dele (`drop-shadow(0 12px 8px rgba(43,36,32,.4))`), marca tracejada no chão (elipse 40 × 16); fica por cima dos outros, sem rótulo, e o cursor é a mão fechada |
| Agrupado | Zoom < 0,8 e pins a < 34 px | Círculo com contador |
| Excluído | Excluir | O pin encolhe (180 ms, `ease-in`; com movimento reduzido, some na hora); toast "Pin excluído" com a ação "Desfazer", na base da área livre, acima do controle de zoom (com o toast de erro da geração à vista, empilhado 12 px acima dele). O toast some depois de 6 s, ou quando outra coisa muda no histórico (um passo novo, desfeito ou refeito) |
| Vazio | Mundo sem pins | TODO: não descrito no material |
| Imagem grande | Imagem enviada acima de 1 MB | Mensagem explicando o limite e duas opções: recusar o arquivo (o ícone anterior continua) ou aceitar com a redução. TODO: texto da mensagem e dos botões |
| Formato não aceito | Arquivo que não é PNG, JPG nem SVG | O arquivo é recusado, com uma mensagem dos formatos aceitos; o ícone anterior continua. TODO: texto da mensagem |

## Ações

| Ação | Resultado |
|---|---|
| Ferramenta "Adicionar pin" (P) + clique no mapa | Cria um pin naquele ponto (quique de 460 ms), do tipo do último pin do mundo (Cidade no primeiro), com o nome "Novo pin"; o drawer abre com o nome em edição, e a ferramenta volta para Navegar. Clicar num pin com a ferramenta o seleciona, sem criar outro; arrastar faz pan, sem criar |
| Clicar num pin (Navegar ou Adicionar pin) | Seleciona o pin e abre o drawer (E2). Com Medir distância, o clique é da medida |
| Editar o nome no drawer | O nome muda a cada tecla e é salvo com o mundo; vazio, volta o último nome ao sair do campo; Enter sai do campo. Fora do foco, o campo mostra o nome atual do pin (desfazer e refazer o atualizam) |
| Arrastar um pin | Apertar no pin e andar mais que a folga do clique o arrasta, preso ao ponteiro pelo ponto onde foi pego; soltar o deixa ali, num passo do histórico. A posição fica presa no mapa: arrastado para fora, o pin para na borda (u e v de 0 a 1). A câmera não faz pan, e a seleção não muda. Esc, um segundo dedo ou o cancelamento do ponteiro devolvem o pin ao lugar. Com Medir distância, o aperto é da medida |
| Ocultar por tipo | Esconde os pins daquele tipo |
| Excluir (Delete ou Backspace, a tecla "delete" do Mac) | Exclui o pin selecionado na hora, sem confirmação (não vale com o foco num campo, num modal, durante o arrasto nem com um painel sobreposto aberto: abaixo de 768 px, o pin selecionado abre o drawer sobreposto, então lá a tecla não exclui); o toast "Pin excluído" oferece "Desfazer", que devolve o pin com a ficha inteira, e Ctrl+Z também desfaz |
| Duplicar | Cria uma cópia ao lado do pin, "<nome> (cópia)", com a mesma ficha e sem os filhos |
| Centralizar | Centraliza a câmera no pin |
| Buscar (Ctrl K) | Busca pins por nome e tag; a câmera foca no resultado |
| Clicar num grupo | Zoom no grupo |
| Fechar o drawer (Esc, o botão fechar ou, abaixo de 768 px, o scrim) | Fecha o drawer e tira a seleção. Esc com Adicionar pin e sem pin selecionado volta para Navegar |

## Regras

- Pins têm hierarquia: um pin pode pertencer a outro (ex.: uma vila pertence a um reino), pelo
  campo opcional `parentId`. Qualquer tipo pode ser pai, sem limite de níveis; o pai não pode ser
  o próprio pin nem um descendente dele (sem ciclo). O pai é escolhido na aba Detalhes. Excluir o
  pai deixa os filhos sem pai, e Desfazer restaura o pai e os vínculos.
- Pins mantêm tamanho constante na tela (32 px de largura, 38,4 de altura) em qualquer zoom, com a
  âncora na base central; o rótulo com o nome (Cinzel 700 13/16 com contorno claro) aparece abaixo
  da âncora a partir do zoom 1,5×, no hover e na seleção.
- Os pins ficam acima do terreno e da decoração, fora do desfoque da geração. O pin mais ao sul
  cobre o de cima; o do hover e o selecionado ficam por cima de todos, e o clique acerta o de cima.
- Um clique fora do mapa (no fundo do canvas) não cria pin.
- Pins guardam coordenadas `(u, v)` de 0 a 1, independentes da projeção (RNF-9).
- Desfazer e refazer cobrem pins (ver [mundos.md](mundos.md)).
- Pan e zoom sem travar com 500 pins.

## Critérios de aceite vigentes

IDs `AC-F3-NN`, em sequência. AC novo recebe o próximo número livre; AC removido sai da
lista e o número não volta a ser usado.

- AC-F3-01: com "Adicionar pin" (P), clicar no mapa cria um pin naquele ponto, com o quique, do último tipo usado (Cidade no primeiro) e o nome "Novo pin", e abre o drawer com o nome em edição
- AC-F3-02: cada tipo tem a forma e as cores do design system, com 32 px na tela em qualquer zoom e âncora na base; o rótulo com o nome aparece a partir do zoom 1,5×, no hover e na seleção
- AC-F3-03: clicar num pin o seleciona (anel âmbar e pulsação), abre o drawer e centraliza a câmera na área livre entre os painéis; Esc fecha o drawer
- AC-F3-04: arrastar um pin muda a posição, com o estado Arrastando, e a posição fica em (u, v) de 0 a 1
- AC-F3-05: Excluir (Delete ou o botão do drawer) remove o pin na hora, sem confirmação, com o toast "Pin excluído" e "Desfazer", que o devolve com a ficha inteira
- AC-F3-06: o cabeçalho do drawer mostra o ícone, o nome editável, o tipo, o bioma (automático) e as coordenadas do pin
- AC-F3-07: a descrição aceita negrito, itálico, título H2, lista e link, e é salva com o pin
- AC-F3-08: as tags são adicionadas pelo campo "+ tag", removidas pelo chip e sugeridas em "Usadas no mundo"
- AC-F3-09: Centralizar centraliza a câmera no pin, e Duplicar cria uma cópia ao lado, "<nome> (cópia)", com a mesma ficha e sem os filhos
- AC-F3-10: a aba Detalhes edita o tipo, o ícone (biblioteca embutida ou imagem), o pin pai e os campos livres chave/valor
- AC-F3-11: uma imagem PNG, JPG ou SVG de até 1 MB é reduzida para 256 px e guardada como blob; acima de 1 MB, o usuário escolhe recusar ou aceitar com a redução; outro formato é recusado com a mensagem dos formatos aceitos; nos casos recusados, o ícone anterior continua
- AC-F3-12: o pai pode ser qualquer pin, menos o próprio e os descendentes dele; excluir o pai deixa os filhos sem pai, e Desfazer restaura o pai e os vínculos
- AC-F3-13: a aba Conexões lista o pin pai e os filhos, e clicar num deles o seleciona
- AC-F3-14: com zoom abaixo de 0,8×, pins a menos de 34 px uns dos outros viram um grupo com contador, e clicar no grupo dá zoom nele
- AC-F3-15: Camadas mostra e esconde os pins de cada tipo
- AC-F3-16: Buscar (Ctrl K) acha pins por nome e por tag, e escolher um resultado foca a câmera nele e o seleciona
- AC-F3-17: com 500 pins e 5.000 ícones decorativos, pan e zoom ficam em 60 fps de média e pelo menos 55 fps de mínimo
- AC-F3-18: abaixo de 768 px, o drawer é um painel sobreposto, e a ficha do pin pode ser consultada no celular (390 px)

## Pendências

Busca (Ctrl K), escolha de ícone/upload e abas Detalhes e Conexões: sem mockup: segue o [design system](../design/design-system.md), e os prints são revistos no PR.
