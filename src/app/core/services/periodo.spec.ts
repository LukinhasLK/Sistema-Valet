import { hojeIso, noPeriodo, rotuloPeriodo, TODAS_UNIDADES } from './periodo';

describe('periodo', () => {
  it('usa a data local, não UTC', () => {
    // 23h30 de 12/11 no horário local continua sendo dia 12.
    expect(hojeIso(new Date(2026, 10, 12, 23, 30))).toBe('2026-11-12');
    expect(hojeIso(new Date(2026, 0, 5, 0, 1))).toBe('2026-01-05');
  });

  it('monta o rótulo do período', () => {
    expect(rotuloPeriodo(6, 2026)).toBe('Junho de 2026');
    expect(rotuloPeriodo(0, 2025)).toBe('Ano de 2025');
  });

  it('filtra por mês, ano e unidade', () => {
    const registro = { data: '2026-06-07', unidadeId: 2 };
    expect(noPeriodo(registro, { mes: 6, ano: 2026, unidadeId: 2 })).toBeTrue();
    expect(noPeriodo(registro, { mes: 0, ano: 2026, unidadeId: TODAS_UNIDADES })).toBeTrue();
    expect(noPeriodo(registro, { mes: 5, ano: 2026, unidadeId: 2 })).toBeFalse();
    expect(noPeriodo(registro, { mes: 6, ano: 2025, unidadeId: 2 })).toBeFalse();
    expect(noPeriodo(registro, { mes: 6, ano: 2026, unidadeId: 1 })).toBeFalse();
  });
});
