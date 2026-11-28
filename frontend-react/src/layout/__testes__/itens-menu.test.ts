import { GRUPOS_MENU, gruposPermitidos, grupoDaRota, NAV_ITEMS } from '../itens-menu';

describe('menu agrupado', () => {
  it('mantém os 15 itens, sem repetição', () => {
    expect(NAV_ITEMS).toHaveLength(15);
    expect(new Set(NAV_ITEMS.map((i) => i.rota)).size).toBe(15);
    expect(GRUPOS_MENU.map((g) => g.titulo)).toEqual(['Início', 'Operação', 'Equipe', 'Financeiro', 'Cadastros']);
  });

  it('cada nível vê só o que a regra de permissões libera', () => {
    const rotas = (nivel: Parameters<typeof gruposPermitidos>[0]) => gruposPermitidos(nivel).flatMap((g) => g.itens.map((i) => i.rota));
    expect(rotas('Proprietário')).toHaveLength(15);
    expect(rotas('Gerente')).not.toEqual(expect.arrayContaining(['/app/usuarios']));
    expect(rotas('Gerente')).toHaveLength(10);
    expect(rotas('Operador')).toEqual(['/app/fichas', '/app/manobristas']);
    expect(gruposPermitidos('Operador').map((g) => g.id)).toEqual(['operacao', 'equipe']);
    expect(rotas('Sócio')).toEqual(['/app/sociedade']);
    expect(gruposPermitidos('Sócio').map((g) => g.id)).toEqual(['financeiro']);
    expect(rotas(null)).toEqual([]);
  });

  it('encontra o grupo de uma rota, inclusive subrotas', () => {
    expect(grupoDaRota('/app/fichas/nova')?.id).toBe('operacao');
    expect(grupoDaRota('/app/perfil')).toBeUndefined();
  });
});
