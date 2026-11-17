const SEED_WORDS = ['valdora', 'brumas', 'corvo', 'ambar', 'geada', 'solcinza', 'mareluz', 'ossomar', 'pedravela']

/** Seed aleatória no formato do design system ("valdora-7f3a"): uma palavra e 4 dígitos hexadecimais. */
export function randomSeed(random: () => number = Math.random): string {
  const word = SEED_WORDS[Math.floor(random() * SEED_WORDS.length)]
  const hex = Math.floor(random() * 0x10000)
    .toString(16)
    .padStart(4, '0')
  return `${word}-${hex}`
}
