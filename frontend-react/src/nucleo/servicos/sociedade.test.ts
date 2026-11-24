import { acumuladoNoAno } from './sociedade';

describe('sociedade', () => {
  it('soma o ano ignorando meses que ainda não começaram', () => {
    expect(acumuladoNoAno([{ mes: 1, valor: 100.1 }, { mes: 2, valor: -20.05 }, { mes: 3, valor: null }])).toBe(80.05);
  });

  it('ano sem meses dá zero', () => {
    expect(acumuladoNoAno([])).toBe(0);
  });
});
