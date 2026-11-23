---
feature: F4
area: area:mundos
updated: 2026-11-22
---

# F4 · Mundos e persistência

Descreve como a feature funciona **hoje**. Planos e mudanças ficam nas issues; o PR que muda
o comportamento atualiza esta spec.

> Hoje o app abre na Lista de mundos: os cartões dos mundos salvos (miniatura, nome, "Editado há
> X · N pins"), cartões esqueleto enquanto lê o banco, a lista vazia no primeiro acesso, abrir um
> mundo, Novo mundo pelo assistente, a volta do editor para a lista pelo logo da sidebar e o menu
> "⋯" do cartão, que renomeia, duplica e exclui (com confirmação). Importar, o link "importe um
> arquivo .json" e o Exportar do menu ficam desabilitados até a importação e a exportação
> existirem. O mundo aberto é salvo sozinho no IndexedDB (Dexie, em `src/persistence/`), com o
> indicador Salvando… / Salvo / Erro ao salvar abaixo do nome do mundo, na barra da sidebar (só com a
> sidebar aberta). A gravação acontece 500 ms depois da última mudança no nome, na seed ou nos
> parâmetros (e já, ao criar o mundo, ao voltar à lista e ao esconder ou sair da página); com
> "Erro ao salvar", voltar à lista pergunta antes de fechar o mundo. No menu do
> erro, "Exportar .json" fica desabilitado até a exportação do mundo existir. As estradas ainda não
> existem: o mundo é salvo com a lista de estradas vazia. Desfazer e Refazer (botões da barra,
> Ctrl+Z e Ctrl+Shift+Z) cobrem os pins e os parâmetros de geração. O resto vem do material de
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
- Menu "⋯": Renomear (`pencil`), Duplicar (`copy`), Exportar (`download`) e, após um separador,
  Excluir (`trash-2`) em vermelho. Abre abaixo do "⋯", alinhado à direita do cartão (acima, se não
  cabe abaixo, como no último cartão no celular), com o foco em Renomear; um menu aberto por vez.
  Com o menu aberto, o cartão ganha contorno âmbar. Teclado: Enter, Espaço ou seta para baixo no
  "⋯" abrem; setas, Home e End andam entre os itens habilitados; Esc fecha e devolve o foco ao "⋯";
  Tab ou um clique fora fecham.
- Modal "Renomear mundo" (480 px): campo "Nome do mundo" com o nome atual selecionado; Cancelar e
  "Renomear" (primário, desabilitado com o campo vazio). Enter grava.
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
- Motivos de recusa: o arquivo não é JSON; não é um mundo do RPG World Builder; falta a parte do
  terreno (seed ou parâmetros); o mundo é de uma versão do gerador mais nova que a do app. Cada um
  tem a causa e o passo para corrigir. TODO: texto de cada motivo, além de "falta o terreno"
  (revisto por print no PR).

## Estados

| Estado | Quando acontece | O que o usuário vê |
|---|---|---|
| Vazio | Nenhum mundo salvo (primeiro acesso) | 02 · Lista vazia |
| Com mundos | Há mundos salvos | 01 · Lista de mundos |
| Erro ao importar | O arquivo não é um mundo válido | 03 · Erro ao importar |
| Salvando | Mudança no mundo ativo | Indicador "Salvando…" (`loader-circle` girando) |
| Salvo | Salvamento concluído | Indicador "Salvo" (`cloud`, verde) |
| Erro ao salvar | O salvamento falha | Indicador "Erro ao salvar" (`cloud-off`, vermelho). O app tenta salvar de novo a cada mudança; clicar no indicador oferece "Tentar de novo" e "Exportar .json" (backup) |
| Sem WebGL2 | O navegador não tem WebGL2 | A lista funciona (abrir o menu "⋯", renomear, duplicar, exportar, importar, excluir); abrir um mundo mostra o aviso no lugar do editor, com o botão "Voltar à lista" (ver [geracao-terreno.md](geracao-terreno.md)) |
| Carregando | Lista sendo lida do IndexedDB | Grade de 4 colunas com cartões esqueleto (em `--sunken` no lugar da miniatura e do texto), sem pular de layout quando os dados chegam |

## Ações

| Ação | Resultado |
|---|---|
| Abrir o app | Mostra a Lista de mundos (01 ou 02), depois dos cartões esqueleto; se o banco não abre, a lista vazia |
| Clicar num cartão | Abre o mundo no editor (E1), que gera o mapa dele |
| Voltar à lista (o logo no cabeçalho da sidebar do editor, "Voltar à lista de mundos") | Grava o que esperava a pausa e volta à Lista de mundos, lida de novo; o mundo editado vai para o topo. Se a gravação falha ("Erro ao salvar"), o mundo não fecha: o modal "Mudanças não salvas" avisa que as últimas mudanças se perdem e oferece "Tentar de novo" (grava e volta, se der certo), "Voltar sem salvar" e "Ficar no mundo" (ou Esc) |
| Novo mundo / "Criar meu primeiro mundo" | Abre o assistente (04, ver [geracao-terreno.md](geracao-terreno.md)); "Criar mundo" salva o mundo novo e o abre no editor, e Cancelar volta à lista |
| Importar / "importe um arquivo .json" | Abre a importação; arquivo inválido → 03 |
| Soltar ou escolher um arquivo | Valida na hora; o arquivo pode ser substituído sem fechar o modal |
| Renomear (menu "⋯") | Abre o modal "Renomear mundo"; "Renomear" grava o nome sem os espaços das pontas (o mundo vai para o topo, "Editado agora"); o mesmo nome só fecha; Cancelar, Esc ou o clique fora não mudam nada. Se a gravação falha, o modal continua com "Não foi possível renomear o mundo. Tente de novo." |
| Duplicar (menu "⋯") | Grava já uma cópia, "<nome> (cópia)", com seed, parâmetros, pins, estradas e as imagens enviadas (cada uma copiada com um id novo); a cópia vai para o topo e a contagem sobe. Se a gravação falha, o toast de erro "Não foi possível duplicar o mundo" (em `--brick`, na base da tela) oferece "Tentar de novo" e fechar |
| Exportar | Exporta o mundo em JSON; o mapa pode ser exportado como PNG em 1×, 2× ou 4× (o terreno é regerado na resolução maior, para impressão), com opção de incluir pins e rótulos |
| Excluir (menu "⋯") | Abre a confirmação; "Excluir mundo" apaga o mundo e as imagens dele do IndexedDB, de vez (não há Desfazer: o histórico é do mundo), e o cartão sai da lista (sem mundos, a lista vazia). Cancelar, Esc ou o clique fora mantêm o mundo. Se a exclusão falha, o modal continua com "Não foi possível excluir o mundo. Tente de novo." |
| Desfazer / Refazer (Ctrl+Z / Ctrl+Shift+Z, ⌘ no Mac, ou os botões da barra do editor) | Desfaz ou refaz, um passo de cada vez, as mudanças nos pins (criar, mover, excluir, renomear) e nos parâmetros de geração (sliders, presets, "Restaurar padrão"). Arrastar um slider ou um pin é um passo só, contado ao soltar; as teclas seguidas no nome do mesmo pin também, até o campo perder o foco ou a seleção mudar (depois disso, editar o nome de novo é outro passo). Desfazer ou refazer parâmetros pede só o mapa final 1024², sem prévia. Os botões ficam desabilitados sem o que desfazer ou refazer. As teclas não valem com o foco num campo de texto (aí o desfazer é do campo), num modal, com um painel sobreposto aberto nem durante o arrasto de um pin ou de um slider (o passo do arrasto só entra ao soltar). Uma mudança nova depois de desfazer apaga o que havia para refazer. A seed não entra no histórico |

## Regras

- Salvamento automático local do mundo ativo; não existe botão "Salvar".
- Salva só seed, parâmetros, pins e estradas; o terreno é regerado (RNF-5).
- Imagens enviadas ficam no IndexedDB como blobs.
- O JSON importado é validado por schema; um JSON exportado reimporta idêntico. As imagens enviadas
  vão embutidas no JSON (base64).
- Desfazer e refazer usam um histórico único por mundo, que vale enquanto o mundo está aberto
  (voltar à lista o descarta; ele não é salvo) e guarda os últimos 100 passos.
- O mundo guarda `generatorVersion`, para ser regerado igual.

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

Exportar (JSON e PNG): sem mockup: segue o [design system](../design/design-system.md), e os prints são revistos no PR.

> Pendente: por quanto tempo e quantas versões antigas do gerador (`generatorVersion`) serão
> mantidas ([overview.md](../overview.md)).
