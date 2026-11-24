import { vi } from 'vitest';
import { apiFalsa } from '../../testes/api-falsa';

const desligar = vi.fn();
const liberar = vi.fn();
vi.mock('../servicos/push-dispositivo', () => ({
  desligarPushDaSessao: (...args: unknown[]) => desligar(...args),
  liberarAparelhoDeOutroUsuario: (...args: unknown[]) => liberar(...args),
}));

const { authServico, useAuth } = await import('./auth');
const { api } = await import('../servicos/api');

const ana = { id: 9, nome: 'Ana', email: 'ana@x.com', nivel: 'Operador' as const };
const cargas = { '/api/unidades': { corpo: [] }, '/api/manobristas': { corpo: [] }, '/api/fichas': { corpo: [] } };

describe('sessão e notificações push', () => {
  beforeEach(async () => {
    desligar.mockClear();
    apiFalsa({ 'POST /api/auth/login': { corpo: { token: 'jwt', usuario: ana } }, ...cargas });
    await authServico.login('ana@x.com', 'segredo');
    desligar.mockClear();
  });

  it('ao entrar, libera o aparelho se ele estava vinculado a outro usuário', () => {
    expect(liberar).toHaveBeenCalledWith(9);
  });

  it('logout explícito revoga a inscrição deste aparelho', () => {
    authServico.logout();
    expect(desligar).toHaveBeenCalledWith(9, 'jwt');
    expect(useAuth.getState().usuario).toBeNull();
  });

  it('sessão expirada (401) encerra a sessão sem revogar o push', async () => {
    apiFalsa({ '/api/unidades': { status: 401, corpo: { mensagem: 'Sessão expirada.' } } });
    await expect(api.get('/unidades')).rejects.toThrow();
    expect(useAuth.getState().usuario).toBeNull();
    expect(desligar).not.toHaveBeenCalled();
  });
});
