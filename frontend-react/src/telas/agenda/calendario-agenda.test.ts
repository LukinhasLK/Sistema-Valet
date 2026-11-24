import { diasDoItem, gradeDoMes, itensPorDia } from './calendario-agenda';

describe('calendário da agenda', () => {
  it('monta 6 semanas começando no domingo que cobrem o mês', () => {
    const grade = gradeDoMes(2026, 11); // 1º/11/2026 é domingo
    expect(grade).toHaveLength(42);
    expect(grade[0]).toBe('2026-11-01');
    expect(grade[29]).toBe('2026-11-30');
    const dezembro = gradeDoMes(2026, 12); // 1º/12/2026 é terça
    expect(dezembro[0]).toBe('2026-11-29');
    expect(dezembro[2]).toBe('2026-12-01');
  });

  it('evento de vários dias conta em cada dia; terminar à meia-noite não ocupa o dia seguinte', () => {
    expect(diasDoItem({ inicio: '2026-11-27T18:00', fim: '2026-11-29T02:00' })).toEqual(['2026-11-27', '2026-11-28', '2026-11-29']);
    expect(diasDoItem({ inicio: '2026-11-27T18:00', fim: '2026-11-28T00:00' })).toEqual(['2026-11-27']);
    expect(diasDoItem({ inicio: '2026-12-31T20:00:00', fim: '2027-01-01T04:00:00' })).toEqual(['2026-12-31', '2027-01-01']);
  });

  it('agrupa por dia em ordem de horário e conta a quantidade', () => {
    const mapa = itensPorDia([
      { id: 2, inicio: '2026-11-24T20:00', fim: '2026-11-24T23:00' },
      { id: 1, inicio: '2026-11-24T09:00', fim: '2026-11-25T01:00' },
    ]);
    expect(mapa.get('2026-11-24')?.map((i) => i.id)).toEqual([1, 2]);
    expect(mapa.get('2026-11-25')?.length).toBe(1);
    expect(mapa.get('2026-11-26')).toBeUndefined();
  });
});
