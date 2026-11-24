import { Ficha } from '../../../nucleo/modelos';
import { agruparFichas, diaCurto, tituloDoDia } from '../agrupar';

const ficha = (id: number, data: string, situacao: Ficha['situacao'], liquido = 100, carros = 10): Ficha => ({
  id, data, unidadeId: 1, turno: 'dia', fichaInicio: 0, fichaFim: carros, fichasCanceladas: 0, totalCarros: carros,
  valorDinheiro: 0, valorCartao: 0, taxaMaquininha: 0, manobristas: [], despesasAdicionais: [], totalBruto: liquido, totalLiquido: liquido, situacao,
});

const fichas = [
  ficha(5, '2026-11-24', 'FECHADA'),
  ficha(4, '2026-11-24', 'PRONTA', 50, 5),
  ficha(3, '2026-11-23', 'EM_EDICAO'),
  ficha(2, '2026-11-22', 'PRONTA', -20, 2),
  ficha(1, '2026-11-21', 'CANCELADA'),
];

describe('agruparFichas', () => {
  it('por situação: o que precisa de conferência vem primeiro, sem reordenar dentro do grupo', () => {
    const grupos = agruparFichas(fichas, 'situacao');
    expect(grupos.map((g) => g.chave)).toEqual(['PRONTA', 'EM_EDICAO', 'FECHADA', 'CANCELADA']);
    expect(grupos[0].fichas.map((f) => f.id)).toEqual([4, 2]);
    expect(grupos[0].resumo).toMatchObject({ fichas: 2, carros: 7, liquido: 30 });
  });

  it('ficha sem situação conta como "Em edição"', () => {
    const grupos = agruparFichas([ficha(9, '2026-11-01', undefined)], 'situacao');
    expect(grupos[0].chave).toBe('EM_EDICAO');
  });

  it('por dia: um grupo por data com o título por extenso', () => {
    const grupos = agruparFichas(fichas, 'dia');
    expect(grupos.map((g) => g.chave)).toEqual(['2026-11-24', '2026-11-23', '2026-11-22', '2026-11-21']);
    expect(grupos[0].titulo).toBe('Terça-feira, 24 de novembro');
    expect(grupos[0].fichas.length).toBe(2);
  });

  it('sem grupos: uma lista única; lista vazia não gera grupo', () => {
    expect(agruparFichas(fichas, 'nenhum')).toHaveLength(1);
    expect(agruparFichas([], 'nenhum')).toHaveLength(0);
    expect(agruparFichas([], 'situacao')).toHaveLength(0);
  });

  it('formata dias sem depender do fuso do navegador', () => {
    expect(tituloDoDia('2026-01-01')).toBe('Quinta-feira, 1 de janeiro');
    expect(diaCurto('2026-11-24')).toBe('ter');
  });
});
