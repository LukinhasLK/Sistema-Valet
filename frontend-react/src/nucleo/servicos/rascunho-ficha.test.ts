import { descartarRascunho, descartarRascunhosDoUsuario, lerRascunho, salvarRascunho } from './rascunho-ficha';

describe('rascunho da ficha', () => {
  beforeEach(() => localStorage.clear());

  it('guarda e recupera por usuário e por ficha', () => {
    salvarRascunho(7, null, { valor: 1 });
    salvarRascunho(7, 42, { valor: 2 });
    expect(lerRascunho<{ valor: number }>(7, null)?.dados.valor).toBe(1);
    expect(lerRascunho<{ valor: number }>(7, 42)?.dados.valor).toBe(2);
    expect(lerRascunho(8, null)).toBeNull();
  });

  it('descarta ao lançar e apaga todos os do usuário no logout', () => {
    salvarRascunho(7, null, {});
    salvarRascunho(7, 42, {});
    salvarRascunho(9, null, {});
    descartarRascunho(7, null);
    expect(lerRascunho(7, null)).toBeNull();
    descartarRascunhosDoUsuario(7);
    expect(lerRascunho(7, 42)).toBeNull();
    expect(lerRascunho(9, null)).not.toBeNull();
  });

  it('ignora rascunhos com mais de 3 dias', () => {
    salvarRascunho(7, null, {}, new Date('2026-11-01T10:00:00Z'));
    expect(lerRascunho(7, null, new Date('2026-11-05T10:00:00Z'))).toBeNull();
  });
});
