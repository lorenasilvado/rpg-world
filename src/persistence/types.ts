import type { WorldParams } from '../core'

/**
 * O mundo como ele é salvo (overview.md → Modelo de dados, AC-F4-03): só o que reproduz o mapa
 * (seed, parâmetros, `sizeKm` e `generatorVersion`) e o que o usuário marcou (pins e estradas),
 * além da identidade e das datas. O terreno não é salvo: ele é regerado (RNF-5).
 */
export type World = {
  id: string
  name: string
  seed: string
  /** Versão do gerador que gerou o mapa (`GENERATOR_VERSION`), para ele ser reproduzido igual. */
  generatorVersion: number
  /** Largura do mapa em km; alimenta a barra de escala e a régua. */
  sizeKm: number
  params: WorldParams
  pins: Pin[]
  roads: Road[]
  /** ISO 8601. */
  createdAt: string
  /** ISO 8601: a última vez que o mundo foi salvo. */
  updatedAt: string
}

export type Pin = {
  id: string
  type: string
  name: string
  /** 0..1 no mapa; vira lat/lon na esfera. */
  pos: { u: number; v: number }
  icon: { kind: 'builtin'; key: string } | { kind: 'image'; blobId: string }
  /** HTML do TipTap. */
  description: string
  tags: string[]
  fields: Record<string, string>
  /** Pin pai (hierarquia, sem ciclo). */
  parentId?: string
}

/** Os tipos de via (estradas.md): estrada, trilha e rota marítima. */
export type RoadKind = 'road' | 'trail' | 'sea'

export type Road = {
  id: string
  name: string
  kind: RoadKind
  /** Os pontos do traçado, 0..1 no mapa; a curva suavizada passa por eles. */
  points: { u: number; v: number }[]
  /** O pin ligado à primeira ponta: ela fica na posição dele. */
  from?: string
  /** O pin ligado à última ponta. */
  to?: string
}

/** Uma imagem enviada (ícone ou capa de pin), guardada como blob, fora do mundo. */
export type StoredImage = { id: string; worldId: string; blob: Blob }
