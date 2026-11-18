/** Navegadores suportados (PRD RNF-6), na versão atual. */
export const SUPPORTED_BROWSERS = ['Google Chrome', 'Microsoft Edge', 'Mozilla Firefox', 'Safari'] as const

/**
 * Se o navegador tem WebGL2, obrigatório pelo RNF-6 (o renderer do mapa usa a GPU). Cria um canvas
 * fora da página e pede o contexto `webgl2`; o contexto é liberado em seguida, para não ocupar um
 * dos poucos contextos WebGL que o navegador permite.
 */
export function hasWebGL2(doc: Document = document): boolean {
  try {
    const gl = doc.createElement('canvas').getContext('webgl2')
    if (!gl) return false
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    return true
  } catch {
    return false
  }
}
