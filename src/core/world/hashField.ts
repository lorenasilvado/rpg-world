import type { CoreField } from '../types'

const FNV_OFFSET = 0x811c9dc5
const FNV_PRIME = 0x01000193

function mixByte(h: number, byte: number): number {
  return Math.imul(h ^ byte, FNV_PRIME) >>> 0
}

function mixUint32(h: number, w: number): number {
  h = mixByte(h, w & 0xff)
  h = mixByte(h, (w >>> 8) & 0xff)
  h = mixByte(h, (w >>> 16) & 0xff)
  return mixByte(h, (w >>> 24) & 0xff)
}

/**
 * Hash do campo (FNV-1a de 32 bits, em hexadecimal): tamanho, os bits da elevação, da umidade e
 * da temperatura, o bioma e o hillshade de cada célula, os pontos dos rios e os ícones da
 * decoração. Lê os bits dos
 * `Float32Array` como inteiros, então não depende da ordem dos bytes da máquina. Dois campos com o
 * mesmo hash são, na prática, idênticos.
 */
export function hashField(field: CoreField): string {
  let h = FNV_OFFSET
  h = mixUint32(h, field.width)
  h = mixUint32(h, field.height)
  for (const values of [field.elevation, field.moisture, field.temperature]) {
    const bits = new Uint32Array(values.buffer, values.byteOffset, values.length)
    for (let i = 0; i < bits.length; i++) h = mixUint32(h, bits[i])
  }
  for (let i = 0; i < field.biome.length; i++) h = mixByte(h, field.biome[i])
  for (let i = 0; i < field.shade.length; i++) h = mixByte(h, field.shade[i] & 0xff)
  // Os pontos dos rios são centros de célula: `u * largura * 2` é um inteiro exato (2x + 1).
  h = mixUint32(h, field.rivers.length)
  for (const river of field.rivers) {
    h = mixUint32(h, river.length)
    for (const { u, v } of river) {
      h = mixUint32(h, Math.round(u * field.width * 2))
      h = mixUint32(h, Math.round(v * field.height * 2))
    }
  }
  // Decoração: os bits das posições (`Float32Array`) e o tipo de cada ícone.
  const { decor } = field
  h = mixUint32(h, decor.kind.length)
  for (const values of [decor.u, decor.v]) {
    const bits = new Uint32Array(values.buffer, values.byteOffset, values.length)
    for (let i = 0; i < bits.length; i++) h = mixUint32(h, bits[i])
  }
  for (let i = 0; i < decor.kind.length; i++) h = mixByte(h, decor.kind[i])
  return h.toString(16).padStart(8, '0')
}
