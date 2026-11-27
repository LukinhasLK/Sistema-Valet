import { contarRascunhos, descartarRascunho, descartarRascunhosDoUsuario, lerRascunho, listarRascunhos, salvarRascunho } from './rascunho-ficha';

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

describe('listar rascunhos', () => {
  beforeEach(() => localStorage.clear());

  it('lista só os do usuário, do mais recente para o mais antigo, e ignora os vencidos', () => {
    salvarRascunho(7, null, {}, new Date('2026-11-27T10:00:00Z'));
    salvarRascunho(7, 42, {}, new Date('2026-11-27T12:00:00Z'));
    salvarRascunho(7, 43, {}, new Date('2026-11-01T12:00:00Z'));
    salvarRascunho(8, null, {}, new Date('2026-11-27T12:00:00Z'));
    const agora = new Date('2026-11-27T13:00:00Z');
    expect(listarRascunhos(7, agora).map((r) => r.fichaId)).toEqual([42, null]);
    expect(contarRascunhos(7, agora)).toBe(2);
    expect(contarRascunhos(9, agora)).toBe(0);
  });
});
