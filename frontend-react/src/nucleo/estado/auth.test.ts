import { Usuario } from '../modelos';
import { api } from '../servicos/api';
import { apiFalsa } from '../../testes/api-falsa';
import { authServico, useAuth } from './auth';

const dario: Usuario = { id: 3, nome: 'Dario', email: 'dario@email.com', nivel: 'Operador' };
/** Cargas iniciais permitidas ao Operador (sem despesas e usuários). */
const cargas = { '/api/unidades': { corpo: [] }, '/api/manobristas': { corpo: [] }, '/api/fichas': { corpo: [] } };

describe('autenticação', () => {
  beforeEach(() => {
    localStorage.clear();
    authServico.logout();
  });

  it('autentica pela API e guarda apenas o token', async () => {
    const pedidos = apiFalsa({ 'POST /api/auth/login': { corpo: { token: 'jwt-de-teste', usuario: dario } }, ...cargas });
    expect(await authServico.login('dario@email.com', '123456')).toBe(true);
    expect(useAuth.getState().usuario).toEqual(dario);
    expect(pedidos.map((p) => p.url).sort()).toEqual(['/api/auth/login', '/api/fichas', '/api/manobristas', '/api/unidades']);
    const salvo = Object.values(localStorage).join(' ');
    expect(salvo).toContain('jwt-de-teste');
    expect(salvo).not.toContain('123456');
  });

  it('retorna false quando o servidor recusa as credenciais', async () => {
    apiFalsa({ 'POST /api/auth/login': { status: 401, corpo: { mensagem: 'E-mail ou senha incorretos.' } } });
    expect(await authServico.login('dario@email.com', 'errada')).toBe(false);
    expect(useAuth.getState().usuario).toBeNull();
  });

  it('envia o token nas chamadas e encerra a sessão em 401', async () => {
    apiFalsa({ 'POST /api/auth/login': { corpo: { token: 'jwt-de-teste', usuario: dario } }, ...cargas });
    await authServico.login('dario@email.com', '123456');
    const pedidos = apiFalsa({ '/api/unidades': { status: 401, corpo: { mensagem: 'Sessão expirada.' } } });
    await expect(api.get('/unidades')).rejects.toThrow();
    expect(pedidos[0].cabecalhos.Authorization).toBe('Bearer jwt-de-teste');
    expect(useAuth.getState().usuario).toBeNull();
    expect(useAuth.getState().token).toBeNull();
  });

  it('sem rede ao abrir o app, mantém o login e mostra "sem conexão"', async () => {
    vi.useFakeTimers();
    try {
      useAuth.setState({ token: 'jwt-salvo' });
      vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
      const restaurando = authServico.restaurarSessao();
      await vi.advanceTimersByTimeAsync(5000);
      await restaurando;
      expect(useAuth.getState().token).toBe('jwt-salvo');
      expect(useAuth.getState().semConexao).toBe(true);
      expect(useAuth.getState().usuario).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('servidor fora do ar (5xx) também não apaga o login', async () => {
    vi.useFakeTimers();
    try {
      useAuth.setState({ token: 'jwt-salvo' });
      apiFalsa({ '/api/auth/me': { status: 503 } });
      const restaurando = authServico.restaurarSessao();
      await vi.advanceTimersByTimeAsync(5000);
      await restaurando;
      expect(useAuth.getState().token).toBe('jwt-salvo');
    } finally {
      vi.useRealTimers();
    }
  });

  it('token vencido (401) ao abrir o app encerra a sessão', async () => {
    useAuth.setState({ token: 'jwt-vencido' });
    apiFalsa({ '/api/auth/me': { status: 401 } });
    await authServico.restaurarSessao();
    expect(useAuth.getState().token).toBeNull();
    expect(useAuth.getState().semConexao).toBe(false);
  });

  it('um 401 atrasado da sessão anterior não derruba o usuário seguinte', async () => {
    // Usuário A fez uma requisição; enquanto ela não volta, A sai e B entra no mesmo aparelho.
    let liberar: (r: Response) => void = () => undefined;
    useAuth.setState({ token: 'jwt-de-a', usuario: dario });
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((r) => { liberar = r; })));
    const deA = api.get('/fichas');
    useAuth.setState({ token: 'jwt-de-b', usuario: { ...dario, id: 9, nome: 'B' } });
    liberar(new Response(null, { status: 401 }));
    await expect(deA).rejects.toThrow();
    expect(useAuth.getState().token).toBe('jwt-de-b');
    expect(useAuth.getState().usuario?.nome).toBe('B');
  });

  it('troca a senha pela API', async () => {
    const pedidos = apiFalsa({ 'PUT /api/auth/senha': { status: 204 } });
    await authServico.trocarSenha('123456', 'nova-senha');
    expect(pedidos[0].metodo).toBe('PUT');
    expect(pedidos[0].corpo).toEqual({ senhaAtual: '123456', novaSenha: 'nova-senha' });
  });
});
