/**
 * As dicas de boas-vindas do editor (geracao-terreno.md → Regras, AC-F1-31): os passos e a marca de
 * que já foram vistas ou puladas, guardada no `localStorage` do navegador (vale para todos os mundos).
 */

/** A chave do `localStorage` com a marca de dicas vistas ou puladas. */
export const WELCOME_TIPS_KEY = 'rpg-world:welcome-tips'

/** O valor gravado na chave quando as dicas foram vistas até o fim ou puladas. */
export const WELCOME_TIPS_DONE = 'done'

/** O que cada passo destaca no editor. */
export type WelcomeTarget = 'sliders' | 'toolbar' | 'pin'

export type WelcomeTip = {
  target: WelcomeTarget
  title: string
  /** O texto a partir de 768 px (sidebar fixa à esquerda). */
  text: string
  /** O texto abaixo de 768 px, quando difere (a sidebar fica atrás do botão Abrir painel). */
  mobileText?: string
  /** O texto a partir de 768 px com a sidebar recolhida a 48 px, quando difere (os sliders fora de vista). */
  collapsedText?: string
}

/** Onde as dicas aparecem: a partir de 768 px, com a sidebar aberta ou recolhida, ou abaixo disso. */
export type WelcomeLayout = 'desktop' | 'collapsed' | 'mobile'

/** O texto do passo para o layout. */
export function welcomeTipText(tip: WelcomeTip, layout: WelcomeLayout) {
  if (layout === 'mobile') return tip.mobileText ?? tip.text
  if (layout === 'collapsed') return tip.collapsedText ?? tip.text
  return tip.text
}

export const WELCOME_TIPS: readonly WelcomeTip[] = [
  {
    target: 'sliders',
    title: 'Molde o mundo',
    text: 'Os sliders do painel à esquerda mudam oceano, biomas, relevo e clima. Arraste para ver a prévia; ao soltar, o mapa é gerado.',
    mobileText:
      'Abra o painel pelo primeiro botão da barra do topo: os sliders mudam oceano, biomas, relevo e clima. Arraste para ver a prévia; ao soltar, o mapa é gerado.',
    collapsedText:
      'Expanda o painel à esquerda (pelo botão do alto dele ou pela tecla [): os sliders mudam oceano, biomas, relevo e clima. Arraste para ver a prévia; ao soltar, o mapa é gerado.',
  },
  {
    target: 'toolbar',
    title: 'Ferramentas do mapa',
    text: 'Na barra de ferramentas, embaixo, você navega pelo mapa, liga e desliga camadas e mede distâncias.',
  },
  {
    target: 'pin',
    title: 'Marque lugares',
    text: 'Com Adicionar pin (tecla P), clique no mapa para criar cidades, NPCs e locais, com anotações em cada um.',
    mobileText: 'Com Adicionar pin, toque no mapa para criar cidades, NPCs e locais, com anotações em cada um.',
  },
]

/** Se as dicas já foram vistas ou puladas. Sem acesso ao `localStorage`, conta como vistas. */
export function welcomeTipsDone(storage: Pick<Storage, 'getItem'> | undefined = safeStorage()): boolean {
  if (!storage) return true
  try {
    return storage.getItem(WELCOME_TIPS_KEY) === WELCOME_TIPS_DONE
  } catch {
    return true
  }
}

/** Grava que as dicas foram vistas ou puladas (sem acesso ao `localStorage`, não faz nada). */
export function markWelcomeTipsDone(storage: Pick<Storage, 'setItem'> | undefined = safeStorage()) {
  try {
    storage?.setItem(WELCOME_TIPS_KEY, WELCOME_TIPS_DONE)
  } catch {
    // Armazenamento bloqueado (navegação privada, cota): as dicas voltam na próxima vez.
  }
}

function safeStorage(): Storage | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage
  } catch {
    return undefined
  }
}
