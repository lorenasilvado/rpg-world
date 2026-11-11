---
feature: F1
area: area:geracao
updated: 2026-11-11
---

# F1 · Geração de terreno e sidebar

Descreve como a feature funciona **hoje**. Planos e mudanças ficam nas issues; o PR que muda
o comportamento atualiza esta spec.

> Hoje existe o núcleo de elevação, clima, biomas, praias, hillshade, rios e lagos
> (`src/core/world/`), sem UI e ainda sem decoração; os rios ainda não são desenhados. O resto vem
> do material de design e do PRD.

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
| Neve | Proporção de picos nevados versus rochosos (não muda o campo gelado) | 40 |
| Tamanho do continente (avançado) | Ilhas × pangeia | 50 |
| Rugosidade da costa (avançado) | De costa lisa a recortada | 50 |
| Temperatura global (avançado) | Esquenta ou esfria o mundo todo: mais fria dá mais neve nas montanhas e campos gelados nas regiões frias; mais quente, menos neve e nenhum campo gelado | 50 |

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

  Valores de cada preset:

  | Preset | Oceano | Praias | Desertos | Florestas | Montanhas | Neve | Continente | Costa | Temperatura |
  |---|---|---|---|---|---|---|---|---|---|
  | Continente temperado | 45 | 30 | 15 | 35 | 30 | 40 | 50 | 50 | 50 |
  | Arquipélago | 66 | 55 | 8 | 45 | 22 | 15 | 8 | 72 | 64 |
  | Deserto árido | 32 | 25 | 62 | 10 | 34 | 12 | 74 | 45 | 85 |
  | Terras geladas | 48 | 12 | 4 | 42 | 52 | 85 | 58 | 62 | 15 |

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
| Sem WebGL2 | O navegador não tem WebGL2 (obrigatório pelo RNF-6) e o usuário abre um mundo | No lugar do editor, um aviso com os navegadores suportados. A Lista de mundos continua funcionando (ver [mundos.md](mundos.md)). TODO: texto do aviso |

> Pendente: o que acontece com o pin depois do aviso "N pins ficaram sobre a água" (fica onde
> está, é movido, oferece ação)?

## Ações

| Ação | Resultado |
|---|---|
| Arrastar um slider | Prévia 256² em tempo real: o mapa mostra cada resultado mais novo que o último exibido, e um resultado velho nunca substitui um novo |
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

- Ordem de classificação fixa, para que os sliders não briguem: água → lago → praia → montanha
  (rochosa ou nevada) → deserto ou floresta → campo. Cada etapa só recebe as células que as
  anteriores deixaram: montanha vale mais que bioma, e o percentual de desertos e florestas é
  medido sobre a terra firme sem montanhas (e sem os lagos e as praias, que vêm antes na ordem).
- Praia: a terra a até uma certa distância da água oceânica, medida em frações da largura do mapa
  (a mesma na prévia e no mapa final). Praias em 0 não tem praia; acima de 0, a faixa tem pelo
  menos uma célula.
- Montanha: as células mais altas da terra, por percentil da elevação, na quantidade do slider
  Montanhas. Neve: as montanhas mais frias, na proporção do slider Neve; com a Temperatura global
  em 50 a proporção é a do slider, abaixo dela há mais neve e acima, menos. Com Neve em 0 não há
  neve de montanha.
- Deserto: as células mais áridas da base (secas e quentes). Floresta: as mais úmidas do que
  sobrou. Campo: o resto; o campo mais alto é colina, e o campo abaixo de uma temperatura fixa de
  geada fica gelado. Como o campo vem por último, o campo gelado não muda o percentual de desertos
  e florestas.
- Neve de montanha e campo gelado são biomas distintos no campo gerado (`snow` e `frozenField`,
  [ADR 0007](../adr/0007-campo-gelado-bioma-proprio.md)): quem lê o campo os separa pelo bioma, sem
  recalcular limiares. O campo gelado é desenhado com os mesmos tons da neve e não tem decoração.
- Clima: a umidade vem de um ruído fixo pela seed. A temperatura cai com a distância do "equador"
  (a linha do meio do mapa) e com a altitude, e a Temperatura global soma o mesmo valor a todas as
  células. Por isso ela muda o mapa só onde há um limiar de temperatura: a neve das montanhas e o
  campo gelado.
- Hillshade: sombra pela inclinação, com luz do noroeste; a água não tem sombra.
- Desertos e florestas disputam a terra firme: a soma nunca passa de 100%.
- Sliders por percentual alvo (quantis): definir 30% de oceano resulta em 30% ± 2% de células
  oceânicas. O alvo vale com o Oceano de 5% a 95%: a borda do mapa é sempre água, inclusive em 0%.
  Lagos não contam como oceano.
- O ruído fica fixo pela seed. Os sete sliders de limiar (Oceano, Praias, Desertos, Florestas,
  Montanhas, Neve e Temperatura) só mudam limiares, não a elevação. Tamanho do continente e
  Rugosidade da costa mudam a elevação, mas só o peso com que as camadas de ruído da seed se combinam.
- Mesma seed + parâmetros + `generatorVersion` = mesmo mapa (RNF-4).
- Sliders e formulários navegáveis por teclado, com rótulos (RNF-8).
- O mapa é limitado: ilha ou continente com oceano em todas as bordas (fundo `#1F4E79` fora do
  mapa).
- O mapa tem rios e lagos, sem hidrologia e sem slider
  ([ADR 0008](../adr/0008-nascentes-na-terra-alta-e-depressoes-pequenas.md)):
  os rios nascem na terra alta e descem pelo gradiente até o mar ou um lago, e o lago ocupa a
  depressão grande onde a descida fica presa. O traçado não muda com os sete sliders de limiar:
  mexer no oceano só corta o rio na costa nova. Tamanho do continente e Rugosidade da costa mudam a
  elevação, e o traçado é refeito.
- Nascentes: até 24 por mapa, sorteadas pela seed na terra alta (os 6% mais altos do mapa, que com
  os sliders no padrão são a zona das montanhas), afastadas entre si. A zona é fixa, e não o bioma
  montanha, para o slider Montanhas não mudar os rios. A prévia e o mapa final sorteiam os mesmos
  pontos, então os rios ficam quase todos nos mesmos lugares.
- Descida: cada passo vai para a vizinha mais baixa das 8. Uma depressão pequena (menos de 0,1% do
  mapa debaixo da água) não vira lago: o rio a enche e segue pelo transbordo, ou termina no lago que
  ela encosta antes de transbordar. Se a saída fica acima da nascente, o rio não existe: ele nunca
  sobe acima de onde nasce. Uma depressão maior vira lago, até 0,4% do mapa, e o rio termina nele.
  Um rio que encontra outro vira afluente e termina no encontro. O lago abaixo do nível do mar é
  oceano; se o que sobra encosta no mar e fica abaixo do tamanho mínimo, volta a ser terra, e o rio
  que terminava nele segue pelo resto até o mar (ou até outro rio, como afluente). Se esse caminho
  passaria acima da nascente, o rio não existe.
- Rio é uma polilinha nos centros das células (de 0 a 1), da nascente até a primeira célula de mar
  ou de lago, ou até o encontro com outro rio. Lago é um bioma, com os tons da água rasa e sem
  sombra.
- Dicas de boas-vindas no primeiro acesso (sliders, toolbar, adicionar pin), que podem ser puladas.

## Critérios de aceite vigentes

IDs `AC-F1-NN`, em sequência. AC novo recebe o próximo número livre; AC removido sai da
lista e o número não volta a ser usado.

- AC-F1-01: o hash do pipeline completo, para a mesma seed, parâmetros e `generatorVersion`, é igual no Chrome, no Firefox e no WebKit
- AC-F1-02: com o Oceano em 30, o mapa tem 30% ± 2% de água oceânica, em várias seeds
- AC-F1-03: Desertos e Florestas atingem o percentual pedido, ± 2%, sobre a terra firme sem montanhas
- AC-F1-05: cada um dos 9 sliders muda o mapa de forma visível e na direção descrita na tabela de sliders
- AC-F1-06: o mapa tem oceano em todas as bordas, com qualquer valor dos sliders
- AC-F1-07: todo rio desce do ponto onde nasce até o mar ou um lago
- AC-F1-08: a decoração é posicionada por Poisson-disk conforme o bioma, é determinística e tem no máximo 5.000 ícones
- AC-F1-09: com o pipeline completo, a prévia 256² fica pronta em até 150 ms e o mapa 1024² em até 1,5 s, com no máximo 64 MB de dados do mundo
- AC-F1-10: durante o arrasto de um slider o mapa continua atualizando, e um resultado velho nunca substitui um novo
- AC-F1-11: ao soltar o slider, o mapa final 1024² substitui a prévia
- AC-F1-12: se a geração ou o worker falhar, aparece o toast de erro "Não foi possível gerar o mapa", com a ação "Tentar de novo"
- AC-F1-13: todos os sliders funcionam só com o teclado e têm rótulo
- AC-F1-14: Desertos + Florestas nunca passa de 100%: o outro slider recua sozinho e pisca
- AC-F1-15: sortear ou editar a seed regenera o mapa, e o botão copiar copia a seed
- AC-F1-16: escolher um preset aplica os valores dele; com "Deserto árido", mais de 50% da terra firme sem montanhas é deserto
- AC-F1-17: "Restaurar padrão" volta todos os parâmetros aos valores padrão
- AC-F1-18: a barra "Distribuição do mapa" mostra a porcentagem real de cada bioma e, durante a geração, "Gerando", com a prévia borrada
- AC-F1-19: o assistente cria o mundo com o nome, o preset e a seed escolhidos e mostra o mapa dele no editor
- AC-F1-20: sem WebGL2, um aviso com os navegadores suportados aparece no lugar do editor
- AC-F1-21: as seções da sidebar recolhem e abrem, e o painel recolhe e abre também pela tecla `[`
- AC-F1-22: o terreno é desenhado com a paleta posterizada, o contorno de costa, a água rasa e o hillshade do mockup aprovado
- AC-F1-23: o mapa tem a decoração completa do design system (hachura, ondas, pontilhado de areia, tufos, árvores redondas e dunas)
- AC-F1-24: mexer em Oceano, Praias, Desertos, Florestas, Montanhas, Neve ou Temperatura não muda a elevação gerada pela seed; só os limiares mudam. Tamanho do continente e Rugosidade da costa mudam a elevação só pelo peso com que as camadas de ruído da seed se combinam
- AC-F1-25: o campo gerado distingue a neve de montanha do campo gelado sem recalcular limiares, e o slider Neve só muda a neve das montanhas

## Pendências

> Pendente: qual o tamanho máximo de mapa desejado (1024² basta?)

Dicas de boas-vindas: sem mockup: segue o [design system](../design/design-system.md), e os prints são revistos no PR.
