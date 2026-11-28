import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Usuario } from '../models';
import { authInterceptor } from '../interceptors/auth.interceptor';
import { AuthService } from './auth.service';

const dario: Usuario = { id: 3, nome: 'Dario', email: 'dario@email.com', nivel: 'Operador' };

describe('AuthService', () => {
  let auth: AuthService;
  let http: HttpTestingController;

  /** Responde as cargas iniciais permitidas ao Operador (sem despesas e usuários). */
  function responderCargas(): void {
    ['/api/unidades', '/api/manobristas', '/api/fichas'].forEach((url) => http.expectOne(url).flush([]));
  }

  async function entrarComoDario(): Promise<void> {
    const pronto = auth.login('dario@email.com', '123456');
    http.expectOne('/api/auth/login').flush({ token: 'jwt-de-teste', usuario: dario });
    await Promise.resolve();
    responderCargas();
    expect(await pronto).toBeTrue();
  }

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: 'login', children: [] }]), provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting()],
    });
    auth = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('autentica pela API e guarda apenas o token', async () => {
    await entrarComoDario();

    expect(auth.usuario()).toEqual(dario);
    expect(auth.nivel()).toBe('Operador');
    const salvo = Object.values(localStorage).join(' ');
    expect(salvo).toContain('jwt-de-teste');
    expect(salvo).not.toContain('123456');
  });

  it('retorna false quando o servidor recusa as credenciais', async () => {
    const pronto = auth.login('dario@email.com', 'errada');
    http.expectOne('/api/auth/login').flush({ mensagem: 'E-mail ou senha incorretos.' }, { status: 401, statusText: 'Unauthorized' });

    expect(await pronto).toBeFalse();
    expect(auth.autenticado()).toBeFalse();
  });

  it('envia o token nas chamadas e encerra a sessão em 401', async () => {
    await entrarComoDario();

    const chamada = firstValueFrom(TestBed.inject(HttpClient).get('/api/unidades'));
    const req = http.expectOne('/api/unidades');
    expect(req.request.headers.get('Authorization')).toBe('Bearer jwt-de-teste');
    req.flush({ mensagem: 'Sessão expirada.' }, { status: 401, statusText: 'Unauthorized' });

    await expectAsync(chamada).toBeRejected();
    expect(auth.autenticado()).toBeFalse();
    expect(auth.token()).toBeNull();
  });

  it('troca a senha pela API', async () => {
    await entrarComoDario();
    const pronto = auth.trocarSenha('123456', 'nova-senha');
    const req = http.expectOne('/api/auth/senha');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ senhaAtual: '123456', novaSenha: 'nova-senha' });
    req.flush(null);
    await pronto;
  });
});
