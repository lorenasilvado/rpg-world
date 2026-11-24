/**
 * A imagem enviada como ícone do pin (pins.md → Tipos de pin, AC-F3-11): PNG, JPG ou SVG; até 1 MB
 * entra direto, acima o usuário escolhe recusar ou aceitar com a redução; outro formato é recusado.
 * Aceita, ela é reduzida para caber em 256 × 256 px (sem aumentar uma imagem menor) e guardada
 * como PNG: o SVG vira pixels, sem os scripts e os links que ele pode ter.
 */

/** O limite de tamanho do arquivo enviado: 1 MB. */
export const IMAGE_MAX_BYTES = 1024 * 1024

/**
 * O maior arquivo que dá para reduzir: 20 MB. Acima, ele é recusado sem a pergunta (decodificar um
 * arquivo enorme na página pode travar a aba).
 */
export const IMAGE_HARD_MAX_BYTES = 20 * 1024 * 1024

/** O lado máximo da imagem guardada, em px. */
export const IMAGE_SIZE_PX = 256

/** Os formatos aceitos, para o `accept` do campo de arquivo. */
export const IMAGE_ACCEPT = '.png,.jpg,.jpeg,.svg,image/png,image/jpeg,image/svg+xml'

const TYPES = new Set(['image/png', 'image/jpeg', 'image/svg+xml'])
const EXTENSIONS = /\.(png|jpe?g|svg)$/i

/** Os textos das mensagens do envio de imagem (pins.md → Estados). */
export const IMAGE_TEXT = {
  formatTitle: 'Formato não aceito',
  format: 'Envie uma imagem PNG, JPG ou SVG.',
  largeTitle: 'Imagem acima de 1 MB',
  large: (name: string, size: string) => `“${name}” tem ${size}, e o limite é 1 MB. Recuse o arquivo ou aceite a imagem reduzida para 256 px.`,
  reject: 'Recusar',
  accept: 'Aceitar com redução',
  unreadable: 'Não deu para ler esta imagem. Envie uma imagem PNG, JPG ou SVG.',
  saveFailed: 'Não deu para guardar a imagem. Tente de novo.',
  tooLargeTitle: 'Imagem grande demais',
  tooLarge: (size: string) => `O arquivo tem ${size}, e o máximo que dá para reduzir é 20 MB. Envie uma imagem menor.`,
  hint: 'PNG, JPG ou SVG, até 1 MB',
} as const

/**
 * O que fazer com o arquivo: enviar (`ok`), perguntar (`large`, acima de 1 MB) ou recusar (`format`;
 * `tooLarge`, acima de 20 MB).
 */
export type ImageCheck = 'ok' | 'large' | 'tooLarge' | 'format'

/**
 * Confere o arquivo pelo tipo que o navegador informa (sem ele, pela extensão do nome) e pelo
 * tamanho.
 */
export function checkImageFile(file: Pick<File, 'type' | 'name' | 'size'>): ImageCheck {
  const accepted = file.type ? TYPES.has(file.type) : EXTENSIONS.test(file.name)
  if (!accepted) return 'format'
  if (file.size > IMAGE_HARD_MAX_BYTES) return 'tooLarge'
  return file.size > IMAGE_MAX_BYTES ? 'large' : 'ok'
}

/**
 * O tamanho da imagem guardada: cabe em `max` × `max`, com a mesma proporção, sem aumentar. Sem
 * tamanho, o quadrado `max`.
 */
export function fitSize(width: number, height: number, max = IMAGE_SIZE_PX): { width: number; height: number } {
  if (!(width > 0) || !(height > 0)) return { width: max, height: max }
  const k = Math.min(1, max / Math.max(width, height))
  return { width: Math.max(1, Math.round(width * k)), height: Math.max(1, Math.round(height * k)) }
}

/** O tamanho do arquivo como o usuário lê: "2,4 MB" (ou "850 KB" abaixo de 1 MB). */
export function formatBytes(bytes: number): string {
  const mb = bytes / (1024 * 1024)
  if (mb >= 1) return `${mb.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

/** Um comprimento do SVG em px (`24`, `24px`); em outra unidade ou em %, `null`. */
function svgLength(value: string | null): number | null {
  const m = value?.trim().match(/^(\d*\.?\d+)(px)?$/)
  return m ? Number(m[1]) : null
}

/**
 * O tamanho em que um SVG sem `width` e `height` (só com `viewBox`, ou nem isso) é desenhado: o
 * lado maior com `max` px, na proporção do `viewBox`; sem ele, o quadrado `max`. O navegador daria
 * a ele um tamanho padrão (150 × 150 no Chrome), pequeno demais para um desenho vetorial. Com
 * `width` e `height`, `null`: vale o tamanho do próprio SVG.
 */
export function unsizedSvgSize(text: string, max = IMAGE_SIZE_PX): { width: number; height: number } | null {
  const svg = new DOMParser().parseFromString(text, 'image/svg+xml').documentElement
  if (svg.localName !== 'svg') return null
  if (svgLength(svg.getAttribute('width')) !== null && svgLength(svg.getAttribute('height')) !== null) return null
  const box = (svg.getAttribute('viewBox') ?? '').trim().split(/[\s,]+/).map(Number)
  const [w, h] = [box[2], box[3]]
  if (box.length !== 4 || !(w > 0) || !(h > 0)) return { width: max, height: max }
  const k = max / Math.max(w, h)
  return { width: Math.max(1, Math.round(w * k)), height: Math.max(1, Math.round(h * k)) }
}

function isSvg(file: Blob): boolean {
  return file.type === 'image/svg+xml' || (!file.type && /\.svg$/i.test((file as File).name ?? ''))
}

/** A imagem decodificada, com o tamanho natural dela. */
export type DecodedImage = { source: CanvasImageSource; width: number; height: number; release(): void }

/**
 * Decodifica a imagem do arquivo por um `<img>` (o único que lê SVG em todos os navegadores). O SVG
 * sem `width` e `height` fica com o tamanho de `unsizedSvgSize`.
 */
export async function decodeImage(file: Blob): Promise<DecodedImage> {
  const unsized = isSvg(file) ? unsizedSvgSize(await file.text()) : null
  const url = URL.createObjectURL(file)
  const img = new Image()
  img.src = url
  try {
    await img.decode()
  } catch (error) {
    URL.revokeObjectURL(url)
    throw error
  }
  const { width, height } = unsized ?? { width: img.naturalWidth, height: img.naturalHeight }
  return { source: img, width, height, release: () => URL.revokeObjectURL(url) }
}

/** O canvas onde a imagem é reduzida (o `toBlob` dá o PNG). */
export type ResizeCanvas = Pick<HTMLCanvasElement, 'toBlob'> & { getContext(id: '2d'): Pick<CanvasRenderingContext2D, 'drawImage' | 'imageSmoothingQuality'> | null }

function newCanvas(width: number, height: number): ResizeCanvas {
  return Object.assign(document.createElement('canvas'), { width, height })
}

/** Desenha a imagem no tamanho de `fitSize` e devolve o PNG. */
export async function resizeImage(
  file: Blob,
  { decode = decodeImage, canvas: createCanvas = newCanvas }: { decode?: (file: Blob) => Promise<DecodedImage>; canvas?: (width: number, height: number) => ResizeCanvas } = {},
): Promise<Blob> {
  const image = await decode(file)
  try {
    const { width, height } = fitSize(image.width, image.height)
    const canvas = createCanvas(width, height)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('sem o contexto 2D para reduzir a imagem')
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(image.source, 0, 0, width, height)
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('a imagem não virou PNG'))), 'image/png'),
    )
  } finally {
    image.release()
  }
}
