---
feature: F4
area: <a definir>
updated: 2026-11-04
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

## Estados

| Estado | Quando acontece | O que o usuário vê |
|---|---|---|
| Vazio | Nenhum mundo salvo (primeiro acesso) | 02 · Lista vazia |
| Com mundos | Há mundos salvos | 01 · Lista de mundos |
| Erro ao importar | O arquivo não é um mundo válido | 03 · Erro ao importar |
| Salvando | Mudança no mundo ativo | Indicador "Salvando…" (`loader-circle` girando) |
| Salvo | Salvamento concluído | Indicador "Salvo" (`cloud`, verde) |
| Erro ao salvar | O salvamento falha | Indicador "Erro ao salvar" (`cloud-off`, vermelho) |
| Carregando | Lista sendo lida do IndexedDB | TODO: não descrito no material |

> Pendente: o que o usuário pode fazer depois de "Erro ao salvar" (tentar de novo, exportar)?

## Ações

| Ação | Resultado |
|---|---|
| Clicar num cartão | Abre o mundo no editor (E1) |
| Novo mundo / "Criar meu primeiro mundo" | Abre o assistente (04, ver [geracao-terreno.md](geracao-terreno.md)) |
| Importar / "importe um arquivo .json" | Abre a importação; arquivo inválido → 03 |
| Soltar ou escolher um arquivo | Valida na hora; o arquivo pode ser substituído sem fechar o modal |
| Renomear | TODO: tela não descrita no material |
| Duplicar | Cria uma cópia do mundo |
| Exportar | Exporta o mundo em JSON; o mapa pode ser exportado como PNG em 1×, 2× ou 4× (o terreno é regerado na resolução maior, para impressão), com opção de incluir pins e rótulos |
| Excluir | TODO: confirmação não descrita no material |
| Desfazer / Refazer (Ctrl+Z / Ctrl+Shift+Z) | Desfaz ou refaz mudanças em pins, estradas e parâmetros de geração |

## Regras

- Salvamento automático local do mundo ativo; não existe botão "Salvar".
- Salva só seed, parâmetros, pins e estradas; o terreno é regerado (RNF-5).
- Imagens enviadas ficam no IndexedDB como blobs.
- O JSON importado é validado por schema; um JSON exportado reimporta idêntico.
- Desfazer e refazer usam um histórico único por mundo.
- O mundo guarda `generatorVersion`, para ser regerado igual.

## Critérios de aceite vigentes

IDs `AC-F4-NN`, em sequência. AC novo recebe o próximo número livre; AC removido sai da
lista e o número não volta a ser usado.

Nenhum ainda: os ACs nascem no `/planejar M<n>`.

## Pendências

> Pendente: telas de Exportar (JSON e PNG), Renomear e confirmação de Excluir (o design system cita
> um modal "Exportar", mas não há tela no material).

> Pendente: outros motivos de recusa na importação, além de "falta o terreno", e o texto de cada um.
