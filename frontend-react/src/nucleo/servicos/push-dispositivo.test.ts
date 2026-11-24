import { liberarAparelhoDeOutroUsuario, salvarVinculoPush, vinculoPush } from './push-dispositivo';

describe('vínculo de push do aparelho', () => {
  beforeEach(() => localStorage.clear());

  it('mantém o vínculo quando o mesmo usuário entra de novo (sessão expirada)', () => {
    salvarVinculoPush({ dispositivo: 'd1', usuario: 9 });
    liberarAparelhoDeOutroUsuario(9);
    expect(vinculoPush()).toEqual({ dispositivo: 'd1', usuario: 9 });
  });

  it('remove o vínculo quando outro usuário entra no aparelho', () => {
    salvarVinculoPush({ dispositivo: 'd1', usuario: 9 });
    liberarAparelhoDeOutroUsuario(4);
    expect(vinculoPush()).toBeNull();
  });
});
