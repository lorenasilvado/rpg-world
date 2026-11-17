// Preparo comum dos testes do Vitest (jsdom).

// O Slider do Radix mede o thumb com ResizeObserver, que o jsdom não tem.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver
