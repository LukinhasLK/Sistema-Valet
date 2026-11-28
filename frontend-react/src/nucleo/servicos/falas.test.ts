import { Ficha } from '../modelos';
import {
  decidirBalao, gerarFalas, INTERVALO_BALAO_MS, itensDeAtencaoDasFalas, resumirMotivos, rotaPermiteFala, sequenciasNegativas, somarDias,
  textoSaldo, ultimaFichaAntes, type DadosFalas,
} from './falas';
import { diaSP, memoriaServico } from './falas-estado';
import type { PendenciaServidor } from './pendencias';
import { montarItens } from './pendencias';

// 2026-11-28 (sábado), meio-dia em São Paulo.
const AGORA = new Date('2026-11-28T15:00:00Z');
const HOJE = '2026-11-28';

let seq = 0;
const ficha = (p: Partial<Ficha>): Ficha => ({
  id: ++seq, data: '2026-11-27', unidadeId: 1, turno: 'dia', fichaInicio: 1, fichaFim: 11, fichasCanceladas: 0, totalCarros: 10,
  valorDinheiro: 100, valorCartao: 0, taxaMaquininha: 2, manobristas: [], despesasAdicionais: [], totalBruto: 100, totalLiquido: 80,
  situacao: 'FECHADA', ...p,
});
const pend = (...p: Partial<PendenciaServidor>[]): PendenciaServidor[] =>
  p.map((x, i) => ({ id: `p${i}`, tipo: 'prontas', nivel: 'ATENCAO', quantidade: 1, rota: '/app/fichas', ...x }));

const dados = (p: Partial<DadosFalas> = {}): DadosFalas => ({
  fichas: [], unidades: [{ id: 1, nome: 'Shopping' }, { id: 2, nome: 'Centro' }], pendencias: [], pendenciasCarregadas: true, rascunhos: [], ...p,
});

describe('fala 1: resumo de ontem', () => {
  it('soma carros e líquido de ontem (sem canceladas) e traz as fichas para conferir', () => {
    const falas = gerarFalas(dados({
      fichas: [ficha({ totalCarros: 30, totalLiquido: 500 }), ficha({ totalCarros: 12, totalLiquido: 250.5, unidadeId: 2 }),
        ficha({ totalCarros: 99, totalLiquido: 999, situacao: 'CANCELADA' }), ficha({ data: HOJE, totalCarros: 7 })],
      pendencias: pend({ tipo: 'prontas', quantidade: 3 }),
    }), 'Proprietário', AGORA);
    const f = falas.find((x) => x.numero === 1)!;
    expect(f.texto).toMatch(/^Ontem: 42 carros, R\$\s750,50 líquido das fichas\. 3 fichas para conferir\.$/);
    expect(f.acao?.rotulo).toBe('Conferir');
    expect(f.humor).toBe('explicando');
    expect(f.chave).toBe('resumoOntem:2026-11-27');
  });
  it('omite a segunda frase sem fichas para conferir e usa "pensando" se o líquido é negativo', () => {
    const f = gerarFalas(dados({ fichas: [ficha({ totalLiquido: -20 })] }), 'Gerente', AGORA).find((x) => x.numero === 1)!;
    expect(f.texto).not.toMatch(/conferir/);
    expect(f.humor).toBe('pensando');
    expect(f.acao?.rotulo).toBe('Ver ontem');
  });
  it('não fala sem ficha de ontem nem antes de as pendências chegarem', () => {
    expect(gerarFalas(dados({ fichas: [ficha({ data: '2026-11-20' })] }), 'Gerente', AGORA)).toEqual([]);
    expect(gerarFalas(dados({ fichas: [ficha({})], pendenciasCarregadas: false }), 'Gerente', AGORA)).toEqual([]);
  });
  it('operador e sócio nunca recebem valores em dinheiro (nenhuma fala de resumo)', () => {
    const d = dados({ fichas: [ficha({})] });
    expect(gerarFalas(d, 'Operador', AGORA)).toEqual([]);
    expect(gerarFalas(d, 'Sócio', AGORA)).toEqual([]);
  });
});

describe('fala 5: unidade no negativo', () => {
  const negativa = (unidadeId: number, dia: string, valor = -10) => ficha({ unidadeId, data: dia, totalLiquido: valor });
  it('conta dias consecutivos COM ficha e soma < 0, terminando ontem', () => {
    const fichas = [negativa(1, '2026-11-27'), negativa(1, '2026-11-26'), negativa(1, '2026-11-25'), negativa(1, '2026-11-24', 5)];
    expect(sequenciasNegativas(fichas, HOJE)).toEqual([{ unidadeId: 1, dias: 3, inicio: '2026-11-25' }]);
  });
  it('um dia sem ficha quebra a sequência; soma do dia vale (turnos juntos)', () => {
    const quebrada = [negativa(1, '2026-11-27'), negativa(1, '2026-11-25'), negativa(1, '2026-11-24')];
    expect(sequenciasNegativas(quebrada, HOJE)[0].dias).toBe(1);
    const turnos = [ficha({ data: '2026-11-27', totalLiquido: -50 }), ficha({ data: '2026-11-27', turno: 'noite', totalLiquido: 80 })];
    expect(sequenciasNegativas(turnos, HOJE)).toEqual([]);
  });
  it('fala a partir de 3 dias e de novo em 7; antes disso, nada', () => {
    const seguidos = (n: number) => Array.from({ length: n }, (_, i) => negativa(1, somarDias('2026-11-27', -i)));
    expect(gerarFalas(dados({ fichas: seguidos(2) }), 'Proprietário', AGORA).filter((f) => f.numero === 5)).toEqual([]);
    const tres = gerarFalas(dados({ fichas: seguidos(3) }), 'Proprietário', AGORA).find((f) => f.numero === 5)!;
    expect(tres.texto).toBe('Shopping fechou no negativo 3 dias seguidos.');
    expect(tres.prioridade).toBe(1);
    const seis = gerarFalas(dados({ fichas: seguidos(6) }), 'Proprietário', AGORA).find((f) => f.numero === 5)!;
    const sete = gerarFalas(dados({ fichas: seguidos(7) }), 'Proprietário', AGORA).find((f) => f.numero === 5)!;
    expect(seis.chave).toBe(tres.chave.replace('2026-11-25', '2026-11-22'));
    expect(sete.chave.endsWith(':7')).toBe(true);
    expect(sete.chave).not.toBe(seis.chave);
  });
  it('vira item ATENÇÃO do painel', () => {
    const fichas = [negativa(2, '2026-11-27'), negativa(2, '2026-11-26'), negativa(2, '2026-11-25')];
    const itens = itensDeAtencaoDasFalas(gerarFalas(dados({ fichas }), 'Gerente', AGORA));
    expect(itens).toHaveLength(1);
    expect(itens[0]).toMatchObject({ nivel: 'ATENCAO', quantidade: 3, tipo: 'unidadeNegativa' });
  });
});

describe('fala 6: fichas esperando há mais de 1 dia', () => {
  const atrasada = (p: Partial<PendenciaServidor> = {}) => pend({
    tipo: 'prontasAtrasadas', quantidade: 2, rota: '/app/fichas?situacao=PRONTA&mes=0&ordem=antigas',
    maisAntigaData: '2026-11-20', maisAntigaUnidade: 'Centro', maisAntigaId: 9, ...p,
  });
  it('traz a mais antiga e abre a lista ordenada', () => {
    const f = gerarFalas(dados({ pendencias: atrasada() }), 'Proprietário', AGORA).find((x) => x.numero === 6)!;
    expect(f.texto).toBe('2 fichas esperando há mais de 1 dia. A mais antiga é de 20/11/2026, Centro.');
    expect(f.acao).toEqual({ rotulo: 'Conferir a mais antiga', rota: '/app/fichas?situacao=PRONTA&mes=0&ordem=antigas' });
    expect(f.prioridade).toBe(2);
  });
  it('singular, e não fala se a mais antiga tem menos de 2 dias ou faltam dados', () => {
    expect(gerarFalas(dados({ pendencias: atrasada({ quantidade: 1 }) }), 'Gerente', AGORA)[0].texto).toBe('1 ficha espera há mais de 1 dia. É de 20/11/2026, Centro.');
    expect(gerarFalas(dados({ pendencias: atrasada({ maisAntigaData: '2026-11-27' }) }), 'Gerente', AGORA)).toEqual([]);
    expect(gerarFalas(dados({ pendencias: atrasada({ maisAntigaUnidade: undefined }) }), 'Gerente', AGORA)).toEqual([]);
  });
  it('não vira item duplicado nas pendências do painel', () => {
    const itens = montarItens({ servidor: atrasada(), rascunhos: [], semConexao: false });
    expect(itens).toEqual([]);
  });
});

describe('fala 11: rascunho', () => {
  it('cita a unidade e a hora; operador também recebe', () => {
    const rascunhos = [{ fichaId: null, salvoEm: '2026-11-28T14:05:00Z', unidadeId: 2 }];
    const f = gerarFalas(dados({ rascunhos }), 'Operador', AGORA)[0];
    expect(f.texto).toBe('Você começou uma ficha de Centro às 11:05. Continuar?');
    expect(f.acao).toEqual({ rotulo: 'Continuar ficha', rota: '/app/fichas/nova' });
    expect(f.chave).toBe(`rascunho:${HOJE}`);
  });
  it('sem unidade conhecida, a frase não tem buraco; de outro dia traz a data', () => {
    const f = gerarFalas(dados({ rascunhos: [{ fichaId: 7, salvoEm: '2026-11-26T14:05:00Z', unidadeId: null }] }), 'Gerente', AGORA)[0];
    expect(f.texto).toBe('Você começou uma ficha em 26/11 às 11:05. Continuar?');
    expect(f.acao?.rota).toBe('/app/fichas/7/editar');
    expect(f.texto).not.toMatch(/undefined|null|\{/);
  });
});

describe('regras do balão', () => {
  const falas = gerarFalas(dados({
    fichas: [ficha({})], pendencias: pend({ tipo: 'prontas', quantidade: 1 }),
    rascunhos: [{ fichaId: null, salvoEm: '2026-11-28T14:05:00Z', unidadeId: 1 }],
  }), 'Proprietário', AGORA);
  const base = { falas, agora: AGORA.getTime(), silenciado: false, canal: 'balao' as const };
  const memoria = (p: Partial<ReturnType<typeof memoriaServico.ler>> = {}) => ({ ditas: {}, dia: HOJE, baloes: 0, faixas: 0, ultimoEm: 0, ...p });

  it('escolhe por prioridade (11 = P2 antes de 1 = P3)', () => {
    expect(decidirBalao({ ...base, memoria: memoria() })?.numero).toBe(11);
  });
  it('no máximo 2 balões por dia e 1 faixa', () => {
    expect(decidirBalao({ ...base, memoria: memoria({ baloes: 2 }) })).toBeNull();
    expect(decidirBalao({ ...base, memoria: memoria({ baloes: 1 }) })).not.toBeNull();
    expect(decidirBalao({ ...base, canal: 'faixa', memoria: memoria({ faixas: 1 }) })).toBeNull();
  });
  it('15 min entre balões (o aceno também conta)', () => {
    const t = AGORA.getTime();
    expect(decidirBalao({ ...base, memoria: memoria({ ultimoEm: t - INTERVALO_BALAO_MS + 1000 }) })).toBeNull();
    expect(decidirBalao({ ...base, memoria: memoria({ ultimoEm: t - INTERVALO_BALAO_MS }) })).not.toBeNull();
  });
  it('contadores de ontem não valem hoje; "já falei" vale no período', () => {
    expect(decidirBalao({ ...base, memoria: memoria({ dia: '2026-11-27', baloes: 2 }) })).not.toBeNull();
    const f11 = falas.find((f) => f.numero === 11)!;
    expect(decidirBalao({ ...base, memoria: memoria({ ditas: { [f11.id]: f11.chave } }) })?.numero).toBe(1);
    expect(decidirBalao({ ...base, memoria: memoria({ ditas: { [f11.id]: 'rascunho:2026-11-27' } }) })?.numero).toBe(11);
  });
  it('silenciado corta tudo; fala vencida não sai', () => {
    expect(decidirBalao({ ...base, silenciado: true, memoria: memoria() })).toBeNull();
    expect(decidirBalao({ ...base, agora: AGORA.getTime() + 24 * 3600_000, memoria: memoria({ dia: diaSP(AGORA.getTime() + 24 * 3600_000) }) })).toBeNull();
  });
  it('balão só na tela inicial; faixa no Painel ou em Fichas; nunca em ficha nova', () => {
    expect(rotaPermiteFala('/app/dashboard', 'Gerente', 'balao')).toBe(true);
    expect(rotaPermiteFala('/app/fichas', 'Gerente', 'balao')).toBe(false);
    expect(rotaPermiteFala('/app/fichas', 'Operador', 'balao')).toBe(true);
    expect(rotaPermiteFala('/app/fichas', 'Gerente', 'faixa')).toBe(true);
    expect(rotaPermiteFala('/app/fichas/nova', 'Operador', 'faixa')).toBe(false);
    expect(rotaPermiteFala('/app/fichas/3/editar', 'Gerente', 'faixa')).toBe(false);
  });
});

describe('memória "já falei"', () => {
  beforeEach(() => localStorage.clear());
  it('guarda por usuário, conta o canal e esquece no logout', () => {
    const t = AGORA.getTime();
    memoriaServico.registrar(5, { id: 'a', chave: 'k1' }, 'balao', t);
    memoriaServico.registrar(5, { id: 'b', chave: 'k2' }, 'faixa', t + 1);
    const m = memoriaServico.ler(5, t + 2);
    expect(m).toMatchObject({ ditas: { a: 'k1', b: 'k2' }, baloes: 1, faixas: 1, ultimoEm: t + 1 });
    expect(memoriaServico.ler(6, t).ditas).toEqual({});
    memoriaServico.marcarAceno(5, t + 100);
    expect(memoriaServico.ler(5, t + 100)).toMatchObject({ baloes: 1, ultimoEm: t + 100 });
    memoriaServico.esquecer(5);
    expect(memoriaServico.ler(5, t).ditas).toEqual({});
  });
});

describe('fala 10', () => {
  it('mostra o primeiro motivo e "e mais N"', () => {
    expect(resumirMotivos([])).toBeNull();
    expect(resumirMotivos([{ texto: 'A.', bloqueia: false }])?.texto).toBe('A.');
    expect(resumirMotivos([{ texto: 'A.', bloqueia: true }, { texto: 'B.', bloqueia: false }, { texto: 'C.', bloqueia: false }])?.texto).toBe('A. (e mais 2)');
  });
  it('saldo negativo tem texto com o valor e convida a lançar', () => {
    expect(textoSaldo(-80)).toMatch(/^O saldo ficou -R\$\s80,00\. Se estiver certo, pode lançar\.$/);
  });
  it('última ficha da unidade: anterior por data e turno, sem canceladas', () => {
    const fs = [
      ficha({ id: 1, unidadeId: 1, data: '2026-11-26', turno: 'noite', fichaFim: 50 }),
      ficha({ id: 2, unidadeId: 1, data: '2026-11-27', turno: 'dia', fichaFim: 60, situacao: 'CANCELADA' }),
      ficha({ id: 3, unidadeId: 2, data: '2026-11-27', turno: 'dia', fichaFim: 70 }),
      ficha({ id: 4, unidadeId: 1, data: '2026-11-28', turno: 'dia', fichaFim: 80 }),
    ];
    expect(ultimaFichaAntes(fs, 1, '2026-11-28', 'dia')?.id).toBe(1);
    expect(ultimaFichaAntes(fs, 1, '2026-11-28', 'noite')?.id).toBe(4);
    expect(ultimaFichaAntes(fs, 1, '2026-11-26', 'noite')).toBeNull();
  });
});
