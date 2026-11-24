// Configuração dos testes (Vitest + jsdom).
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// jsdom não tem matchMedia (usado pelo layout e pelos gráficos).
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (consulta: string) => ({
    matches: false, media: consulta, onchange: null,
    addEventListener: () => undefined, removeEventListener: () => undefined,
    addListener: () => undefined, removeListener: () => undefined, dispatchEvent: () => false,
  }),
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
