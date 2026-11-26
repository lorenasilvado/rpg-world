---
feature: F3
area: area:pins
updated: 2026-11-26
---

# F3 · Pins e drawer

Descreve como a feature funciona **hoje**. Planos e mudanças ficam nas issues; o PR que muda
o comportamento atualiza esta spec.

> Hoje funcionam: Adicionar pin (P), o desenho dos 7 tipos no mapa, o hover e a seleção; o drawer
> com o cabeçalho (ícone, nome editável, tipo, bioma e coordenadas), a aba Descrição (texto rico e
> tags), a aba Detalhes (tipo, ícone da biblioteca ou imagem enviada, e campos livres) e o rodapé
> (Centralizar, Duplicar, Excluir); o pin pai (na aba Detalhes) e a aba Conexões; o agrupamento no
> zoom baixo e o interruptor de cada tipo em Camadas; a busca (Ctrl K); arrastar um pin;
> excluir o selecionado com a tecla Delete ou pelo rodapé, com o toast "Pin excluído" e Desfazer; e
> desfazer e refazer as mudanças nos pins (ver [mundos.md](mundos.md)). O resto (a imagem de capa)
> vem do material de design e do PRD e ainda não existe: a área da capa aparece
> com o botão desabilitado (esmaecido, com a etiqueta "Em breve").

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
  coordenadas (ex.: "Colina · x 710, y 580"). O bioma é preenchido automaticamente: o da célula sob
  o pin no mapa exibido (sem mapa ainda, só as coordenadas). As coordenadas vão de 0 a 1024 nos
  dois eixos.
- Abas: Descrição (ativa), Detalhes, Conexões. As setas, Home e End mudam de aba.
- Descrição: editor de texto com negrito, itálico, título H2, lista e link, pela barra do editor ou
  por Ctrl+B e Ctrl+I. Vazia, mostra "Escreva sobre este lugar…". O link abre uma linha com o endereço: Enter aplica (com texto selecionado,
  ele vira o link; sem, o endereço entra como texto com o link), vazio tira o link, Esc cancela. Só
  valem http, https e mailto; sem esquema, vira https (um e-mail solto vira mailto); outro endereço
  mostra "Use um endereço http, https ou mailto.". A regra vale também para o link colado, o criado
  ao digitar e o que vem na descrição salva ou importada: um link de outro esquema, ou com
  caracteres de controle ou invisíveis no endereço, vira texto, e um link sem esquema vira https.
  Na descrição salva, isso acontece ao abrir o mundo, e ela é gravada assim na próxima mudança.
- Tags: chips removíveis (ex.: capital, porto), campo "+ tag" (Enter, vírgula ou sair do campo
  adiciona) e sugestões "Usadas no mundo": as tags dos outros pins que este não tem, das mais usadas
  às menos, até 6 (sem nenhuma, a linha não aparece). Uma tag tem até 32 caracteres; repetida (sem
  diferenciar maiúsculas) não entra. Um mundo salvo ou importado com tag repetida a perde ao abrir
  (fica a grafia da primeira vez).
- Rodapé fixo: Centralizar, Duplicar, Excluir (botão destrutivo vermelho).
- Aba Detalhes, em três partes:
  - **Tipo e ícone:** a biblioteca embutida, com os 7 tipos (ícone e nome, em grade de 4 colunas; o
    do pin marcado). Escolher um troca o tipo e o ícone para o daquele tipo. Abaixo, "Enviar imagem"
    (com a imagem, "Trocar imagem" e "Remover imagem") e a dica "PNG, JPG ou SVG, até 1 MB". A
    imagem enviada vira o ícone do pin, no círculo do Personalizado (o tipo passa a ser
    Personalizado); "Remover imagem" volta ao Personalizado com o círculo hachurado.
  - **Pin pai:** um seletor com "Nenhum" e os pins que podem ser o pai, por nome (cada um com o
    tipo entre parênteses, ex.: "Valdora (Cidade)"), sem o próprio pin nem os descendentes dele, e
    a dica "O pin a que este pertence (ex.: a vila de um reino).".
  - **Campos:** pares chave/valor, na ordem em que foram criados (sem campos, "Anote o que quiser:
    governante, população, facção…"). "Adicionar campo" cria "Campo" ("Campo 2", "Campo 3"… se já
    existe) no fim, com a chave em edição (o foco e o texto selecionado); o × remove o campo. A
    chave tem até 40 caracteres e muda ao sair dela (Enter também sai): vazia, repetida (sem
    diferenciar maiúsculas) ou só de dígitos (ex.: "1200", que mudaria o campo de lugar), volta a
    anterior. Para o leitor de tela, as chaves são "Nome do campo 1", "Nome do campo 2"… O valor tem até 200 caracteres e muda a cada tecla.
- Aba Conexões: "Pin pai", com o pai, e "Pins filhos", com os filhos na ordem em que foram
  criados e o número deles entre parênteses quando há algum (ex.: "Pins filhos (2)"); cada um é um botão com o ícone, o nome e o tipo. Sem pai, "Sem pin pai. Escolha um na aba
  Detalhes."; sem filhos, "Nenhum pin pertence a este." (sem nenhum dos dois, o painel recebe o
  foco pelo Tab). Clicar num deles o seleciona, e a ficha dele abre na aba Conexões, com o foco na
  aba (selecionado de outro jeito, o pin abre na Descrição). As estradas ligadas ao pin entram com F5.

### Buscar

- Modal no topo da tela (560 px; no celular, a largura da tela menos 16 px de cada lado), sobre o
  scrim, aberto pelo Buscar da barra superior ou por Ctrl K (⌘ K no Mac), mesmo com o foco num campo
  (num modal ou com um painel sobreposto aberto, a tecla não abre). Abre com o campo vazio e o foco
  nele; o campo tem 16 px e, no lugar do anel de foco, a borda de baixo âmbar.
- O campo ("Buscar pins por nome ou tag") acha os pins pelo nome e pelas tags, sem diferenciar
  maiúsculas nem acentos ("avila" acha "Ávila"). A lista mostra cada pin com o ícone, o nome, o tipo
  e, à direita, as tags que bateram. Ordem: o nome que começa pelo texto, depois o nome que o tem no
  meio, depois só pela tag (começando pelo texto antes de no meio dela); no mesmo nível, pelo nome,
  em ordem alfabética. Mostra até 50.
- Mensagens abaixo do campo: vazio, "Digite o nome ou uma tag do pin."; nada achado, "Nenhum pin com
  “<texto>”."; mais de 50, "Mostrando 50 de <total> pins. Digite mais para refinar."; mundo sem pins,
  "Este mundo ainda não tem pins.".
- Teclado: as setas andam pela lista (do último volta ao primeiro, e ao contrário), Ctrl+Home e
  Ctrl+End vão às pontas, Enter escolhe o resultado ativo (o primeiro, ao digitar), Esc fecha. O foco
  fica no campo; o resultado ativo tem o fundo âmbar claro, e o mouse sobre um resultado o torna
  ativo.

### Tipos de pin

Cidade, Vila, Castelo, Masmorra, NPC, Ponto de interesse, Personalizado. Cada tipo tem um ícone
padrão; o ícone pode vir da biblioteca embutida (os ícones dos 7 tipos) ou de uma imagem enviada
pelo usuário, que aparece no círculo do Personalizado, cobrindo-o (o meio da imagem), no mapa e no
drawer. A imagem é PNG, JPG ou SVG (pelo tipo do arquivo; sem ele, pela extensão) de até 1 MB; ao
enviar, ela é reduzida para caber em 256 × 256 px, na mesma proporção (uma menor não aumenta), e
guardada como PNG, num blob do mundo, fora do JSON dele (o pin guarda o id da imagem; o SVG vira
pixels). Um SVG sem `width` e `height` é desenhado com o lado maior em 256 px, na proporção do
`viewBox` (sem ele, 256 × 256). Acima de 1 MB, o usuário escolhe entre recusar o arquivo ou aceitá-lo com a redução. Um
pin de outro tipo com imagem (de um mundo importado) mostra o ícone do tipo. Até a imagem chegar
do banco, o pin mostra o círculo hachurado. Acima de 20 MB, o arquivo é recusado sem a pergunta. Ao
abrir o mundo, as imagens dele que nenhum pin usa (trocadas, removidas ou de pins excluídos) saem
do banco.

## Estados

| Estado | Quando acontece | O que o usuário vê |
|---|---|---|
| Nenhum selecionado | Padrão do editor | Ferramenta Navegar ativa; o drawer fica fora da tela (a partir de 768 px, o mapa, a barra superior, a linha inferior e os toasts vão até a borda direita; abaixo, o painel sobreposto fechado) |
| Pin novo | Clique no mapa com Adicionar pin | O pin cai e quica no lugar (460 ms); fica selecionado, e o drawer abre com o nome "Novo pin" em edição (o campo com o foco e o texto selecionado) |
| Selecionado | Clique num pin | Drawer aberto (a partir de 768 px, ele entra deslizando pela direita em 200 ms, e fechá-lo, por Esc ou pelo botão fechar, o leva de volta; abaixo de 768 px, sobreposto, com a largura da sidebar (320 px, uma faixa do mapa à vista ao lado; tocar nela fecha o drawer) e os campos de texto em 16 px, para o iOS não aproximar a página ao focar um deles); o pin fica 1,1× maior e por cima dos outros, com rótulo com o nome, anel âmbar (elipse 40 × 16 no chão) e pulsação (1,6 s); a câmera desliza (350 ms) até o pin ficar no centro da área livre entre os dois painéis, até onde os limites de pan deixam (com o drawer aberto, o mapa pode ir para a esquerda até a borda direita dele chegar à do drawer: um pin perto da borda direita, mesmo no zoom 1×, sai de baixo do drawer) |
| Hover | Mouse sobre o pin | `scale(1.1)` + nome; cursor de mãozinha |
| Movimento reduzido | `prefers-reduced-motion: reduce` | Sem quique nem pulsação; a câmera salta direto para o pin |
| Arrastando | Arrastar um pin | Opacidade .6, sobe 14 px, sombra do desenho 12 px abaixo dele (`drop-shadow(0 12px 8px rgba(43,36,32,.4))`), marca tracejada no chão (elipse 40 × 16); fica por cima dos outros, sem rótulo, e o cursor é a mão fechada |
| Agrupado | Zoom < 0,8× e pins à vista a < 34 px uns dos outros na tela | Os pins somem, e no ponto médio deles (16 px acima, no meio do desenho de um pin) aparece um círculo de 38 px `#F7F1E3`, com borda de 2 px `#2B2420`, halo âmbar de 3 px e sombra, e o número de pins (Nunito 800 15). Na ordem da lista, cada pin ainda solto junta os soltos seguintes a menos de 34 px dele. O pan não muda os grupos; o zoom, sim. O pin selecionado e o arrastado nunca entram num grupo. Os grupos ficam abaixo dos pins soltos; sobre um grupo, o cursor é a lupa |
| Tipo escondido | Interruptor do tipo desligado em Camadas | Os pins do tipo somem do mapa e não recebem clique nem hover (com Adicionar pin, o clique ali cria um pin); o pin selecionado continua à vista. Todos os tipos começam ligados ao abrir o editor |
| Excluído | Excluir | O pin encolhe (180 ms, `ease-in`; com movimento reduzido, some na hora); toast "Pin excluído" com a ação "Desfazer", na base da área livre, acima do controle de zoom (com o toast de erro da geração à vista, empilhado 12 px acima dele). O toast some depois de 6 s, ou quando outra coisa muda no histórico (um passo novo, desfeito ou refeito) |
| Vazio | Mundo sem pins | TODO: não descrito no material |
| Imagem grande | Imagem enviada acima de 1 MB | Na aba Detalhes, abaixo do envio, a mensagem "Imagem acima de 1 MB" e "“<arquivo>” tem 2,4 MB, e o limite é 1 MB. Recuse o arquivo ou aceite a imagem reduzida para 256 px.", com "Recusar" (o ícone anterior continua, e o foco volta ao envio) e "Aceitar com redução" (com o foco) |
| Formato não aceito | Arquivo que não é PNG, JPG nem SVG | O arquivo é recusado, com o aviso "Formato não aceito" e "Envie uma imagem PNG, JPG ou SVG." (o × fecha o aviso); o ícone anterior continua |
| Imagem grande demais | Imagem enviada acima de 20 MB | Recusada sem a pergunta, com o aviso "Imagem grande demais" e "O arquivo tem 25 MB, e o máximo que dá para reduzir é 20 MB. Envie uma imagem menor."; o ícone anterior continua |
| Imagem que não abre | PNG, JPG ou SVG que o navegador não consegue ler | "Não deu para ler esta imagem. Envie uma imagem PNG, JPG ou SVG."; o ícone anterior continua |
| Imagem não guardada | O banco do navegador recusou a imagem | "Não deu para guardar a imagem. Tente de novo."; o ícone anterior continua |

## Ações

| Ação | Resultado |
|---|---|
| Ferramenta "Adicionar pin" (P) + clique no mapa | Cria um pin naquele ponto (quique de 460 ms), do tipo do último pin do mundo (Cidade no primeiro), com o nome "Novo pin"; o drawer abre com o nome em edição, e a ferramenta volta para Navegar. Clicar num pin com a ferramenta o seleciona, sem criar outro; arrastar faz pan, sem criar |
| Clicar num pin (Navegar ou Adicionar pin) | Seleciona o pin e abre o drawer (E2). Com Medir distância, o clique é da medida |
| Editar o nome no drawer | O nome muda a cada tecla e é salvo com o mundo; vazio, volta o último nome ao sair do campo; Enter sai do campo. Fora do foco, o campo mostra o nome atual do pin (desfazer e refazer o atualizam) |
| Arrastar um pin | Apertar no pin e andar mais que a folga do clique o arrasta, preso ao ponteiro pelo ponto onde foi pego; soltar o deixa ali, num passo do histórico. A posição fica presa no mapa: arrastado para fora, o pin para na borda (u e v de 0 a 1). A câmera não faz pan, e a seleção não muda. Esc, um segundo dedo ou o cancelamento do ponteiro devolvem o pin ao lugar. Com Medir distância, o aperto é da medida |
| Interruptor de um tipo em Camadas (abaixo de "Decoração") | Esconde ou mostra os pins daquele tipo; os grupos passam a contar só os pins à vista |
| Excluir (Delete ou Backspace, a tecla "delete" do Mac) | Exclui o pin selecionado na hora, sem confirmação (não vale com o foco num campo, no drawer do pin (um chip de tag, uma aba, o rodapé), num modal, durante o arrasto nem com um painel sobreposto aberto: abaixo de 768 px, o pin selecionado abre o drawer sobreposto, então lá a tecla não exclui); o toast "Pin excluído" oferece "Desfazer", que devolve o pin com a ficha inteira, e Ctrl+Z também desfaz |
| Escolher o pin pai (aba Detalhes) | Liga o pin ao pai escolhido ("Nenhum" o deixa sem pai) e é salvo com o mundo, num passo do histórico. A aba Conexões dos dois acompanha |
| Clicar num pin da aba Conexões | Seleciona o pin (a câmera vai até ele, como no clique no mapa) e abre a ficha dele na aba Conexões |
| Escolher o tipo, enviar ou remover a imagem (aba Detalhes) | Muda o pin na hora (o tipo, o ícone, a etiqueta do cabeçalho e o desenho no mapa) e é salvo com o mundo; cada escolha é um passo do histórico |
| Editar os campos livres (aba Detalhes) | Muda o pin e é salvo com o mundo. As teclas seguidas no valor de um campo viram um passo do histórico, até sair dele; trocar a chave, adicionar e remover um campo são um passo cada |
| Editar a descrição ou as tags | Muda o pin na hora e é salvo com o mundo. As teclas seguidas na descrição viram um passo do histórico, até sair do editor; cada tag adicionada ou removida é um passo. Fora do foco, o editor acompanha a descrição do pin (desfazer e refazer) |
| Duplicar (rodapé) | Cria uma cópia ao lado do pin (36 px à direita e 64 px abaixo na tela, no zoom atual, para os rótulos não se cobrirem; perto da borda, do outro lado), "<nome> (cópia)" (a cópia de uma cópia conta: "(cópia 2)", "(cópia 3)"…), com a mesma ficha (tipo, ícone, descrição, tags, campos e o mesmo pai) e sem os filhos; a cópia fica selecionada, num passo do histórico, e o foco fica no Duplicar da ficha dela |
| Centralizar (rodapé; para o leitor de tela, "Centralizar no pin") | A câmera desliza (350 ms) até o pin ficar no centro da área livre, aproximando até o zoom 1,6× se estiver mais longe (mais perto, o zoom fica). Perto da borda do mapa, a câmera para no limite do pan, e o pin fica fora do centro, do lado da borda. Abaixo de 768 px, o painel sobreposto fecha para o mapa aparecer, e o pin continua selecionado |
| Excluir (rodapé) | Exclui o pin como a tecla Delete, com o toast "Pin excluído" e Desfazer; o botão vale também no painel sobreposto (abaixo de 768 px). A partir de 768 px, o foco vai para o Desfazer da barra; abaixo, o painel fecha e o foco volta a quem o abriu |
| Buscar (o botão da barra ou Ctrl K) | Abre o modal Buscar (E2 → Buscar) |
| Escolher um resultado da busca (Enter ou clique) | Fecha a busca, seleciona o pin (o drawer abre) e leva a câmera até ele como o Centralizar: desliza (350 ms) até o centro da área livre, aproximando até o zoom 1,6× se estiver mais longe; perto da borda do mapa, para no limite do pan. Um pin de tipo escondido em Camadas aparece, por estar selecionado. A partir de 768 px, o foco volta a quem o tinha ao abrir a busca (sem ninguém, o Buscar da barra); abaixo, o painel sobreposto abre com a ficha, e o foco vai para o fechar dele |
| Fechar a busca (Esc ou clique fora) | Fecha sem mudar a seleção; o foco volta a quem o tinha ao abrir |
| Clicar num grupo (Navegar ou Adicionar pin) | A câmera desliza (350 ms) até o ponto médio do grupo, no centro da área livre, no zoom 1,3× (os pins se soltam); não seleciona nem cria pin |
| Fechar o drawer (Esc, o botão fechar ou, abaixo de 768 px, o scrim) | Fecha o drawer e tira a seleção. A partir de 768 px, fechar pelo botão ou pelo Esc no nome leva o foco ao mapa; abaixo, o painel sobreposto devolve o foco a quem o abriu. Esc com Adicionar pin e sem pin selecionado volta para Navegar |

## Regras

- Pins têm hierarquia: um pin pode pertencer a outro (ex.: uma vila pertence a um reino), pelo
  campo opcional `parentId`. Qualquer tipo pode ser pai, sem limite de níveis; o pai não pode ser
  o próprio pin nem um descendente dele (sem ciclo). O pai é escolhido na aba Detalhes. Excluir o
  pai deixa os filhos diretos sem pai, no mesmo passo do histórico (os netos continuam com o pai
  deles), e Desfazer restaura o pai e os vínculos. Ao abrir o mundo, um pai que não existe e um
  ciclo saem (o pin que fecha o ciclo, na ordem da lista, fica sem pai); o mundo é gravado assim na
  próxima mudança.
- Pins mantêm tamanho constante na tela (32 px de largura, 38,4 de altura) em qualquer zoom, com a
  âncora na base central; o rótulo com o nome (Cinzel 700 13/16 com contorno claro) aparece abaixo
  da âncora a partir do zoom 1,5×, no hover e na seleção.
- Os pins ficam acima do terreno e da decoração, fora do desfoque da geração. O pin mais ao sul
  cobre o de cima; o do hover e o selecionado ficam por cima de todos, e o clique acerta o de cima.
- Um clique fora do mapa (no fundo do canvas) não cria pin.
- Pins guardam coordenadas `(u, v)` de 0 a 1, independentes da projeção (RNF-9).
- Desfazer e refazer cobrem pins (ver [mundos.md](mundos.md)).
- Pan e zoom sem travar com 500 pins. Para isso, os rótulos ficam só nos pins à vista (com uma
  folga do tamanho do nome) e são preparados antes, uns poucos por quadro, a partir da abertura do
  mapa (com 500 pins, em uns 2 s); um rótulo que ainda não estava pronto entra em poucos quadros, no
  máximo 8 novos por quadro (o do hover e o do selecionado, na hora).

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
- AC-F3-19: a partir de 768 px, sem pin selecionado, o drawer fica fora da tela, e o mapa, a barra superior, a linha inferior (minimapa, toolbar e zoom) e os toasts usam a largura até a borda direita (12 px dela); selecionar um pin traz o drawer deslizando (200 ms), e fechá-lo o leva de volta

## Pendências

Busca (Ctrl K), aba Conexões e o seletor do pin pai: sem mockup: segue o [design system](../design/design-system.md), e os prints são revistos no PR. A aba Detalhes (a biblioteca, o envio de imagem e as mensagens dele) segue o protótipo e o design system, sem mockup.
