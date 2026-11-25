---
feature: F1
area: area:geracao
updated: 2026-11-25
---

# F1 · Geração de terreno e sidebar

Descreve como a feature funciona **hoje**. Planos e mudanças ficam nas issues; o PR que muda
o comportamento atualiza esta spec.

> Hoje existe o núcleo de elevação, clima, biomas, praias, hillshade, rios, lagos e oásis
> (`src/core/world/`) e da decoração (`src/core/decor/`), o worker de geração com o cache do ruído
> da seed e o `worldStore` com a prévia durante o arrasto e o mapa final ao soltar. O editor gera o
> mapa final ao abrir, desenha o terreno (com a costa, a água rasa, o hillshade, os rios e os lagos)
> e mostra o toast de erro se a geração ou o worker falhar, e o aviso quando o mapa regerado deixa pins
> sobre a água. A sidebar tem as seções Seed, Presets,
> Terreno, Biomas, Relevo e Avançado com os 9 sliders, o rodapé com "Restaurar padrão", e recolhe
> a 48 px; o rodapé tem a barra "Distribuição do mapa", e o mapa fica borrado durante a geração.
> Sem WebGL2, o aviso toma o lugar do editor. O app abre na Lista de mundos, que abre o editor de
> um mundo e o assistente de novo mundo (ver [mundos.md](mundos.md)). A barra da sidebar mostra o
> logo, que volta à lista, o nome do mundo e, abaixo dele, o status de salvamento. Os cartões de
> preset da sidebar não têm miniatura (os do assistente
> têm). A câmera e os ícones de decoração estão em [navegacao.md](navegacao.md). O resto vem do
> material de design e do PRD.

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
- O logo (bússola) é o botão "Voltar à lista de mundos" (ver [mundos.md](mundos.md)).
- Nome do mundo, em Cinzel, cortado com reticências se não couber; recolhida a 48 px, a barra
  mostra só o logo. Abaixo
  do nome, o status de salvamento: "Salvando…", "Salvo" ou "Erro ao salvar" (ver
  [mundos.md](mundos.md)).
- Seed com botões sortear (`dices`) e copiar (`copy`); a seed fica visível e copiável, em
  JetBrains Mono. Não há botão "Gerar": editar a seed regenera o mapa final 400 ms depois da
  última tecla, ou já no Enter ou ao sair do campo. A seed vale sem os espaços das pontas; uma seed
  vazia não gera nada, e ao sair do campo ele volta para a seed atual. Se a seed muda por fora
  durante a pausa, o texto digitado é descartado. Sortear dá uma seed no formato "valdora-7f3a" (uma palavra e 4
  dígitos hexadecimais) e regenera o mapa. Copiar põe a seed na área de transferência e troca o
  ícone por um check por 1,5 s, contados de novo a cada cópia (o leitor de tela ouve "Seed copiada"); sem acesso à área de
  transferência, a seed fica selecionada no campo.
- Abaixo de 768 px, o campo da seed tem fonte de 16 px (no desktop, 13 px), para o iOS não
  aproximar a página ao focá-lo.
- Presets: os 4 presets do assistente em cartões de duas colunas, com o nome e a descrição.
  Escolher um aplica os 9 valores dele (a seed fica) e gera o mapa final. O cartão do preset cujos
  valores são os dos sliders agora tem a borda âmbar e o check; mexer num slider tira a marca. No
  hover, o cartão escurece o fundo, sem a borda âmbar.
- Seções recolhíveis: Seed, Presets, Terreno (Oceano 45%, Praias 30%), Biomas (Desertos 15%,
  Florestas 35%), Relevo (Montanhas 30%, Neve 40%) e Avançado (Tamanho do continente, Rugosidade
  da costa, Temperatura global). Cada controle tem ícone, rótulo, amostra de cor (só nos seis de
  bioma, no tom base do bioma na paleta do mapa), porcentagem e slider. A tela E1 mostra só as
  quatro primeiras seções (sem Neve). O cabeçalho da seção abre e fecha o conteúdo; ao abrir o
  editor, Seed, Terreno, Biomas e Relevo estão abertas e Presets e Avançado, fechadas.
- Slider: trilho de 6 px, preenchimento âmbar e thumb de 18 px; no hover, halo âmbar; durante o
  arrasto, thumb âmbar maior e balão com o valor. Pelo teclado: setas mudam 1, Shift + setas e
  PageUp/PageDown mudam 10, Home e End vão a 0 e 100.
- Recolher: o botão ao lado de "Gerar mundo" (ou a tecla `[`) recolhe o painel a 48 px, um trilho
  com o logo, o botão de abrir e um ícone por seção; o ícone abre o painel com aquela seção aberta.
  O mapa passa a caber na área livre maior, com o mesmo centro e zoom relativo. A tecla `[` não vale
  com o foco num campo de texto ou dentro do assistente de novo mundo nem com Ctrl, Alt ou Meta. Abaixo de 768 px não há botão de
  recolher: a tecla `[` abre e fecha o painel sobreposto.
- Rodapé, fixo abaixo das seções: barra "Distribuição do mapa" com a porcentagem real de cada
  bioma no mapa exibido (contada célula a célula), legenda e botão "Restaurar padrão" (`rotate-ccw`), que volta os 9
  parâmetros ao padrão (a seed fica) e gera o mapa final; com eles já no padrão, não faz nada.
  A barra tem um segmento por bioma presente, na largura da fração dele, na cor base do bioma e
  com o nome e a porcentagem no título (e, para o leitor de tela, a lista inteira no rótulo da
  barra). Um bioma presente que arredonda para 0% aparece como "<1%". Um fio separa os segmentos,
  e a amostra de cor da legenda tem contorno (os tons claros, como a Neve, ficam visíveis sobre o
  papel). A legenda mostra o nome e a porcentagem arredondada dos biomas com 1,5% ou mais. Os
  nomes: Oceano, Água rasa, Praia, Campo, Floresta, Deserto, Colina, Montanha, Neve, Campo gelado
  e Lago.

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

- Abre sobre o editor ao carregar o app, com o mundo padrão gerando por trás (sem WebGL2, não abre:
  o aviso toma o lugar do editor).
- Modal de 800 px (no celular, a largura da tela menos 16 px de cada lado; o conteúdo rola e os
  botões ficam fixos embaixo): título "Novo mundo", subtítulo "Dê um nome e escolha um ponto de
  partida. Tudo pode ser ajustado depois no editor." e o botão fechar (`x`).
- Campo "Nome do mundo", vazio e com o foco ao abrir. O nome vale sem os espaços das pontas e é
  obrigatório: vazio, "Criar mundo" fica desabilitado. Enter no campo cria o mundo.
- "Ponto de partida": 4 presets em cartões com miniatura, nome e descrição; o selecionado tem borda
  âmbar e marca de check. Ao abrir, o selecionado é "Continente temperado". As miniaturas são o
  terreno do preset com a seed do assistente, em baixa resolução (128²), geradas num worker só delas,
  um preset por vez; trocar a seed gera de novo 300 ms depois da última mudança, e as miniaturas
  anteriores ficam até as novas chegarem. Antes da primeira chegar, ou se o worker falhar, o cartão
  mostra o fundo do mar no lugar da miniatura.

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

- Seção "Avançado", aberta ao abrir o assistente e recolhível: Seed (opcional) com botões sortear e
  copiar; nota "A mesma seed sempre gera o mesmo mapa." A seed começa sorteada (formato
  "valdora-7f3a") e vale sem os espaços das pontas; vazia, vale a sorteada ao abrir.
- Botões Cancelar e "Criar mundo →" (primário). Cancelar, o `x` e o Esc fecham sem mudar o mundo; um
  clique fora do modal não fecha.
- Abaixo de 768 px, o nome do mundo e a seed têm fonte de 16 px (no desktop, 15 e 14 px), para o
  iOS não aproximar a página ao focar um deles.

## Estados

| Estado | Quando acontece | O que o usuário vê |
|---|---|---|
| Carregando / gerando | Um slider, a seed ou um preset muda, ou o editor abre | "Distribuição do mapa" mostra "Gerando" (com o ícone girando) e os valores do mapa exibido, que durante o arrasto são os da prévia; o terreno e a decoração do mapa ficam borrados (3 px) enquanto o pedido mais novo não chega ou o mapa exibido é a prévia, e ficam nítidos em 260 ms quando o mapa final chega; o desfoque vale só para o terreno e a decoração, e o que fica acima deles (pins e rotas) continua nítido; com movimento reduzido, o mapa borra e fica nítido na hora, e o ícone de "Gerando" não gira; o minimapa acompanha a prévia |
| Slider recuou | Desertos + Florestas passaria de 100% | O outro slider recua sozinho e pisca (flash âmbar de 700 ms). Ex.: Desertos de 15% para 70% → Florestas de 35% para 30% |
| Erro | A geração do pedido mais novo falha, ou o worker de geração falha (não carrega, por exemplo) | Toast de erro "Não foi possível gerar o mapa", no canto inferior direito do mapa, logo acima do controle de zoom (com área livre abaixo de 566 px, como no celular e no tablet com a sidebar aberta, na largura da área e acima do minimapa aberto), com a ação "Tentar de novo", que gera o mapa final de novo (num worker novo, se o anterior falhou) e fecha o toast |
| Aviso | Um mapa final regerado (não o primeiro, ao abrir o mundo; nem a prévia do arrasto) deixa pins em célula de oceano (fundo ou raso) ou de lago | Toast "2 pins ficaram sobre a água" (com um pin, "1 pin ficou sobre a água"), no lugar dos toasts, acima dos outros à vista, com a ação "Mostrar", que centraliza a câmera no primeiro deles (na ordem da lista, com o zoom do Centralizar do drawer), fecha o toast e leva o foco do teclado ao mapa; os pins ficam onde estão. Some sozinho depois de 6 s, e cada mapa final novo o refaz (ou o fecha, sem pins na água) |
| Vazio | — | n/a: o editor sempre abre com um mundo |
| Sem WebGL2 | O navegador não tem WebGL2 (obrigatório pelo RNF-6) e o usuário abre um mundo | No lugar do editor, um aviso "Este navegador não tem WebGL2": "O editor desenha o mapa com WebGL2, que este navegador não oferece ou está desligado. Abra o RPG World Builder na versão atual de um destes navegadores:", a lista Google Chrome, Microsoft Edge, Mozilla Firefox e Safari, e "Se você já usa um deles, atualize-o e confira se a aceleração por hardware está ligada nas configurações." O aviso tem o botão de tema claro e escuro do editor. O mapa não é gerado. A Lista de mundos continua funcionando (ver [mundos.md](mundos.md)) |

## Ações

| Ação | Resultado |
|---|---|
| Arrastar um slider | Prévia 256² em tempo real: o mapa mostra cada resultado mais novo que o último exibido, e um resultado velho nunca substitui um novo |
| Soltar o slider | Gera o mapa final em 1024² |
| Mudar um slider pelo teclado | Enquanto a tecla está pressionada (e se repete), prévia 256² a cada valor novo; ao soltar a tecla (ou se o foco sai), gera o mapa final em 1024² |
| Desertos + Florestas passaria de 100% | O outro slider recua até a soma dar 100 e pisca em âmbar por 700 ms (também com movimento reduzido: é só cor); num arrasto, os recuos seguintes durante esses 700 ms não reiniciam o flash, e um recuo depois deles pisca de novo |
| Abrir ou fechar uma seção | Mostra ou esconde os sliders dela |
| Sortear seed | Seed aleatória e mapa final novo |
| Editar a seed | Regenera o mapa final com a seed nova (400 ms depois da última tecla, ou no Enter ou ao sair do campo); vazia, não gera |
| Copiar seed | Copia a seed e mostra o check por 1,5 s |
| Escolher preset | Aplica os 9 parâmetros do preset, mantém a seed e gera o mapa final |
| "Restaurar padrão" | Volta os 9 parâmetros ao padrão, mantém a seed e gera o mapa final (já no padrão, não faz nada) |
| Recolher / abrir painel (`[`) | Sidebar passa a 48 px / volta a 320 px (abaixo de 768 px, a tecla abre e fecha o painel sobreposto) |
| "Criar mundo →" no assistente | Cria um mundo com o nome, a seed e os 9 parâmetros do assistente (os do preset escolhido), salva o mundo, fecha o assistente e o abre no editor (E1), que gera o mapa final (ver [mundos.md](mundos.md)) |
| Cancelar, `x` ou Esc no assistente | Fecha o assistente e volta à Lista de mundos, sem criar nada |

## Regras

- Ordem de classificação fixa, para que os sliders não briguem: água → lago → praia → montanha
  (rochosa ou nevada) → deserto ou floresta → campo → oásis. Cada etapa só recebe as células que as
  anteriores deixaram: montanha vale mais que bioma, e o percentual de desertos e florestas é
  medido sobre a terra firme sem montanhas (e sem os lagos e as praias, que vêm antes na ordem).
- Oceano e água interior ([ADR 0009](../adr/0009-agua-interior-como-lago-e-deserto-com-oasis.md)):
  só a água ligada à borda do mapa (pelas 8 vizinhas) é oceano. A água abaixo do nível do mar sem
  ligação com a borda é lago, não oceano; um grupo dela menor que o lago mínimo dos rios (0,1% do
  mapa) volta a ser terra. O nível do mar é escolhido para o oceano ligado à borda ficar no alvo do
  slider Oceano.
- Praia: a terra a até uma certa distância do oceano, medida em frações da largura do mapa
  (a mesma na prévia e no mapa final). Praias em 0 não tem praia; acima de 0, a faixa tem pelo
  menos uma célula. A margem de lago nunca é praia, com qualquer valor de Praias: a terra que
  encosta num lago (também na diagonal), ou que fica mais perto de um lago que do oceano, não é
  praia.
- Montanha: as células mais altas da terra, por percentil da elevação, na quantidade do slider
  Montanhas. Neve: as montanhas mais frias, na proporção do slider Neve; com a Temperatura global
  em 50 a proporção é a do slider, abaixo dela há mais neve e acima, menos. Com Neve em 0 não há
  neve de montanha.
- Deserto: as células mais áridas da base (secas e quentes), longe dos rios e dos lagos. O deserto
  recua da água doce: a terra a até 0,6% da largura do mapa (pelo menos as vizinhas, também na
  diagonal) de um rio ou de um lago nunca é deserto, e fica para a floresta ou o campo. O deserto
  pedido sai do resto da base; com Desertos perto de 100, quando esse resto acaba, o deserto fica
  abaixo do pedido. Floresta: as mais úmidas do que sobrou.
- Oásis: a única água dentro do deserto. É um lago redondo de 0,8% da largura do mapa de raio, com
  um anel de campo até 1,6% e 2 ou 3 palmeiras no anel (nunca embaixo do lago). Os centros são
  sorteados pela seed em coordenadas de 0 a 1; um ponto só vira oásis se o disco de 2,2% em volta
  dele é todo deserto, a pelo menos 12% da largura de outro oásis. O mapa tem um oásis para cada 2%
  do mapa em deserto, até 6. A prévia e o mapa final sorteiam os mesmos pontos, mas o aceite olha o
  deserto de cada tamanho, que muda um pouco: os oásis são quase sempre os mesmos (cerca de 80%), e
  ao soltar o slider um oásis pode sumir, aparecer ou trocar de lugar. O oásis vem depois
  do deserto: ele tira do deserto as células do lago e do anel. Campo: o resto; o campo mais alto é colina, e o campo abaixo de uma temperatura fixa de
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
  Lagos não contam como oceano, nem a água interior. Uma bacia que fica cheia exatamente no nível
  do mar entra inteira no oceano ou fica inteira de fora, o que ficar mais perto do alvo.
- Geração no worker: o ruído da seed fica guardado entre os pedidos. Trocar a seed refaz tudo;
  Tamanho do continente ou Rugosidade da costa refazem a elevação, os rios e a classificação; os
  outros sete sliders refazem só a classificação. O mapa sai igual ao da geração do zero.
  O RGBA da textura do terreno também é montado no worker, depois da geração, e vai para a thread
  principal por transferência, junto com o campo: a thread principal só o envia para a GPU. A
  medição (`/bench.html`) mostra o tempo dele em cada tamanho (coluna Textura), e a memória do
  mundo conta o RGBA.
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
  Um rio que encontra outro vira afluente e termina no encontro. A parte do lago abaixo do nível do
  mar que tem ligação com a borda é oceano; se o que sobra encosta no mar e fica abaixo do tamanho
  mínimo, volta a ser terra, e o rio que terminava nele segue pelo resto até o mar (ou até outro
  rio, como afluente). Se esse caminho passaria acima da nascente, o rio não existe.
- Rio é uma polilinha nos centros das células (de 0 a 1), da nascente até a primeira célula de mar
  ou de lago, ou até o encontro com outro rio. Lago é um bioma (o dos rios, a água interior e o
  oásis), com os tons da água rasa e sem sombra.
- Decoração: o núcleo entrega as posições e os tipos dos ícones, e o renderer só desenha o que
  recebe. As posições vêm de uma amostra de Poisson-disk do mapa inteiro, sorteada pela seed, com
  distância mínima de 1,3% da largura entre dois ícones; cada ponto fica com um ícone na chance do
  bioma da sua célula. A amostra não depende do tamanho nem dos sliders: a prévia e o mapa final
  têm os ícones quase todos nos mesmos lugares, e um slider só muda quais pontos ganham ícone.
  O mapa tem no máximo 5.000 ícones (com os sliders no padrão, perto de 900); acima disso, fica
  uma fração uniforme deles. Os ícones saem de cima para baixo, a ordem de desenho.

  | Bioma | Ícone | Chance por ponto |
  |---|---|---|
  | Oceano profundo | Onda | 3% |
  | Praia | Pontilhado de areia | 5% |
  | Campo | Tufo | 16% |
  | Floresta | Árvore | 80% |
  | Deserto | Cacto / duna | 8% / 26% |
  | Colina | Colina | 42% |
  | Montanha rochosa | Montanha | 70% |
  | Neve de montanha | Montanha nevada | 75% |

  Água rasa, lago e campo gelado não têm decoração. As palmeiras não saem da amostra: cada oásis
  tem as suas 2 ou 3 no anel, e nenhum ponto da amostra a até 2,6% da largura do centro do oásis
  ganha ícone (o lago e o anel ficam limpos, e as palmeiras guardam a distância mínima dos outros
  ícones).
- Desenho dos ícones (`src/render/style/decorInk.ts`): estilo Medieval do design system, a
  nanquim e com o traço levemente trêmulo, na escala do editor do protótipo. A montanha e a
  montanha nevada têm uma face iluminada e uma sombreada, com hachura na sombreada e contorno
  `#3A2A1C` aberto na base. Os demais usam a tinta `#1C1511`: traço de onda no oceano profundo,
  pontilhado de areia na praia, tufos no campo, um grupo de 2 ou 3 árvores na floresta (pinheiros
  e uma árvore redonda), dunas a traço e cactos no deserto, colinas a traço com hachura na encosta e,
  no oásis, palmeiras de tronco curvo com anéis a traço e copa de cinco folhas no verde das árvores.
  Cada ícone tem 4 variações, escolhidas pela posição do ponto, então a prévia e o mapa final
  mostram o mesmo desenho no mesmo ponto. Na montanha, na montanha nevada e no cacto, a variação
  muda o tamanho e a forma; na floresta, também quantas árvores; na areia, onde caem os pontos.
  Na palmeira, a inclinação e a altura. Na onda, no tufo, na duna e na colina, só o tremido do traço
  muda. Os pontos de areia são maiores
  e mais escuros que no protótipo, que mal apareciam na faixa estreita de praia.
- Desenho do terreno (`src/render/`): o renderer só lê o campo e o RGBA do `worldStore` e, a cada
  campo novo, troca uma textura única na GPU, com uma célula por pixel. Cada célula recebe um dos 3 tons
  do seu bioma (paleta posterizada): nas colinas, montanhas e neve, o tom vem do hillshade; nos
  outros biomas da terra, de manchas de baixa frequência sorteadas pela seed, com um pouco de
  hillshade. A água encostada na terra (mar e lagos) é pintada com o traço da costa (`#163A5C`, 2
  células no mapa 1024²). A água rasa e o lago clareiam logo depois do traço da costa (uma faixa de luz
  medida a partir de onde o traço termina, para ele não a esconder), e o oceano profundo clareia
  junto da água rasa e escurece longe dela e perto da borda do mapa: nas últimas 48 células (mapa
  1024²), as faixas se curvam e terminam antes da borda, que fica no tom de sombra, a cor do fundo
  fora do mapa (sem corte reto, com qualquer zoom). A praia tem o tom de luz só junto da água. Os rios são
  pintados na textura, sobre a terra: `#6BB8DD`, sem contorno. Nada do rio é pintado sobre
  montanha rochosa ou neve: ele aparece a partir do pé da montanha, mais fino ali. Na foz, nas
  últimas 14 células (mapa 1024²), o rio alarga aos poucos até o dobro da largura e a cor passa
  suavemente para a da água do mar ou do lago em que entra (o tom que aparece em volta da foz,
  depois do traço da costa); ele abre o traço da costa e se junta à
  água sem degrau nem linha. O afluente, que termina em outro rio, não alarga. As distâncias são frações da largura do mapa, então a
  prévia tem o mesmo desenho, com menos detalhe.
- O editor abre com o mapa inteiro na área livre, centrado: a partir de 768 px, entre a
  sidebar e a borda direita (sem pin selecionado, o drawer fica fora da tela); abaixo disso, na tela toda. Fora do mapa fica o fundo `#1F4E79`. Pan e zoom
  estão em [navegacao.md](navegacao.md).
- Dicas de boas-vindas no primeiro acesso ao editor (sliders, toolbar, adicionar pin), que podem ser
  puladas e não voltam a aparecer depois de vistas ou puladas.

## Critérios de aceite vigentes

IDs `AC-F1-NN`, em sequência. AC novo recebe o próximo número livre; AC removido sai da
lista e o número não volta a ser usado.

- AC-F1-01: o hash do pipeline completo, para a mesma seed, parâmetros e `generatorVersion`, é igual no Chrome, no Firefox e no WebKit
- AC-F1-02: com o Oceano em 30, o mapa tem 30% ± 2% de água oceânica, em várias seeds
- AC-F1-03: Desertos e Florestas atingem o percentual pedido, ± 2%, sobre a terra firme sem montanhas; o deserto só fica abaixo do pedido quando acaba a terra longe dos rios e dos lagos (AC-F1-28)
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
- AC-F1-26: nenhum trecho de rio é desenhado sobre montanha rochosa ou neve: o rio aparece a partir do pé da montanha
- AC-F1-27: na foz, o rio alarga aos poucos e a cor passa suavemente para a da água do mar ou do lago, sem degrau nem linha
- AC-F1-28: dentro do deserto, a única água é o oásis (lago pequeno com anel de vegetação e palmeiras, sorteado pela seed); o deserto recua dos rios e dos lagos, que ficam cercados de campo ou floresta
- AC-F1-29: a água abaixo do nível do mar sem ligação com a borda do mapa é lago, não oceano, e nenhuma margem de lago tem praia, com qualquer valor do slider Praias
- AC-F1-30: quando o mapa regerado deixa pins sobre a água, aparece o toast "N pins ficaram sobre a água" com a ação "Mostrar", que centraliza a câmera no primeiro deles; nenhum pin é movido
- AC-F1-31: no primeiro acesso ao editor, as dicas de boas-vindas apresentam os sliders, a toolbar e o adicionar pin; podem ser puladas e não voltam depois de vistas ou puladas

## Pendências

> Pendente: qual o tamanho máximo de mapa desejado (1024² basta?)

Dicas de boas-vindas: sem mockup: segue o [design system](../design/design-system.md), e os prints são revistos no PR.
