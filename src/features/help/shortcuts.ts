/**
 * Os atalhos que já funcionam no editor (navegacao.md → Regras; design-system.md → Ícones de
 * interface), na ordem do modal "Atalhos de teclado". Os das ferramentas que ainda não existem
 * (estradas) entram aqui junto com elas.
 */
export const SHORTCUTS: readonly { action: string; keys: string }[] = [
  { action: 'Navegar', keys: 'V' },
  { action: 'Adicionar pin', keys: 'P' },
  { action: 'Medir distância', keys: 'M' },
  { action: 'Mover o mapa', keys: 'Setas / WASD' },
  { action: 'Zoom', keys: '+ / −' },
  { action: 'Centralizar mapa', keys: '0' },
  { action: 'Excluir pin', keys: 'Delete / Backspace' },
  { action: 'Buscar pins', keys: 'Ctrl K' },
  { action: 'Desfazer', keys: 'Ctrl Z' },
  { action: 'Refazer', keys: 'Ctrl Shift Z' },
  { action: 'Recolher painel', keys: '[' },
  { action: 'Cancelar / fechar', keys: 'Esc' },
  { action: 'Atalhos', keys: '?' },
]
