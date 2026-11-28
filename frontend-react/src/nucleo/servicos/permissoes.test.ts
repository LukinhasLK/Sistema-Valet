import { podeAcessar, rotaInicial } from './permissoes';

describe('permissoes', () => {
  it('Proprietário acessa tudo', () => {
    for (const rota of ['dashboard', 'socios', 'usuarios', 'divisao-lucro', 'fichas/:id/editar']) {
      expect(podeAcessar('Proprietário', rota)).toBe(true);
    }
  });

  it('Gerente não vê sócios, usuários nem divisão de lucro', () => {
    expect(podeAcessar('Gerente', 'dashboard')).toBe(true);
    expect(podeAcessar('Gerente', 'despesas')).toBe(true);
    expect(podeAcessar('Gerente', 'socios')).toBe(false);
    expect(podeAcessar('Gerente', 'usuarios')).toBe(false);
    expect(podeAcessar('Gerente', 'divisao-lucro')).toBe(false);
  });

  it('Operador só lança fichas e vê manobristas', () => {
    expect(podeAcessar('Operador', 'fichas')).toBe(true);
    expect(podeAcessar('Operador', 'fichas/nova')).toBe(true);
    expect(podeAcessar('Operador', 'manobristas')).toBe(true);
    expect(podeAcessar('Operador', 'perfil')).toBe(true);
    expect(podeAcessar('Operador', 'fichas/:id/editar')).toBe(false);
    expect(podeAcessar('Operador', 'dashboard')).toBe(false);
    expect(podeAcessar('Operador', 'relatorios')).toBe(false);
  });

  it('pagamentos são exclusivos de Gerente e Proprietário', () => {
    expect(podeAcessar('Proprietário', 'pagamentos-manobristas')).toBe(true);
    expect(podeAcessar('Gerente', 'pagamentos-manobristas')).toBe(true);
    expect(podeAcessar('Operador', 'pagamentos-manobristas')).toBe(false);
    expect(podeAcessar(null, 'pagamentos-manobristas')).toBe(false);
  });

  it('sem usuário não acessa nada', () => {
    expect(podeAcessar(null, 'perfil')).toBe(false);
  });

  it('escolhe a tela inicial pelo nível', () => {
    expect(rotaInicial('Gerente')).toBe('/app/dashboard');
    expect(rotaInicial('Operador')).toBe('/app/fichas');
  });
});
