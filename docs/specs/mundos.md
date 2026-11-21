---
feature: F4
area: area:mundos
updated: 2026-11-21
---

# F4 · Mundos e persistência

Descreve como a feature funciona **hoje**. Planos e mudanças ficam nas issues; o PR que muda
o comportamento atualiza esta spec.

> Nada implementado ainda: o conteúdo abaixo vem do material de design e do PRD.

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

- Cabeçalho de 72 px: logo e "RPG World Builder"; à direita, alternar tema e ajuda.
- Título "Seus mundos" com a contagem (ex.: "8 mundos"); botões Importar (secundário) e Novo mundo
  (primário, âmbar).
- Grade de 4 colunas de cartões: miniatura do mapa 16:10, nome, "Editado há X · N pins" (ou "sem
  pins") e botão "⋯".
- Menu "⋯": Renomear, Duplicar, Exportar e, após um separador, Excluir em vermelho. Com o menu
  aberto, o cartão ganha contorno âmbar.

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
| Sem WebGL2 | O navegador não tem WebGL2 | A lista funciona (abrir o menu "⋯", renomear, duplicar, exportar, importar, excluir); abrir um mundo mostra o aviso no lugar do editor (ver [geracao-terreno.md](geracao-terreno.md)) |
| Carregando | Lista sendo lida do IndexedDB | Grade de 4 colunas com cartões esqueleto (em `--sunken` no lugar da miniatura e do texto), sem pular de layout quando os dados chegam |

## Ações

| Ação | Resultado |
|---|---|
| Abrir o app | Mostra a Lista de mundos (01 ou 02) |
| Clicar num cartão | Abre o mundo no editor (E1) |
| Voltar à lista (cabeçalho da sidebar do editor) | Volta à Lista de mundos; o mundo já está salvo |
| Novo mundo / "Criar meu primeiro mundo" | Abre o assistente (04, ver [geracao-terreno.md](geracao-terreno.md)); "Criar mundo" salva o mundo novo e o abre no editor, e Cancelar volta à lista |
| Importar / "importe um arquivo .json" | Abre a importação; arquivo inválido → 03 |
| Soltar ou escolher um arquivo | Valida na hora; o arquivo pode ser substituído sem fechar o modal |
| Renomear | TODO: tela não descrita no material |
| Duplicar | Cria uma cópia do mundo |
| Exportar | Exporta o mundo em JSON; o mapa pode ser exportado como PNG em 1×, 2× ou 4× (o terreno é regerado na resolução maior, para impressão), com opção de incluir pins e rótulos |
| Excluir | Pede confirmação num modal; não pode ser desfeito (o histórico é do mundo). TODO: tela e texto do modal |
| Desfazer / Refazer (Ctrl+Z / Ctrl+Shift+Z) | Desfaz ou refaz mudanças em pins, estradas e parâmetros de geração |

## Regras

- Salvamento automático local do mundo ativo; não existe botão "Salvar".
- Salva só seed, parâmetros, pins e estradas; o terreno é regerado (RNF-5).
- Imagens enviadas ficam no IndexedDB como blobs.
- O JSON importado é validado por schema; um JSON exportado reimporta idêntico. As imagens enviadas
  vão embutidas no JSON (base64).
- Desfazer e refazer usam um histórico único por mundo.
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

Exportar (JSON e PNG), Renomear e o modal de confirmação de Excluir: sem mockup: segue o [design system](../design/design-system.md), e os prints são revistos no PR.

> Pendente: por quanto tempo e quantas versões antigas do gerador (`generatorVersion`) serão
> mantidas ([overview.md](../overview.md)).
