import { Ficha } from '../modelos';
import { apiFalsa } from '../../testes/api-falsa';
import { diariasPorManobrista, filtrarFichas, fichasServico, resumirFichas, resumoMensal, useFichas } from './fichas';

const base: Omit<Ficha, 'id'> = {
  data: '2030-03-10', unidadeId: 1, turno: 'noite', fichaInicio: 1, fichaFim: 41, fichasCanceladas: 0, totalCarros: 40,
  valorDinheiro: 400, valorCartao: 600, taxaMaquininha: 2,
  manobristas: [{ manobristaId: 1, diaria: 80 }, { manobristaId: 2, diaria: 80 }],
  despesasAdicionais: [], totalBruto: 1000, totalLiquido: 828,
};
const carregarCom = (fichas: Ficha[]) => useFichas.setState({ fichas });

describe('fichas', () => {
  beforeEach(() => fichasServico.limpar());

  it('detecta ficha duplicada (mesma data, unidade e turno)', () => {
    carregarCom([{ ...base, id: 1 }]);
    expect(fichasServico.existeDuplicada(base)).toBe(true);
    expect(fichasServico.existeDuplicada({ ...base, turno: 'dia' })).toBe(false);
    expect(fichasServico.existeDuplicada({ ...base, unidadeId: 2 })).toBe(false);
    // Na edição, a própria ficha não conta como duplicada.
    expect(fichasServico.existeDuplicada(base, 1)).toBe(false);
  });

  it('envia a nova ficha à API e usa a resposta calculada pelo servidor', async () => {
    const pedidos = apiFalsa({ 'POST /api/fichas': { corpo: { ...base, id: 10, totalLiquido: 827.99 } } });
    expect((await fichasServico.adicionar(base)).id).toBe(10);
    expect(pedidos[0].metodo).toBe('POST');
    expect(fichasServico.porId(10)?.totalLiquido).toBe(827.99);
  });

  it('atualiza uma ficha existente com PUT', async () => {
    carregarCom([{ ...base, id: 1 }]);
    const pedidos = apiFalsa({ 'PUT /api/fichas/1': { corpo: { ...base, id: 1, valorDinheiro: 999 } } });
    await fichasServico.atualizar({ ...base, id: 1, valorDinheiro: 999 });
    expect(pedidos[0].metodo).toBe('PUT');
    expect(fichasServico.porId(1)?.valorDinheiro).toBe(999);
  });

  it('remove da lista só depois que a API confirma a exclusão', async () => {
    carregarCom([{ ...base, id: 1 }]);
    let liberar!: () => void;
    const confirmou = new Promise<void>((r) => { liberar = r; });
    apiFalsa({ 'DELETE /api/fichas/1': { status: 204 } });
    const fetchOriginal = globalThis.fetch;
    globalThis.fetch = (async (...args: Parameters<typeof fetch>) => { await confirmou; return fetchOriginal(...args); }) as typeof fetch;
    const pronto = fichasServico.excluir(1);
    expect(fichasServico.porId(1)).toBeDefined();
    liberar();
    await pronto;
    expect(fichasServico.porId(1)).toBeUndefined();
  });

  it('soma diárias por manobrista no mês', () => {
    const mapa = diariasPorManobrista([{ ...base, id: 1 }, { ...base, id: 2, data: '2030-03-11', manobristas: [{ manobristaId: 1, diaria: 90 }] }], 3, 2030);
    expect(mapa.get(1)).toEqual({ dias: 2, total: 170 });
    expect(mapa.get(2)).toEqual({ dias: 1, total: 80 });
  });

  it('resume carros por mês e unidade sem contar fichas canceladas', () => {
    const fichas: Ficha[] = [
      { ...base, id: 1 }, { ...base, id: 2, situacao: 'CANCELADA' },
      { ...base, id: 3, unidadeId: 2 }, { ...base, id: 4, data: '2029-03-11' },
    ];
    const meses = resumoMensal(fichas, 2030, 1);
    expect(meses.length).toBe(12);
    expect(meses[2]).toEqual({ mes: 3, fichas: 1, carros: 40, bruto: 1000, liquido: 828 });
    expect(meses[0].carros).toBe(0);
    expect(resumoMensal(fichas, 2030, 0)[2].carros).toBe(80);
  });

  it('informa se unidade ou manobrista têm histórico', () => {
    carregarCom([{ ...base, id: 1, unidadeId: 99, manobristas: [{ manobristaId: 77, diaria: 80 }] }]);
    expect(fichasServico.usaUnidade(99)).toBe(true);
    expect(fichasServico.usaManobrista(77)).toBe(true);
    expect(fichasServico.usaUnidade(12345)).toBe(false);
  });

  it('filtra pelo período e resume os totais', () => {
    const fichas = filtrarFichas([{ ...base, id: 1 }], { mes: 3, ano: 2030, unidadeId: 1 });
    expect(fichas.length).toBe(1);
    expect(resumirFichas(fichas).liquido).toBe(828);
  });
});
