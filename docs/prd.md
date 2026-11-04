---
status: draft        # draft | accepted
updated: 2026-11-04
---

# PRD

## Visão

O RPG World Builder é uma aplicação web, feita do zero, para gerar e explorar mundos fictícios de
RPG num mapa cartunesco, com pins editáveis e estradas. A v1 cobre um mapa regional/continental 2D;
a arquitetura já separa geração e renderização para permitir um planeta 3D esférico depois.

**Problema:** hoje o mestre escolhe entre gerar um mapa procedural rápido mas com cara técnica, ou
desenhar à mão um mapa bonito em ferramentas que exigem horas. Nenhum dos dois serve bem como
caderno de campanha, onde cada cidade guarda suas anotações.

**Alternativas e diferencial:** o Azgaar's Fantasy Map Generator gera mundos no navegador de graça,
mas com visual de atlas técnico e muitas opções. Inkarnate e Wonderdraft fazem mapas bonitos, mas
desenhados à mão. O RPG World Builder aposta no meio-termo: mapa cartoon gerado em segundos com
poucos sliders, e pins que funcionam como fichas de campanha.

### Objetivos da v1

1. Gerar um mapa determinístico a partir de uma seed, controlado por sliders de bioma (oceano,
   praias, desertos, florestas, montanhas rochosas e nevadas).
2. Navegar com pan e zoom fluidos a 60 fps em notebooks comuns.
3. Posicionar pins com ícones ou imagens próprias e editar seus detalhes num drawer lateral.
4. Salvar e reabrir mundos localmente; exportar e importar em JSON.
5. (Desejável) Desenhar ou gerar estradas entre pins.

## Público

Mestres de RPG e worldbuilders que querem um mapa bonito em minutos e um lugar para anotar
cidades, NPCs e pontos de interesse.

## Escopo (MoSCoW)

### Must
- F1 · Geração de terreno e sidebar
- F2 · Câmera e navegação
- F3 · Pins e drawer
- F4 · Mundos e persistência

### Should
- TODO: o material marca como "desejável" o F5 (Estradas e rotas) e a ferramenta "Medir
  distância" (F2), sem dizer se é Should ou Could.

### Could
- TODO: ver Should.

### Won't (nesta versão)
- Planeta 3D (só a preparação arquitetural).
- Edição manual do terreno com pincel.
- Colaboração em tempo real e backend.
- Simulação de civilizações, clima dinâmico ou rios hidrológicos.

## Features

IDs estáveis: `F1`, `F2`… nunca são renomeados nem reaproveitados (feature removida sai da
tabela e o ID fica vago). A coluna Área vira a label `area:*` (criada pelo `bootstrap.sh`).

| ID | Feature | Prioridade | Spec | Área |
|---|---|---|---|---|
| F1 | Geração de terreno e sidebar | Must | [specs/geracao-terreno.md](specs/geracao-terreno.md) | <a definir> |
| F2 | Câmera e navegação | Must | [specs/navegacao.md](specs/navegacao.md) | <a definir> |
| F3 | Pins e drawer | Must | [specs/pins.md](specs/pins.md) | <a definir> |
| F4 | Mundos e persistência | Must | [specs/mundos.md](specs/mundos.md) | <a definir> |
| F5 | Estradas e rotas | <desejável: a definir> | [specs/estradas.md](specs/estradas.md) | <a definir> |

## Requisitos não funcionais

O estilo cartoon é o que torna o app leve: cores chapadas e ícones em vez de detalhe por pixel.

| ID | Requisito | Meta |
|---|---|---|
| RNF-1 | Desempenho de navegação | 60 fps em pan/zoom num notebook com GPU integrada (referência: Intel Iris Xe, tela 1080p) |
| RNF-2 | Tempo de geração | Prévia 256² ≤ 150 ms; mapa 1024² ≤ 1,5 s, sem travar a UI |
| RNF-3 | Memória | ≤ 64 MB para os dados do mundo 1024² |
| RNF-4 | Determinismo | Mesma seed + parâmetros + versão do gerador = mesmo mapa, verificado por teste no Chrome, Firefox e WebKit; o núcleo evita funções Math transcendentes (sin, exp, pow), que podem variar entre engines |
| RNF-5 | Persistência | Salva só seed, parâmetros, pins e estradas; o terreno é regerado |
| RNF-6 | Compatibilidade | Chrome, Edge, Firefox e Safari atuais; WebGL2 obrigatório |
| RNF-7 | Responsividade | Edição completa em tablet (1024 px) e consulta de mapa e pins no celular (390 px); sidebar e drawer viram painéis sobrepostos abaixo de 768 px |
| RNF-8 | Acessibilidade | Sliders e formulários navegáveis por teclado, com rótulos |
| RNF-9 | Expansão 3D | Gerador amostra ruído 3D; pins guardam coordenadas independentes da projeção |
| RNF-10 | Temas | Interface em tema claro e escuro; a paleta do mapa não muda com o tema |

### Diretrizes do estilo cartunesco

- Paleta chapada por bioma, com 3 a 4 tons por faixa de altura (posterização), sem gradiente
  contínuo.
- Contorno escuro na linha de costa e anel de água rasa mais clara.
- Ícones desenhados para árvores, montanhas, picos nevados, dunas e cactos, espalhados por
  amostragem Poisson-disk.
- Hillshade suave, só para dar volume, nunca realista.
- Rótulos em Cinzel (ver [design/design-system.md](design/design-system.md)).

## Métricas de sucesso

- Pré-visualização do mapa em até 150 ms após mexer num slider; mapa final 1024×1024 em até 1,5 s.
- Slider de bioma fiel: definir 30% de oceano resulta em 30% ± 2% de células oceânicas.
- Pan e zoom sem travar com 500 pins e 5.000 ícones decorativos.
- Mesma seed e mesmos parâmetros produzem o mesmo mapa em qualquer máquina.
- Um usuário novo cria um mundo e marca 10 pins com nome e descrição em menos de 10 minutos, sem
  tutorial.

## Riscos

O maior risco é a qualidade visual do estilo cartoon, que depende de arte (ícones) e não só de
código.

| Risco | Impacto | Mitigação |
|---|---|---|
| Ícones cartoon de baixa qualidade ou sem licença | Mapa parece amador | Começar com pacote CC0 (ex.: Kenney) e trocar depois; spritesheet isolado em `render/style` |
| Sliders por quantil mudarem o mapa inteiro a cada ajuste | Usuário perde a referência visual | Manter o ruído fixo pela seed; só os limiares mudam |
| Mudança no gerador quebrar mundos salvos | Pins em lugares errados | `generatorVersion` salvo no mundo; versões antigas do gerador mantidas |
| Mapas maiores que 1024² | Memória e tempo de geração | Geração em chunks sob demanda numa fase futura |
| Imagens enviadas pesarem o IndexedDB | Lentidão e cota estourada | Redimensionar para 256 px ao enviar; limite de 1 MB |
| Mesmo mapa sair diferente entre navegadores | Mundo compartilhado abre com outro terreno | Teste de hash do mapa em Chrome, Firefox e WebKit no CI (Playwright) |
| Estilo visual validado tarde | Retrabalho no renderer e na decoração | Spike visual antes da Fundação |

## Questões em aberto

> Pendente: haverá contas e sincronização em nuvem, ou o app será só local?

> Pendente: a interface será só em português ou já nasce preparada para outros idiomas?

As questões sobre o mapa e os pins estão nas specs ([geracao-terreno](specs/geracao-terreno.md),
[pins](specs/pins.md), [mundos](specs/mundos.md)).

## Milestones

Milestones e ordem de entrega: ver [docs/roadmap.md](roadmap.md).
