---
feature: F4
area: area:mundos
updated: 2026-11-25
---

# F4 · Mundos e persistência

Descreve como a feature funciona **hoje**. Planos e mudanças ficam nas issues; o PR que muda
o comportamento atualiza esta spec.

> Hoje o app abre na Lista de mundos: os cartões dos mundos salvos (miniatura, nome, "Editado há
> X · N pins"), cartões esqueleto enquanto lê o banco, a lista vazia no primeiro acesso, abrir um
> mundo, Novo mundo pelo assistente, a volta do editor para a lista pelo logo da sidebar e o menu
> "⋯" do cartão, que renomeia, duplica, exporta e exclui (com confirmação). Exportar baixa o
> arquivo do mundo (.json), pelo "⋯", pela barra do editor (Exportar › Arquivo do mundo (.json)) e
> pelo menu do "Erro ao salvar"; Importar (o botão, o link "importe um arquivo .json" ou um
> arquivo solto na lista) cria um mundo novo a partir dele, e um arquivo recusado abre o modal 03.
> Exportar › Imagem (.png), na barra do editor, baixa o mapa em PNG em 1×, 2× ou 4×, com ou sem os
> pins e os rótulos. O mundo aberto é salvo sozinho no IndexedDB (Dexie, em `src/persistence/`), com o
> indicador Salvando… / Salvo / Erro ao salvar abaixo do nome do mundo, na barra da sidebar (só com a
> sidebar aberta). A gravação acontece 500 ms depois da última mudança no nome, na seed, nos
> parâmetros, nos pins ou nas estradas (e já, ao criar o mundo, ao voltar à lista e ao esconder ou
> sair da página); com "Erro ao salvar", voltar à lista pergunta antes de fechar o mundo. As
> estradas ainda só entram por um arquivo importado (ver [estradas.md](estradas.md)). Desfazer e
> Refazer (botões da barra, Ctrl+Z e Ctrl+Shift+Z) cobrem os pins, as estradas e os parâmetros de
> geração. O resto vem do material de
> design e do PRD.

## Resumo

Os mundos são salvos automaticamente no navegador (IndexedDB) e listados na tela inicial, onde o
usuário cria, abre, renomeia, duplica, exporta, importa e exclui mundos. Inclui exportar o mapa como
PNG e o histórico de desfazer/refazer do mundo.

## Rotas/Telas

| Rota ou tela | O que mostra | Referência |
|---|---|---|
| 01 · Lista de mundos | Tela inicial com os mundos salvos | `../assets/design/lista-claro.png`, `../assets/design/lista-escuro.png` |
| 02 · Lista vazia | Primeiro acesso, sem mundos | `../assets/design/lista-vazia-claro.png`, `../assets/design/lista-vazia-escuro.png` |
| 03 · Erro ao importar | Modal explicando por que o arquivo foi recusado | `../assets/design/erro-importar-claro.png`, `../assets/design/erro-importar-escuro.png` |

### 01 · Lista de mundos

- Cabeçalho de 72 px: logo e "RPG World Builder"; à direita, alternar tema e ajuda (o modal
  "Atalhos de teclado").
- Título "Seus mundos" com a contagem (ex.: "8 mundos", "1 mundo"); botões Importar (secundário) e
  Novo mundo (primário, âmbar).
- Grade de cartões, do editado por último ao mais antigo, com 24 px entre eles: 4 colunas a partir de
  1280 px, 3 a partir de 1024, 2 a partir de 640 e 1 no celular. Cartão: miniatura do mapa 16:10
  (o terreno com a seed e os parâmetros do mundo, 256², gerado num worker só das miniaturas, uma por
  vez; o mapa quadrado aparece inteiro, centrado, com o fundo do mar dos lados; até chegar, só o
  fundo do mar), nome, "Editado há X · N pins" (ou "sem pins") e botão "⋯".
- "Editado há X" conta do `updatedAt` (a última gravação): "agora" (menos de 1 min), "N min",
  "N h", "ontem" (de 24 a 48 h), "N dias", "N semana(s)" (a partir de 7 dias), "N mês/meses" (a
  partir de 30 dias) e "N ano(s)" (a partir de 365 dias), arredondado para baixo.
- Menu "⋯": Renomear (`pencil`), Duplicar (`copy`), Exportar (`download`, baixa o arquivo do mundo,
  .json) e, após um separador,
  Excluir (`trash-2`) em vermelho. Abre abaixo do "⋯", alinhado à direita do cartão (acima, se não
  cabe abaixo, como no último cartão no celular), com o foco em Renomear; um menu aberto por vez.
  Com o menu aberto, o cartão ganha contorno âmbar. Teclado: Enter, Espaço ou seta para baixo no
  "⋯" abrem; setas, Home e End andam entre os itens habilitados; Esc fecha e devolve o foco ao "⋯";
  Tab ou um clique fora fecham.
- Modal "Renomear mundo" (480 px): campo "Nome do mundo" com o nome atual selecionado; Cancelar e
  "Renomear" (primário, desabilitado com o campo vazio). Enter grava. Abaixo de 768 px, o campo tem
  fonte de 16 px (no desktop, 15 px), para o iOS não aproximar a página ao focá-lo.
- Modal de Excluir (480 px): título "Excluir “<nome>”?", o texto "O mundo e os N pins dele serão
  excluídos deste navegador. Isso não pode ser desfeito." ("O mundo e o pin dele…" com um pin; "O
  mundo será excluído…" sem pins); Cancelar (com o foco ao abrir) e "Excluir mundo" (destrutivo,
  `--brick`, com `trash-2`).
- Enquanto um desses modais grava ou exclui, os botões ficam desabilitados e nem Esc nem o clique
  fora o fecham.
- Fechar um desses modais devolve o foco ao "⋯" do cartão; depois de excluir, ao "Novo mundo".

### 02 · Lista vazia

- Cabeçalho e botões Importar / Novo mundo iguais aos de 01, sem contagem.
- Ilustração central: moldura tracejada com grade, bússola e a inscrição "Terra incognita".
- Título "Nenhum mundo ainda" e texto "Gere um continente em poucos segundos e comece a marcar
  cidades, NPCs e locais."
- Botão grande "Criar meu primeiro mundo" e link "ou importe um arquivo .json".

### 03 · Erro ao importar

- Modal de 560 px sobre a lista, com fundo escurecido e desfocado; título "Importar mundo" e botão
  fechar.
- Área de arquivo com borda tracejada vermelha: nome (ex.: reino-antigo.json), tamanho (48 KB),
  status "Não aceito".
- Alerta "Este arquivo não é um mundo válido" com a causa e o passo para gerar um arquivo correto.
  Exemplo: "Falta a parte do terreno. Abra o mundo de origem, use Exportar › Arquivo do mundo
  (.json) e tente de novo."
- Dica "Arraste outro arquivo .json para esta janela ou escolha no computador."; botões Cancelar e
  "Escolher outro arquivo".
- O foco começa em "Escolher outro arquivo"; Cancelar, o fechar, Esc ou o clique fora fecham e
  devolvem o foco ao Importar. Enquanto um arquivo é lido, os botões ficam desabilitados.
- Motivos de recusa, cada um com a causa e o passo para corrigir (o alerta é "Este arquivo não é um
  mundo válido"):
  - não é JSON: "O arquivo não está em JSON: pode ser de outro tipo ou estar corrompido. Abra o
    mundo de origem, use Exportar › Arquivo do mundo (.json) e tente de novo."
  - não é um mundo do RPG World Builder (ou está fora do formato: um pin, uma estrada ou uma imagem
    que não fecha, um pin ou ponto de estrada fora do mapa, ou dois pins com o mesmo id): "O arquivo é um JSON, mas não é um mundo do RPG World Builder. Abra o mundo de
    origem, …"
  - falta a parte do terreno (a seed, um dos parâmetros ou a versão do gerador, ou um parâmetro fora
    de 0 a 100): "Falta a parte do
    terreno. Abra o mundo de origem, …"
  - o mundo é de uma versão do gerador (ou do arquivo) mais nova que a do app: "O mundo foi criado
    numa versão mais nova do gerador. Recarregue a página para atualizar o app e tente de novo."
- Se o navegador não consegue ler o arquivo (movido, apagado ou bloqueado), o modal mostra o alerta
  "Não foi possível ler o arquivo" com "O navegador não conseguiu abrir o arquivo: ele pode ter
  sido movido, apagado ou estar bloqueado. Escolha o arquivo de novo."
- Se o arquivo é válido mas o navegador não grava o mundo, o mesmo modal mostra o alerta "Não foi
  possível importar o mundo" com "O navegador não conseguiu gravar o mundo. Tente de novo; se
  continuar, libere espaço no navegador."

## Estados

| Estado | Quando acontece | O que o usuário vê |
|---|---|---|
| Vazio | Nenhum mundo salvo (primeiro acesso) | 02 · Lista vazia |
| Com mundos | Há mundos salvos | 01 · Lista de mundos |
| Erro ao importar | O arquivo não é um mundo válido | 03 · Erro ao importar |
| Salvando | Mudança no mundo ativo | Indicador "Salvando…" (`loader-circle` girando) |
| Salvo | Salvamento concluído | Indicador "Salvo" (`cloud`, verde) |
| Erro ao salvar | O salvamento falha | Indicador "Erro ao salvar" (`cloud-off`, vermelho). O app tenta salvar de novo a cada mudança; clicar no indicador oferece "Tentar de novo" e "Exportar .json" (backup: baixa o mundo como está na tela; se falha, o menu continua com "Não foi possível exportar o mundo. Tente de novo.") |
| Sem WebGL2 | O navegador não tem WebGL2 | A lista funciona (abrir o menu "⋯", renomear, duplicar, exportar, importar, excluir); abrir um mundo mostra o aviso no lugar do editor, com o botão "Voltar à lista" (ver [geracao-terreno.md](geracao-terreno.md)) |
| Carregando | Lista sendo lida do IndexedDB | Grade de 4 colunas com cartões esqueleto (em `--sunken` no lugar da miniatura e do texto), sem pular de layout quando os dados chegam |

## Ações

| Ação | Resultado |
|---|---|
| Abrir o app | Mostra a Lista de mundos (01 ou 02), depois dos cartões esqueleto; se o banco não abre, a lista vazia |
| Clicar num cartão | Abre o mundo no editor (E1), que gera o mapa dele |
| Voltar à lista (o logo no cabeçalho da sidebar do editor, "Voltar à lista de mundos") | Grava o que esperava a pausa e volta à Lista de mundos, lida de novo; o mundo editado vai para o topo. Se a gravação falha ("Erro ao salvar"), o mundo não fecha: o modal "Mudanças não salvas" avisa que as últimas mudanças se perdem e oferece "Tentar de novo" (grava e volta, se der certo), "Voltar sem salvar" e "Ficar no mundo" (ou Esc) |
| Novo mundo / "Criar meu primeiro mundo" | Abre o assistente (04, ver [geracao-terreno.md](geracao-terreno.md)); "Criar mundo" salva o mundo novo e o abre no editor, e Cancelar volta à lista |
| Importar / "importe um arquivo .json" | Abre o seletor de arquivos (.json); o arquivo escolhido é importado |
| Soltar um arquivo sobre a lista (ou sobre o modal 03) | Importa o arquivo, como escolhê-lo. Um arquivo que chega durante outra importação é importado logo depois dela (se chegam vários, o último) |
| Importar um arquivo válido | Grava um mundo novo (id novo, "Editado agora", no topo da lista), com o nome, a seed, os parâmetros, `sizeKm`, os pins (fichas, descrições, tags, campos, hierarquia), as estradas e as imagens do arquivo (cada imagem com um id novo; um pin cuja imagem não veio no arquivo fica sem ela, com o círculo hachurado); o modal 03, se aberto, fecha. Importar o mesmo arquivo de novo cria outro mundo |
| Importar um arquivo inválido | Abre 03 com o motivo; outro arquivo pode ser solto ou escolhido ("Escolher outro arquivo") sem fechar o modal, e é validado na hora |
| Renomear (menu "⋯") | Abre o modal "Renomear mundo"; "Renomear" grava o nome sem os espaços das pontas (o mundo vai para o topo, "Editado agora"); o mesmo nome só fecha; Cancelar, Esc ou o clique fora não mudam nada. Se a gravação falha, o modal continua com "Não foi possível renomear o mundo. Tente de novo." |
| Duplicar (menu "⋯") | Grava já uma cópia, "<nome> (cópia)", com seed, parâmetros, pins, estradas e as imagens enviadas (cada uma copiada com um id novo); a cópia vai para o topo e a contagem sobe. Se a gravação falha, o toast de erro "Não foi possível duplicar o mundo" (em `--brick`, na base da tela) oferece "Tentar de novo" e fechar |
| Exportar (menu "⋯" do cartão) | Baixa o arquivo do mundo salvo, `<nome-do-mundo>.json` (sem acento, em minúsculas, com hífens). Se falha, o toast de erro "Não foi possível exportar o mundo" oferece "Tentar de novo" e fechar |
| Exportar (barra do editor) | Abre o menu com "Arquivo do mundo (.json)" e "Imagem (.png)". "Arquivo do mundo (.json)" baixa o mundo como está na tela, mesmo o que ainda não foi gravado, e fecha o menu; se falha, o menu continua com "Não foi possível exportar o mundo. Tente de novo." "Imagem (.png)" fecha o menu e abre o modal "Exportar imagem". Teclado: setas, Home e End andam entre os itens habilitados; Esc fecha e devolve o foco ao botão |
| Exportar › Imagem (.png) | Abre o modal "Exportar imagem" (480 px): a Escala, em três opções lado a lado com o tamanho da imagem (1× "1024 × 1024 px", 2× "2048 × 2048 px", 4× "4096 × 4096 px"; começa em 1×; no 4×, o aviso "Em 4×, gerar a imagem pode levar até um minuto."), a caixa "Pins e rótulos" (marcada ao abrir), Cancelar e "Baixar PNG". "Baixar PNG" gera a imagem ("Gerando imagem…", com os controles desabilitados; nem Esc nem o clique fora fecham o modal), baixa `<nome-do-mundo>-<escala>x.png` (o nome como no .json, ex.: `terras-de-valdora-2x.png`) e fecha o modal. Se falha, o modal continua com "Não foi possível exportar a imagem. Tente de novo." Cancelar, Esc ou o clique fora fecham sem exportar. Ao fechar, o foco volta ao Exportar |
| Excluir (menu "⋯") | Abre a confirmação; "Excluir mundo" apaga o mundo e as imagens dele do IndexedDB, de vez (não há Desfazer: o histórico é do mundo), e o cartão sai da lista (sem mundos, a lista vazia). Cancelar, Esc ou o clique fora mantêm o mundo. Se a exclusão falha, o modal continua com "Não foi possível excluir o mundo. Tente de novo." |
| Desfazer / Refazer (Ctrl+Z / Ctrl+Shift+Z, ⌘ no Mac, ou os botões da barra do editor) | Desfaz ou refaz, um passo de cada vez, as mudanças nos pins (criar, mover, excluir, duplicar, renomear, a descrição, as tags e, na aba Detalhes, o tipo, o ícone e os campos livres), nas estradas (excluir um pin exclui as estradas ligadas a ele no mesmo passo) e nos parâmetros de geração (sliders, presets, "Restaurar padrão"). Arrastar um slider ou um pin é um passo só, contado ao soltar; as teclas seguidas no nome do mesmo pin também, e as da descrição, até o campo perder o foco ou a seleção mudar (depois disso, editar de novo é outro passo; o nome e a descrição são passos separados). Cada tag adicionada ou removida é um passo. Na aba Detalhes, cada escolha de tipo, imagem enviada ou removida é um passo; as teclas seguidas no valor de um campo livre são um passo só, até sair dele, e trocar a chave, adicionar ou remover um campo são um passo cada. Desfazer ou refazer parâmetros pede só o mapa final 1024², sem prévia. Os botões ficam desabilitados sem o que desfazer ou refazer. As teclas não valem com o foco num campo de texto (aí o desfazer é do campo), num modal, com um painel sobreposto aberto nem durante o arrasto de um pin ou de um slider (o passo do arrasto só entra ao soltar). Uma mudança nova depois de desfazer apaga o que havia para refazer. A seed não entra no histórico |

## Regras

- Salvamento automático local do mundo ativo; não existe botão "Salvar".
- Salva só seed, parâmetros, pins e estradas; o terreno é regerado (RNF-5).
- Imagens enviadas ficam no IndexedDB como blobs.
- O JSON importado é validado por schema; um JSON exportado reimporta idêntico. As imagens enviadas
  que os pins usam vão embutidas no JSON (base64); as que nenhum pin usa ficam de fora.
- O arquivo do mundo tem `format` ("rpg-world-builder/world"), `version` (do formato do arquivo), o
  mundo sem o `id` (com todos os parâmetros: um que falte no mundo salvo vai com o padrão) e as
  imagens. Num arquivo editado à mão, o nome, `sizeKm`, os pins e as estradas que faltem ganham o
  padrão ("Mundo importado", 800 km, nenhum); a seed, os parâmetros (cada um de 0 a 100, como os
  sliders) e a versão do gerador são obrigatórios. As posições dos pins e os pontos das estradas
  vão de 0 a 1, e cada pin tem um id próprio. Um mundo de uma versão do gerador mais velha é aceito.
- Desfazer e refazer usam um histórico único por mundo, que vale enquanto o mundo está aberto
  (voltar à lista o descarta; ele não é salvo) e guarda os últimos 100 passos.
- O mundo guarda `generatorVersion`, para ser regerado igual.
- O PNG é o mapa inteiro, sem a câmera, quadrado: 1× é o mapa 1024² (uma célula por pixel); no 2× e
  no 4×, o terreno é gerado de novo em 2048² e 4096², com a seed e os parâmetros do mundo, num worker
  só da exportação (o editor segue com o mapa dele), e os ícones, os pins e os rótulos crescem na
  mesma escala. No 1×, a imagem usa o mapa já exibido; enquanto ele gera, ou se a última geração falhou, gera o
  1024² de novo.
- O PNG mostra todos os ícones da decoração (sem o nível de detalhe do zoom) e, com "Pins e
  rótulos", as estradas e todos os pins soltos (sem os grupos), cada um com o nome embaixo; os nomes ficam por cima dos
  pins, e nenhum pin cobre um nome. A decoração, as estradas e os tipos
  de pin desligados em Camadas ficam de fora, como no mapa.

## Critérios de aceite vigentes

IDs `AC-F4-NN`, em sequência. AC novo recebe o próximo número livre; AC removido sai da
lista e o número não volta a ser usado.

- AC-F4-01: as mudanças no mundo aberto (nome, seed, parâmetros e pins) são salvas sozinhas no IndexedDB, e recarregar a página reabre o mundo igual (mesmo terreno, pins e fichas)
- AC-F4-02: o indicador mostra "Salvando…" e "Salvo"; se o salvamento falha, mostra "Erro ao salvar", tenta de novo a cada mudança, e clicar nele oferece "Tentar de novo" e "Exportar .json"
- AC-F4-03: o mundo salvo guarda só seed, parâmetros, pins, estradas, `sizeKm` e `generatorVersion` (e as imagens como blobs); o terreno é regerado
- AC-F4-04: a Lista de mundos é a tela inicial e mostra "Seus mundos" com a contagem e um cartão por mundo (miniatura 16:10, nome, "Editado há X · N pins" ou "sem pins"), com cartões esqueleto enquanto carrega
- AC-F4-05: sem mundos salvos, a lista mostra "Nenhum mundo ainda", o botão "Criar meu primeiro mundo" e o link "ou importe um arquivo .json"
- AC-F4-06: clicar num cartão abre o mundo no editor; "Novo mundo" abre o assistente, que salva e abre o mundo criado, e Cancelar volta à lista; o editor volta à lista pelo cabeçalho da sidebar
- AC-F4-07: o menu "⋯" do cartão renomeia, duplica e exclui o mundo; excluir pede confirmação num modal e não pode ser desfeito
- AC-F4-08: desfazer e refazer (Ctrl+Z, Ctrl+Shift+Z e os botões da barra) cobrem mudanças em pins e nos parâmetros de geração, num histórico único por mundo
- AC-F4-09: Exportar › Arquivo do mundo (.json) baixa o mundo, e importar esse arquivo cria um mundo idêntico (mesmo terreno, pins, fichas e imagens)
- AC-F4-10: importar um arquivo inválido mostra o modal "Importar mundo" com o motivo e o passo para corrigir, e outro arquivo pode ser solto ou escolhido sem fechar o modal
- AC-F4-11: Exportar › Imagem (.png) baixa o mapa em 1×, 2× ou 4× (com o terreno regerado na resolução maior), com ou sem pins e rótulos
- AC-F4-12: sem WebGL2, a Lista de mundos funciona (menu "⋯", importar, excluir), e abrir um mundo mostra o aviso no lugar do editor

## Pendências

O modal "Exportar imagem" não tem mockup: segue o [design system](../design/design-system.md), e os prints são revistos no PR.

> Pendente: por quanto tempo e quantas versões antigas do gerador (`generatorVersion`) serão
> mantidas ([overview.md](../overview.md)).
