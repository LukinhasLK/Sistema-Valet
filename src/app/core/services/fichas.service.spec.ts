import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Ficha } from '../models';
import { FichasService } from './fichas.service';

const base: Omit<Ficha, 'id'> = {
  data: '2030-03-10',
  unidadeId: 1,
  turno: 'noite',
  fichaInicio: 1,
  fichaFim: 41,
  fichasCanceladas: 0,
  totalCarros: 40,
  valorDinheiro: 400,
  valorCartao: 600,
  taxaMaquininha: 2,
  manobristas: [{ manobristaId: 1, diaria: 80 }, { manobristaId: 2, diaria: 80 }],
  despesasAdicionais: [],
  totalBruto: 1000,
  totalLiquido: 828,
};

describe('FichasService', () => {
  let service: FichasService;
  let http: HttpTestingController;

  /** Carrega a lista como se viesse do GET /api/fichas. */
  async function carregarCom(fichas: Ficha[]): Promise<void> {
    const pronto = service.carregar();
    http.expectOne('/api/fichas').flush(fichas);
    await pronto;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(FichasService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('detecta ficha duplicada (mesma data, unidade e turno)', async () => {
    await carregarCom([{ ...base, id: 1 }]);

    expect(service.existeDuplicada(base)).toBeTrue();
    expect(service.existeDuplicada({ ...base, turno: 'dia' })).toBeFalse();
    expect(service.existeDuplicada({ ...base, unidadeId: 2 })).toBeFalse();
    // Na edição, a própria ficha não conta como duplicada.
    expect(service.existeDuplicada(base, 1)).toBeFalse();
  });

  it('envia a nova ficha à API e usa a resposta calculada pelo servidor', async () => {
    const pronto = service.adicionar(base);
    const req = http.expectOne('/api/fichas');
    expect(req.request.method).toBe('POST');
    req.flush({ ...base, id: 10, totalLiquido: 827.99 });

    expect((await pronto).id).toBe(10);
    expect(service.porId(10)?.totalLiquido).toBe(827.99);
  });

  it('atualiza uma ficha existente com PUT', async () => {
    await carregarCom([{ ...base, id: 1 }]);
    const pronto = service.atualizar({ ...base, id: 1, valorDinheiro: 999 });
    const req = http.expectOne('/api/fichas/1');
    expect(req.request.method).toBe('PUT');
    req.flush({ ...base, id: 1, valorDinheiro: 999 });
    await pronto;

    expect(service.porId(1)?.valorDinheiro).toBe(999);
  });

  it('remove da lista só depois que a API confirma a exclusão', async () => {
    await carregarCom([{ ...base, id: 1 }]);
    const pronto = service.excluir(1);
    expect(service.porId(1)).toBeDefined();
    http.expectOne('/api/fichas/1').flush(null);
    await pronto;

    expect(service.porId(1)).toBeUndefined();
  });

  it('soma diárias por manobrista no mês', async () => {
    await carregarCom([
      { ...base, id: 1 },
      { ...base, id: 2, data: '2030-03-11', manobristas: [{ manobristaId: 1, diaria: 90 }] },
    ]);

    const mapa = service.diariasPorManobrista(3, 2030);
    expect(mapa.get(1)).toEqual({ dias: 2, total: 170 });
    expect(mapa.get(2)).toEqual({ dias: 1, total: 80 });
  });

  it('resume carros por mês e unidade sem contar fichas canceladas', async () => {
    await carregarCom([
      { ...base, id: 1 }, { ...base, id: 2, situacao: 'CANCELADA' },
      { ...base, id: 3, unidadeId: 2 }, { ...base, id: 4, data: '2029-03-11' },
    ]);
    const meses = service.resumoMensal(2030, 1);
    expect(meses.length).toBe(12);
    expect(meses[2]).toEqual({ mes: 3, fichas: 1, carros: 40, bruto: 1000, liquido: 828 });
    expect(meses[0].carros).toBe(0);
    expect(service.resumoMensal(2030, 0)[2].carros).toBe(80);
  });

  it('informa se unidade ou manobrista têm histórico', async () => {
    await carregarCom([{ ...base, id: 1, unidadeId: 99, manobristas: [{ manobristaId: 77, diaria: 80 }] }]);

    expect(service.usaUnidade(99)).toBeTrue();
    expect(service.usaManobrista(77)).toBeTrue();
    expect(service.usaUnidade(12345)).toBeFalse();
  });

  it('filtra pelo período e resume os totais', async () => {
    await carregarCom([{ ...base, id: 1 }]);
    const fichas = service.filtrar({ mes: 3, ano: 2030, unidadeId: 1 });

    expect(fichas.length).toBe(1);
    expect(service.resumir(fichas).liquido).toBe(828);
  });
});
