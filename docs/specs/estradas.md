---
feature: F5
area: area:estradas
updated: 2026-11-26
---

# F5 · Estradas e rotas

Descreve como a feature funciona **hoje**. Planos e mudanças ficam nas issues; o PR que muda
o comportamento atualiza esta spec.

> Implementado: o modelo (`Road`, com nome), as estradas salvas com o mundo, no Desfazer e
> Refazer, no JSON e no PNG; o desenho no mapa (estrada, trilha e rota marítima, na curva
> suavizada, com a ponta ligada acompanhando o pin), o interruptor "Estradas" em Camadas, Desenhar
> estrada (R), o clique numa estrada (com o halo âmbar) e o drawer da estrada (nome, tipo de via,
> extensão, "Liga" e Excluir). Rota automática aparece desabilitada na toolbar, e a aba Conexões do
> pin ainda não lista as estradas. O resto vem do PRD (RF-5, desejável), do protótipo do editor e
> das decisões do [plano do M3](../milestones/m3.md).

## Resumo

Estradas, trilhas e rotas marítimas ligam pontos e pins do mapa. Podem ser desenhadas à mão ou
geradas automaticamente pela rota mais barata pelo terreno. Estilo dos traços em
[design-system.md](../design/design-system.md#traços).

## Rotas/Telas

| Rota ou tela | O que mostra | Referência |
|---|---|---|
| E1 · Editor | Estradas (contínua) e trilhas (pontilhada) no mapa; ferramentas "Desenhar estrada" e "Rota automática" na toolbar | `../assets/design/editor-claro.png`, `../assets/design/editor-escuro.png` |
| Drawer da estrada | No lugar do drawer do pin (400 px; abaixo de 768 px ou em tela baixa, painel sobreposto): o cabeçalho "Estrada", o nome editável, "Tipo de via" num seletor segmentado (Estrada, Trilha, Rota marítima), "Liga" com os pins das pontas (cada um um botão; sem pin ligado, "Nenhum pin: as pontas ficam soltas no mapa."), "Extensão aproximada: N km" e, no rodapé, "Excluir estrada" | Sem mockup: segue o design system e o protótipo do editor |
| Aba Conexões do pin | As estradas ligadas ao pin (o outro pin, o tipo e o comprimento) | Ver [pins.md](pins.md) |

## Estados

| Estado | Quando acontece | O que o usuário vê |
|---|---|---|
| Desenhando | Ferramenta "Desenhar estrada" ativa | Cursor em cruz; a dica "Clique no mapa ou num pin para começar a estrada" e, depois do primeiro ponto, "Clique para adicionar pontos · Enter ou duplo clique termina · Esc cancela"; a curva pelos pontos marcados, com o traço da estrada, os pontos (círculos claros com borda escura) e, com o mouse, a linha tracejada do último ponto até o cursor |
| Selecionada | Clique numa estrada, ou a estrada recém-desenhada | Halo âmbar (13 px `#C8892B` a 55%, sob os traços); drawer da estrada aberto |
| Vazio | Mundo sem estradas | Nada no mapa; a aba Conexões do pin diz "Nenhuma estrada liga este pin. Use Desenhar estrada (R) ou Rota automática (A)." |
| Calculando | Rota automática ou "Conectar cidades" esperando o worker | Prévia tracejada âmbar em linha reta entre os pins (na rota) ou "Conectando…" na dica (na malha) |
| Sem caminho | Rota automática sem caminho por terra (ex.: pin numa ilha) | Toast de erro "Não há caminho por terra entre A e B." com a ação "Criar rota marítima" entre os dois pins; sem a ação, nada é criado |

## Ações

| Ação | Resultado |
|---|---|
| "Desenhar estrada" (R) + cliques no mapa | Cada clique (ou toque) adiciona um ponto, com prévia tracejada; arrastar continua fazendo pan. Clicar fora do mapa marca a borda mais próxima. Enter ou duplo clique (duplo toque) termina, com 2 pontos ou mais; com menos, nada muda. Esc apaga o desenho e, sem desenho, volta para Navegar (com um pin selecionado, o primeiro Esc tira a seleção; com um popover ou menu aberto, como Camadas, o Esc fecha só ele). Com o foco num botão ou outro controle, o Enter é do controle e não termina o desenho. Trocar de ferramenta descarta o desenho. A curva é suavizada (Catmull-Rom). Clicar num pin à vista põe o ponto na posição dele (sem selecioná-lo), e começar ou terminar num pin liga a ponta ao pin (se o pin sai no meio do desenho, a ponta fica no ponto dela). A estrada criada ("Nova estrada", tipo Estrada) fica selecionada (o pin selecionado deixa de estar), é um passo no Desfazer, e a ferramenta volta para Navegar |
| "Rota automática" (A) + dois pins | A dica diz "Clique no pin de origem" e depois "Agora clique no pin de destino"; gera a rota mais barata pelo terreno, "Rota de A a B", tipo Estrada, ligada aos dois, com o toast "Rota criada" |
| "Criar rota marítima" (no toast Sem caminho) | Cria uma rota marítima, "Rota marítima de A a B", pela água entre os dois pins |
| "Conectar cidades" (na dica da Rota automática, com 2 cidades ou mais) | Liga todos os pins do tipo Cidade alcançáveis por terra com a menor malha (árvore mínima pelo custo do terreno), sem repetir pares já ligados por estrada, num passo só do Desfazer; o toast diz quantas estradas foram criadas e quantas cidades ficaram sem caminho por terra |
| Clicar numa estrada (com Navegar) | Seleciona a estrada (halo âmbar) e abre o drawer da estrada; o pin selecionado deixa de estar. O clique vale até 10 px da linha da estrada, mais largo que o traço; um pin ou um grupo de pins no mesmo ponto tem prioridade. Com "Estradas" desligada em Camadas, ou com outra ferramenta, o clique não seleciona a estrada. Esc ou o botão Fechar tiram a seleção |
| Mudar o nome ou o tipo de via no drawer | Muda a estrada no mapa; cada mudança é um passo no Desfazer, e as teclas seguidas no nome são um passo só (sair do campo encerra o passo). Um nome vazio não fica: ao sair do campo, volta o último nome. Enter sai do campo; Esc, nele, fecha o drawer |
| Clicar num pin em "Liga" | Seleciona o pin (o drawer mostra a ficha dele) |
| Excluir no drawer, ou Delete (ou Backspace) com a estrada selecionada | Remove a estrada na hora, com o toast "Estrada excluída" e "Desfazer". A tecla segue as exceções da tecla do pin: não vale com o foco num campo, num modal, dentro do drawer, com Ctrl, Alt ou Meta, nem com o painel sobreposto aberto |
| Interruptor "Estradas" em Camadas | Mostra ou esconde as estradas |

## Regras

- Tipos de via com estilos distintos: estrada, trilha, rota marítima. Os traços têm a largura e o
  tracejado do design system em px na tela, em qualquer zoom; no PNG, na escala da imagem.
- A curva passa por todos os pontos da estrada (Catmull-Rom).
- Onde duas estradas se cruzam, o contorno de uma não corta o traço da outra: os contornos de
  todas ficam por baixo dos traços de cima, no mapa e no PNG.
- Uma estrada sem nome num arquivo editado à mão é importada como "Estrada". Ao abrir o mundo, a
  ponta ligada a um pin que não existe perde o vínculo e fica no ponto dela.
- A rota automática nunca cruza água (exceto rota marítima) e evita montanhas quando há desvio.
- A rota pelo terreno roda num worker, numa grade de 256² (com a curva suavizada depois). O custo
  vem do bioma e da inclinação: planícies são baratas, floresta e colina custam mais, montanha
  rochosa e neve muito mais; água (oceano, lago, oásis) não é atravessável.
- Rios: a rota pode cruzar um rio, e cada travessia custa como uma ponte (caro), então ela
  prefere uma travessia só, no ponto mais estreito, e não segue o rio por dentro. No mapa, a
  estrada passa por cima do rio, sem traço próprio de ponte.
- A rota marítima usa a mesma busca só pela água (a terra só vale perto de cada pin).
- A ponta de uma estrada ligada a um pin acompanha o pin quando ele é arrastado; o meio do
  traçado não é recalculado. Excluir um pin exclui as estradas ligadas a ele; Desfazer devolve tudo.
- O comprimento da estrada é o da curva suavizada (com as pontas nos pins ligados), no tamanho do
  mundo em km, com o arredondamento da barra de escala (de 10 km para cima, inteiro).
- Uma seleção só no mapa: selecionar uma estrada tira a do pin, e selecionar um pin tira a da estrada.
- As estradas ficam acima do terreno e da decoração e abaixo dos pins, e não ficam borradas
  enquanto o mapa gera.
- Desfazer e refazer cobrem estradas (ver [mundos.md](mundos.md)).
- As estradas são salvas com o mundo e vão no JSON exportado; o PNG com "Pins e rótulos" leva
  também as estradas, a não ser que "Estradas" esteja desligada em Camadas (ver
  [mundos.md](mundos.md)).

## Critérios de aceite vigentes

IDs `AC-F5-NN`, em sequência. AC novo recebe o próximo número livre; AC removido sai da
lista e o número não volta a ser usado.

- AC-F5-01: estradas, trilhas e rotas marítimas aparecem no mapa com os traços do design system, com a curva suavizada, acima do terreno e da decoração e abaixo dos pins; a ponta ligada a um pin acompanha o pin quando ele é arrastado
- AC-F5-02: as estradas são salvas com o mundo, entram no Desfazer e Refazer e vão no JSON exportado, que reimporta idêntico
- AC-F5-03: o interruptor "Estradas" em Camadas mostra e esconde as estradas; o PNG exportado com pins e rótulos leva as estradas
- AC-F5-04: Desenhar estrada (R): cada clique adiciona um ponto, com prévia tracejada; Enter ou duplo clique termina (com 2 pontos ou mais) e Esc cancela; a estrada criada fica selecionada e é um passo no Desfazer
- AC-F5-05: começar ou terminar o desenho num pin liga a ponta da estrada ao pin
- AC-F5-06: clicar numa estrada a seleciona, com o halo âmbar, e abre o drawer da estrada (nome, tipo de via, comprimento em km, os pins ligados e Excluir); abaixo de 768 px ou em tela baixa, num painel sobreposto
- AC-F5-07: no drawer da estrada, mudar o nome ou o tipo de via muda a estrada no mapa, e cada mudança é um passo no Desfazer; clicar num pin ligado o seleciona
- AC-F5-08: Excluir (o botão do drawer ou Delete) remove a estrada na hora, com o toast "Estrada excluída" e "Desfazer"; excluir um pin exclui as estradas ligadas a ele, e Desfazer devolve tudo
- AC-F5-09: a rota pelo terreno entre dois pontos de terra nunca passa por água (oceano, lago ou oásis)
- AC-F5-10: a rota evita montanha rochosa e neve quando há desvio por terreno mais baixo, e prefere planícies
- AC-F5-11: a rota cruza rio só quando precisa, como uma ponte (sem seguir o rio por dentro), e leva no máximo 300 ms num mapa 1024², num worker
- AC-F5-12: Rota automática (A): o pin de origem e o de destino, com a dica guiando cada passo, criam a estrada "Rota de A a B" ligada aos dois, com o toast "Rota criada"; Esc cancela
- AC-F5-13: sem caminho por terra entre os dois pins, nada é criado e o toast "Não há caminho por terra entre A e B." oferece "Criar rota marítima", que cria uma rota marítima pela água entre eles
- AC-F5-14: "Conectar cidades", na dica da Rota automática, liga todas as cidades alcançáveis por terra com a menor malha, sem repetir pares já ligados, num passo só do Desfazer, em até 3 s com 30 cidades ("Conectando…" enquanto calcula); o toast diz quantas estradas foram criadas e quantas cidades ficaram sem caminho
- AC-F5-15: a aba Conexões do pin lista as estradas ligadas a ele (o outro pin, o tipo e o comprimento), e clicar numa seleciona o outro pin; sem estradas, "Nenhuma estrada liga este pin. Use Desenhar estrada (R) ou Rota automática (A)."
- AC-F5-16: com 500 pins, 300 estradas e 5.000 ícones decorativos, pan e zoom ficam em 60 fps de média e pelo menos 55 fps de mínimo

## Pendências

Nenhuma: as duas do material (rios e lagos na rota; onde fica "Conectar cidades") foram decididas
no [plano do M3](../milestones/m3.md) e estão nas Regras e nas Ações.
