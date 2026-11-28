import { podeAcessar, rotaInicial } from './permissoes';

describe('permissoes', () => {
  it('Proprietário acessa tudo', () => {
    for (const rota of ['dashboard', 'socios', 'usuarios', 'divisao-lucro', 'fichas/:id/editar']) {
      expect(podeAcessar('Proprietário', rota)).withContext(rota).toBeTrue();
    }
  });

  it('Gerente não vê sócios, usuários nem divisão de lucro', () => {
    expect(podeAcessar('Gerente', 'dashboard')).toBeTrue();
    expect(podeAcessar('Gerente', 'despesas')).toBeTrue();
    expect(podeAcessar('Gerente', 'socios')).toBeFalse();
    expect(podeAcessar('Gerente', 'usuarios')).toBeFalse();
    expect(podeAcessar('Gerente', 'divisao-lucro')).toBeFalse();
  });

  it('Operador só lança fichas e vê manobristas', () => {
    expect(podeAcessar('Operador', 'fichas')).toBeTrue();
    expect(podeAcessar('Operador', 'fichas/nova')).toBeTrue();
    expect(podeAcessar('Operador', 'manobristas')).toBeTrue();
    expect(podeAcessar('Operador', 'perfil')).toBeTrue();
    expect(podeAcessar('Operador', 'fichas/:id/editar')).toBeFalse();
    expect(podeAcessar('Operador', 'dashboard')).toBeFalse();
    expect(podeAcessar('Operador', 'relatorios')).toBeFalse();
  });

  it('pagamentos são exclusivos de Gerente e Proprietário', () => {
    expect(podeAcessar('Proprietário', 'pagamentos-manobristas')).toBeTrue();
    expect(podeAcessar('Gerente', 'pagamentos-manobristas')).toBeTrue();
    expect(podeAcessar('Operador', 'pagamentos-manobristas')).toBeFalse();
    expect(podeAcessar(null, 'pagamentos-manobristas')).toBeFalse();
  });

  it('sem usuário não acessa nada', () => {
    expect(podeAcessar(null, 'perfil')).toBeFalse();
  });

  it('escolhe a tela inicial pelo nível', () => {
    expect(rotaInicial('Gerente')).toBe('/app/dashboard');
    expect(rotaInicial('Operador')).toBe('/app/fichas');
  });
});
