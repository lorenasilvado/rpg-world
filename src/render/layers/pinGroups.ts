import { WORLD_SIZE } from '../camera'
import { pinType, type PinType } from '../../state/pinTypes'
import { pinToScreen, type PinCamera, type PinLike } from './pinMath'

/**
 * Os pins à vista e o agrupamento no zoom baixo (pins.md, AC-F3-14 e AC-F3-15), em TS puro: o
 * renderer desenha e a ferramenta dos pins acerta o clique com o mesmo resultado.
 */

/** Abaixo deste zoom relativo, os pins próximos viram grupos. */
export const GROUP_ZOOM = 0.8

/** Pins a menos desta distância na tela, em px CSS, entram no mesmo grupo. */
export const GROUP_DISTANCE_PX = 34

/** Diâmetro do círculo do grupo, em px CSS (design-system.md → Pins → Agrupado). */
export const GROUP_SIZE_PX = 38

/** O halo âmbar em volta do círculo, em px CSS. */
export const GROUP_HALO_PX = 3

/** O centro do círculo fica esta altura acima do ponto médio dos pins (o meio do desenho de um pin). */
export const GROUP_LIFT_PX = 16

/** O zoom relativo a que o clique num grupo leva a câmera. */
export const GROUP_FOCUS_ZOOM = 1.3

/** Um grupo: os pins dele (na ordem da lista) e o ponto médio, em unidades do mundo (0–1024). */
export type PinGroup = { ids: string[]; x: number; y: number }

/** O agrupamento: os grupos e os ids dos pins que estão em algum. */
export type PinGrouping = { groups: PinGroup[]; grouped: ReadonlySet<string> }

const NONE: PinGrouping = { groups: [], grouped: new Set() }

/** As camadas de pins por tipo (`true`: à vista). */
export type PinTypeLayers = Readonly<Record<PinType, boolean>>

/**
 * Os pins à vista: os dos tipos ligados em Camadas (um tipo desconhecido conta como Personalizado).
 * O pin `keepId` (o selecionado) fica à vista mesmo com o tipo dele escondido.
 */
export function shownPins<T extends PinLike & { type: string }>(pins: readonly T[], layers: PinTypeLayers, keepId: string | null = null): T[] {
  if (Object.values(layers).every(Boolean)) return pins.slice()
  return pins.filter((p) => p.id === keepId || layers[pinType(p.type)])
}

/**
 * Agrupa os pins (já filtrados por `shownPins`) com a câmera em `scale` px por unidade do mundo e
 * no zoom relativo `zoom`. A partir de `GROUP_ZOOM`, nada se agrupa. Abaixo, na ordem da lista,
 * cada pin ainda livre junta os pins livres seguintes a menos de `GROUP_DISTANCE_PX` dele na tela;
 * um grupo tem pelo menos 2 pins. Os pins de `keep` (o selecionado, o arrastado) nunca se agrupam.
 * Como a distância na tela só depende da escala, o pan não muda os grupos.
 */
export function groupPins<T extends PinLike>(pins: readonly T[], scale: number, zoom: number, keep: ReadonlySet<string> = new Set()): PinGrouping {
  if (zoom >= GROUP_ZOOM - 1e-9 || pins.length < 2 || !(scale > 0)) return NONE
  // A distância em unidades do mundo e uma grade com células desse lado: os vizinhos de um pin
  // estão nas 9 células em volta da dele.
  const d = GROUP_DISTANCE_PX / scale
  const pts = pins.map((p) => ({ id: p.id, x: p.pos.u * WORLD_SIZE, y: p.pos.v * WORLD_SIZE }))
  const cell = (x: number) => Math.floor(x / d)
  const grid = new Map<string, number[]>()
  pts.forEach((p, i) => {
    if (keep.has(p.id)) return
    const k = `${cell(p.x)},${cell(p.y)}`
    const list = grid.get(k)
    if (list) list.push(i)
    else grid.set(k, [i])
  })
  const used = new Uint8Array(pts.length)
  const groups: PinGroup[] = []
  const grouped = new Set<string>()
  const d2 = d * d
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]
    if (used[i] || keep.has(a.id)) continue
    used[i] = 1
    const members = [i]
    const cx = cell(a.x)
    const cy = cell(a.y)
    for (let gx = cx - 1; gx <= cx + 1; gx++) {
      for (let gy = cy - 1; gy <= cy + 1; gy++) {
        for (const j of grid.get(`${gx},${gy}`) ?? []) {
          if (j <= i || used[j]) continue
          const dx = pts[j].x - a.x
          const dy = pts[j].y - a.y
          if (dx * dx + dy * dy < d2) {
            used[j] = 1
            members.push(j)
          }
        }
      }
    }
    if (members.length < 2) continue
    members.sort((x, y) => x - y)
    let sx = 0
    let sy = 0
    for (const j of members) {
      sx += pts[j].x
      sy += pts[j].y
      grouped.add(pts[j].id)
    }
    groups.push({ ids: members.map((j) => pts[j].id), x: sx / members.length, y: sy / members.length })
  }
  return groups.length ? { groups, grouped } : NONE
}

/** Centro do círculo do grupo na área do mapa, em px CSS. */
export function groupToScreen(group: PinGroup, cam: PinCamera): { x: number; y: number } {
  const s = pinToScreen({ u: group.x / WORLD_SIZE, v: group.y / WORLD_SIZE }, cam)
  return { x: s.x, y: s.y - GROUP_LIFT_PX }
}

/** O grupo sob o ponto (px CSS) da área do mapa: o círculo com o halo; dos que se sobrepõem, o último desenhado. */
export function groupAt(px: number, py: number, groups: readonly PinGroup[], cam: PinCamera): PinGroup | null {
  const r = GROUP_SIZE_PX / 2 + GROUP_HALO_PX
  for (let i = groups.length - 1; i >= 0; i--) {
    const c = groupToScreen(groups[i], cam)
    if (Math.hypot(px - c.x, py - c.y) <= r) return groups[i]
  }
  return null
}

/**
 * O agrupamento com memória do último resultado: só refaz quando os pins, as camadas, a escala, o
 * lado do limiar do zoom ou os pins de `keep` mudam (o pan e os quadros parados saem de graça).
 */
export function createPinGrouper<T extends PinLike & { type: string }>() {
  let last: { pins: readonly T[]; layers: PinTypeLayers; scale: number; low: boolean; keep: string; result: { shown: T[] } & PinGrouping } | null = null
  return (pins: readonly T[], layers: PinTypeLayers, scale: number, zoom: number, selectedId: string | null, draggingId: string | null) => {
    const low = zoom < GROUP_ZOOM - 1e-9
    const keep = `${selectedId ?? ''}|${draggingId ?? ''}`
    if (last && last.pins === pins && last.layers === layers && last.low === low && last.keep === keep && (!low || last.scale === scale)) return last.result
    const shown = shownPins(pins, layers, selectedId)
    const keepIds = new Set([selectedId, draggingId].filter((id): id is string => id !== null))
    const result = { shown, ...groupPins(shown, scale, zoom, keepIds) }
    last = { pins, layers, scale, low, keep, result }
    return result
  }
}
