---
feature: F1
area: area:geracao
updated: 2026-11-04
---

# F1 · Geração de terreno e sidebar

Descreve como a feature funciona **hoje**. Planos e mudanças ficam nas issues; o PR que muda
o comportamento atualiza esta spec.

> Nada implementado ainda: o conteúdo abaixo vem do material de design e do PRD.

## Resumo

Gera um mapa determinístico a partir de uma seed, controlado por sliders de bioma num painel
esquerdo ("Gerar mundo"). Mexer num slider mostra uma prévia em baixa resolução em tempo real; ao
soltar, o mapa é gerado em resolução final. Inclui o assistente de novo mundo. Pipeline e modelo
de dados em [overview.md](../overview.md).

## Rotas/Telas

| Rota ou tela | O que mostra | Referência |
|---|---|---|
| E1 · Editor | Sidebar "Gerar mundo" com seed, presets e sliders; mapa em tela cheia | `../assets/design/editor-claro.png`, `../assets/design/editor-escuro.png` |
| E3 · Editor gerando | Prévia borrada durante a geração; slider que recuou pisca | `../assets/design/editor-gerando-claro.png`, `../assets/design/editor-gerando-escuro.png` |
| 04 · Assistente de novo mundo | Modal: nome, ponto de partida (preset) e seed opcional | `../assets/design/assistente-claro.png`, `../assets/design/assistente-escuro.png` |

### E1 · Sidebar "Gerar mundo"

- Painel esquerdo de 320 px, recolhível (48 px recolhido).
- Nome do mundo e status de salvamento ("Salvo").
- Seed com botões sortear (`dices`) e copiar (`copy`); a seed fica visível e copiável. Não há
  botão "Gerar": editar ou sortear a seed regenera o mapa.
- Seções recolhíveis: Presets, Terreno (Oceano 45%, Praias 30%), Biomas (Desertos 15%,
  Florestas 35%), Relevo (Montanhas 30%, Neve 40%) e Avançado (Tamanho do continente, Rugosidade
  da costa, Temperatura global). Cada controle tem ícone, amostra de cor, porcentagem e slider. A
  tela E1 mostra só as quatro primeiras seções (sem Neve).
- Rodapé: barra "Distribuição do mapa" com a porcentagem real de cada bioma no mapa gerado,
  legenda e botão "Restaurar padrão".

### Sliders (PRD RF-1)

Cada slider vai de 0 a 100%:

| Slider | Efeito | Padrão |
|---|---|---|
| Oceano | Fração do mapa coberta por água | 45 |
| Praias | Largura da faixa costeira de areia | 30 |
| Desertos | Fração da terra firme que vira deserto (mais aridez desloca o clima) | 15 |
| Florestas | Fração da terra firme coberta por mata | 35 |
| Montanhas | Quantidade de cordilheiras | 30 |
| Neve | Proporção de picos nevados versus rochosos | 40 |
| Tamanho do continente (avançado) | Ilhas × pangeia | 50 |
| Rugosidade da costa (avançado) | | 50 |
| Temperatura global (avançado) | | 50 |

Neve fica na seção Relevo, junto de Montanhas. Os controles avançados ficam na seção recolhível
"Avançado".

### 04 · Assistente de novo mundo

- Modal de 800 px: título "Novo mundo" e subtítulo "Dê um nome e escolha um ponto de partida. Tudo
  pode ser ajustado depois no editor."
- Campo "Nome do mundo".
- "Ponto de partida": 4 presets em cartões com miniatura, nome e descrição; o selecionado tem borda
  âmbar e marca de check. As miniaturas usam a seed atual.

  | Preset | Descrição |
  |---|---|
  | Continente temperado | Um grande continente de campos e florestas |
  | Arquipélago | Dezenas de ilhas e mares rasos |
  | Deserto árido | Desertos vastos e serras secas |
  | Terras geladas | Cordilheiras altas e neve eterna |

  As telas (`assistente-*.png`) ainda mostram "Reinos áridos" e "Norte gelado": valem os nomes
  desta tabela.

- Seção "Avançado": Seed (opcional) com botões sortear e copiar; nota "A mesma seed sempre gera o
  mesmo mapa."
- Botões Cancelar e "Criar mundo →" (primário).

## Estados

| Estado | Quando acontece | O que o usuário vê |
|---|---|---|
| Carregando / gerando | Um slider muda | "Distribuição do mapa" mostra "Gerando" e os valores novos; o mapa exibe uma prévia borrada (`blur(3px)` → nítido em 260 ms) até a geração terminar; pins e rotas continuam nítidos; o minimapa acompanha a prévia |
| Slider recuou | Desertos + Florestas passaria de 100% | O outro slider recua sozinho e pisca (flash âmbar de 700 ms). Ex.: Desertos de 15% para 70% → Florestas de 35% para 30% |
| Erro | A geração falha | Toast de erro "Não foi possível gerar o mapa", com a ação "Tentar de novo" |
| Aviso | Pins ficam sobre a água depois de regerar | Toast "2 pins ficaram sobre a água" |
| Vazio | — | n/a: o editor sempre abre com um mundo |

> Pendente: o que o usuário vê quando o navegador não tem WebGL2 (obrigatório pelo RNF-6)?

> Pendente: o que acontece com o pin depois do aviso "N pins ficaram sobre a água" (fica onde
> está, é movido, oferece ação)?

## Ações

| Ação | Resultado |
|---|---|
| Arrastar um slider | Prévia 256² em tempo real; cada pedido novo cancela o anterior |
| Soltar o slider | Gera o mapa final em 1024² |
| Sortear seed | Seed aleatória e mapa novo |
| Editar a seed | Regenera o mapa com a seed nova |
| Copiar seed | Copia a seed |
| Escolher preset | Aplica os parâmetros do preset |
| "Restaurar padrão" | Volta os parâmetros ao padrão |
| Recolher / abrir painel (`[`) | Sidebar passa a 48 px / volta a 320 px |
| "Criar mundo →" no assistente | Abre o editor (E1) com o mundo novo |
| Cancelar no assistente | TODO: volta à tela de origem (não descrito no material) |

## Regras

- Ordem de classificação fixa, para que os sliders não briguem: água → praia → montanha (rochosa ou
  nevada) → deserto ou floresta → campo. Montanha vale mais que bioma; o percentual de desertos e
  florestas é medido sobre a terra firme sem montanhas.
- Desertos e florestas disputam a terra firme: a soma nunca passa de 100%.
- Sliders por percentual alvo (quantis): definir 30% de oceano resulta em 30% ± 2% de células
  oceânicas.
- O ruído fica fixo pela seed; só os limiares mudam quando um slider se mexe.
- Mesma seed + parâmetros + `generatorVersion` = mesmo mapa (RNF-4).
- Sliders e formulários navegáveis por teclado, com rótulos (RNF-8).
- O mapa é limitado: ilha ou continente com oceano em todas as bordas (fundo `#1F4E79` fora do
  mapa).
- O mapa tem rios e lagos na v1, sem hidrologia (o PRD sugere rios por descida de gradiente).
- Dicas de boas-vindas no primeiro acesso (sliders, toolbar, adicionar pin), que podem ser puladas.

## Critérios de aceite vigentes

IDs `AC-F1-NN`, em sequência. AC novo recebe o próximo número livre; AC removido sai da
lista e o número não volta a ser usado.

Nenhum ainda: os ACs nascem no `/planejar M<n>`.

## Pendências

> Pendente: valores de cada preset (no protótipo, `rpg-kit.js → PRESETS`, que não veio no
> material).

> Pendente: como os rios e lagos são gerados e controlados (há slider? quantos? onde nascem?). O
> material não descreve.

> Pendente: qual o tamanho máximo de mapa desejado (1024² basta?)

> Pendente: telas das dicas de boas-vindas (não há tela no material).
