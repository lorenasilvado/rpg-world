# 0001. Stack da v1: React + TypeScript, PixiJS e núcleo de geração num Web Worker

- Status: Aceita
- Data: 2026-11-04
- Questão: qual stack usar na v1 (item 3 do preparo)

## Contexto

O app precisa gerar um mapa determinístico por seed (prévia 256² em até 150 ms, mapa 1024² em até
1,5 s, sem travar a UI), navegar a 60 fps com 500 pins e 5.000 ícones decorativos num notebook com
GPU integrada e, depois da v1, virar um planeta 3D reaproveitando o gerador. O projeto de referência
(RPG-land) usa React 19 + Vite com Canvas 2D e gera tudo na thread principal, o que não escala.

## Decisão

Interface em React + TypeScript, mapa 2D em PixiJS (WebGL) e núcleo de geração em TypeScript puro
rodando num Web Worker. Na fase 3D entra Three.js consumindo o mesmo núcleo.

| Camada | Escolha |
|---|---|
| Build | Vite |
| Linguagem | TypeScript (strict) |
| UI | React 19 |
| Componentes | shadcn/ui (Radix) + Tailwind CSS |
| Estado | Zustand (+ middleware `temporal` do zundo para desfazer) |
| Render 2D | PixiJS v8 |
| Câmera | pixi-viewport |
| Ruído | simplex-noise (`createNoise3D`) + alea |
| Worker | Comlink |
| Formulários | react-hook-form + zod |
| Texto rico | TipTap |
| Persistência | Dexie (IndexedDB) |
| Testes | Vitest + Playwright |
| 3D (futuro) | Three.js via react-three-fiber |

Os motivos de cada escolha estão em [overview.md](../overview.md#stack).

## Alternativas consideradas

- **Leaflet:** pensado para tiles de servidor; dar estilo cartoon e regerar o mapa a cada slider
  exige lutar contra a biblioteca.
- **Canvas 2D puro (como no RPG-land):** sem GPU, milhares de ícones e zoom suave ficam lentos.
- **Three.js já na v1:** resolveria a esfera, mas pins, rótulos e estradas 2D custam bem mais;
  melhor entrar só na fase 3D.
- **Vue:** viável, mas o RPG-land já é React e o ecossistema de componentes acessíveis é maior.

## Consequências

- O núcleo não conhece React nem Pixi: pode ser testado isoladamente e reaproveitado pelo renderer
  3D.
- WebGL2 passa a ser obrigatório (RNF-6).
- A fronteira com o worker precisa de tipos e de transferência de `ArrayBuffer` sem cópia.
- O determinismo entre navegadores precisa de teste próprio (RNF-4), porque o núcleo roda em
  engines diferentes.
