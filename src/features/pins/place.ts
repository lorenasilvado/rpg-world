import type { CoreField } from '../../core'
import { WORLD_SIZE } from '../../render/camera'
import { BIOMES } from '../../render/style/palette'
import { BIOME_LABELS } from '../sidebar/distribution'

type Pos = { u: number; v: number }

/**
 * O bioma sob o pin, pelo campo exibido (AC-F3-06): a célula que contém (u, v). Sem campo (o mapa
 * ainda não chegou), `null`.
 */
export function pinBiome(field: Pick<CoreField, 'width' | 'height' | 'biome'> | null, pos: Pos): string | null {
  if (!field || field.width <= 0 || field.height <= 0) return null
  const x = Math.min(field.width - 1, Math.max(0, Math.floor(pos.u * field.width)))
  const y = Math.min(field.height - 1, Math.max(0, Math.floor(pos.v * field.height)))
  const biome = BIOMES[field.biome[y * field.width + x]]
  return biome ? BIOME_LABELS[biome] : null
}

/** As coordenadas do pin no mapa, em unidades do mundo (0 a 1024): "x 710, y 580". */
export function pinCoords(pos: Pos, world = WORLD_SIZE): string {
  return `x ${Math.round(pos.u * world)}, y ${Math.round(pos.v * world)}`
}

/** A linha do lugar no cabeçalho do drawer: "Colina · x 710, y 580" (sem campo, só as coordenadas). */
export function pinPlace(field: Pick<CoreField, 'width' | 'height' | 'biome'> | null, pos: Pos): string {
  const biome = pinBiome(field, pos)
  return biome ? `${biome} · ${pinCoords(pos)}` : pinCoords(pos)
}

/**
 * A distância da cópia do Duplicar, em px na tela (AC-F3-09): à direita e abaixo, o bastante para
 * o pin da cópia (38 px de altura acima da âncora) começar embaixo do rótulo do original (que vai
 * de 5 a 21 px abaixo da âncora) e os dois rótulos não se cobrirem. Perto da borda de baixo, a
 * cópia sobe a mesma distância, e o rótulo dela fica acima do pin do original.
 */
export const DUPLICATE_OFFSET_PX = { x: 36, y: 64 }

/**
 * O deslocamento da cópia em (u, v), para ela cair a `DUPLICATE_OFFSET_PX` na tela no zoom atual
 * (`scale`, px por unidade do mundo). Perto da borda direita, a cópia vai para a esquerda.
 */
export function duplicateOffset(pos: Pos, scale: number, world = WORLD_SIZE): Pos {
  const s = scale > 0 && Number.isFinite(scale) ? scale : 1
  const du = DUPLICATE_OFFSET_PX.x / (s * world)
  const dv = DUPLICATE_OFFSET_PX.y / (s * world)
  return { u: pos.u + du > 1 ? -du : du, v: pos.v + dv > 1 ? -dv : dv }
}
