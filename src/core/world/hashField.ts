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
 * Hash do campo (FNV-1a de 32 bits, em hexadecimal): tamanho, os bits de cada elevação e o
 * bioma de cada célula. Lê os bits do `Float32Array` como inteiros, então não depende da ordem
 * dos bytes da máquina. Dois campos com o mesmo hash são, na prática, idênticos.
 */
export function hashField(field: CoreField): string {
  let h = FNV_OFFSET
  h = mixUint32(h, field.width)
  h = mixUint32(h, field.height)
  const bits = new Uint32Array(field.elevation.buffer, field.elevation.byteOffset, field.elevation.length)
  for (let i = 0; i < bits.length; i++) h = mixUint32(h, bits[i])
  for (let i = 0; i < field.biome.length; i++) h = mixByte(h, field.biome[i])
  return h.toString(16).padStart(8, '0')
}
