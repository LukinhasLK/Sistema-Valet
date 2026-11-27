import { act, waitFor } from '@testing-library/react';
import { apiFalsa } from '../../testes/api-falsa';
import { useAuth } from '../estado/auth';
import {
  decidirAceno, INTERVALO_ACENO_MS, montarItens, pendenciasServico, proximaMeiaNoiteSP, registrarAceno, registrarPresenca,
  reiniciarChamadasParaTeste, resumir, rotaDoRascunho, silencioServico, textoDaPendencia, usePendenciasStore, usePresenca,
  type PendenciaServidor,
} from './pendencias';

const servidor = (...p: Partial<PendenciaServidor>[]): PendenciaServidor[] =>
  p.map((x, i) => ({ id: `t${i}`, tipo: 'prontas', nivel: 'ATENCAO', quantidade: 1, rota: '/app/fichas', ...x }));

describe('textos das pendências', () => {
  it('concordam no singular e no plural', () => {
    expect(textoDaPendencia('prontas', 1)).toBe('1 ficha esperando sua conferência.');
    expect(textoDaPendencia('prontas', 3)).toBe('3 fichas esperando sua conferência.');
    expect(textoDaPendencia('diariasAConferir', 2)).toBe('2 diárias para reconhecer.');
    expect(textoDaPendencia('manobristasAPagar', 4)).toBe('Diárias de 4 manobristas a pagar.');
    expect(textoDaPendencia('eventosHojeAmanha', 1)).toBe('Hoje e amanhã: 1 evento na agenda.');
    expect(textoDaPendencia('fichasAbertasMes', 5, 'ATENCAO')).toBe('5 fichas ainda não enviadas travam a divisão de lucro.');
    expect(textoDaPendencia('fichasAbertasMes', 2, 'INFO')).toBe('2 fichas do mês ainda abertas; o lucro pode mudar.');
    expect(textoDaPendencia('unidadesSemRateio', 2)).toBe('2 unidades sem divisão entre sócios.');
    expect(textoDaPendencia('rascunho', 1)).toBe('Você tem uma ficha começada neste aparelho.');
    expect(textoDaPendencia('semConexao', 1)).toBe('Sem conexão. Tento de novo sozinho.');
  });
});

describe('montar e resumir', () => {
  it('ordena por urgência e junta as pendências locais', () => {
    const itens = montarItens({
      servidor: servidor({ id: 'a', nivel: 'INFO', tipo: 'eventosHojeAmanha' }, { id: 'b', nivel: 'URGENTE', tipo: 'unidadesSemRateio', quantidade: 2 }),
      rascunhos: [{ fichaId: null, salvoEm: '2026-11-27T10:00:00Z' }],
      semConexao: true,
    });
    expect(itens.map((i) => i.id)).toEqual(['b', 'rascunho', 'a', 'semConexao']);
    expect(itens.find((i) => i.id === 'semConexao')?.rota).toBeNull();
    expect(itens.find((i) => i.id === 'rascunho')?.rota).toBe('/app/fichas/nova');
  });

  it('não lista o rascunho da própria tela aberta', () => {
    const r = { fichaId: 7, salvoEm: '2026-11-27T10:00:00Z' };
    expect(rotaDoRascunho(r)).toBe('/app/fichas/7/editar');
    expect(montarItens({ servidor: [], rascunhos: [r], semConexao: false, rotaAtual: '/app/fichas/7/editar' })).toEqual([]);
  });

  it('o número conta pendências (itens), não quantidades; "sem conexão" não conta', () => {
    const nada = resumir([]);
    expect(nada).toMatchObject({ nivel: 'nada', contador: 0, rotulo: 'Pendências: nenhuma' });
    const info = resumir(montarItens({ servidor: servidor({ nivel: 'INFO', quantidade: 9 }), rascunhos: [], semConexao: false }));
    expect(info).toMatchObject({ nivel: 'info', contador: 1, rotulo: 'Pendências: 1' });
    const offline = resumir(montarItens({ servidor: [], rascunhos: [], semConexao: true }));
    expect(offline).toMatchObject({ nivel: 'info', contador: 0, rotulo: 'Pendências: só avisos para saber' });
    const misto = resumir(montarItens({
      servidor: servidor({ id: 'x', nivel: 'ATENCAO', quantidade: 2 }, { id: 'y', nivel: 'URGENTE', quantidade: 1 }, { id: 'z', nivel: 'INFO', quantidade: 5 }), rascunhos: [], semConexao: true,
    }));
    expect(misto).toMatchObject({ nivel: 'urgente', contador: 3, urgentes: 1, rotulo: 'Pendências: 3, 1 urgente' });
  });
});

describe('silenciar até amanhã', () => {
  beforeEach(() => localStorage.clear());

  it('expira à meia-noite de São Paulo', () => {
    // 27/11 23:30 em SP = 28/11 02:30 UTC; meia-noite seguinte = 28/11 03:00 UTC.
    expect(new Date(proximaMeiaNoiteSP(new Date('2026-11-28T02:30:00Z'))).toISOString()).toBe('2026-11-28T03:00:00.000Z');
    // 27/11 00:10 em SP = 27/11 03:10 UTC.
    expect(new Date(proximaMeiaNoiteSP(new Date('2026-11-27T03:10:00Z'))).toISOString()).toBe('2026-11-28T03:00:00.000Z');
  });

  it('é por usuário, sobrevive a recarregar (localStorage) e vence sozinho', () => {
    const agora = new Date('2026-11-27T15:00:00Z');
    silencioServico.silenciar(7, agora);
    expect(silencioServico.ativo(7, agora)).toBe(true);
    expect(silencioServico.ativo(8, agora)).toBe(false);
    expect(silencioServico.ativo(7, new Date('2026-11-28T03:00:01Z'))).toBe(false);
    silencioServico.voltar(7, agora);
    expect(silencioServico.ativo(7, agora)).toBe(false);
  });
});

describe('chamada (aceno)', () => {
  beforeEach(() => reiniciarChamadasParaTeste());

  it('acena para urgência nova, uma vez por pendência e com 10 min de intervalo', () => {
    const t0 = 1_000_000_000_000;
    const ids = decidirAceno({ urgentes: ['a'], silenciado: false, quieto: false, agora: t0 });
    expect(ids).toEqual(['a']);
    registrarAceno(ids, t0);
    expect(decidirAceno({ urgentes: ['a', 'b'], silenciado: false, quieto: false, agora: t0 + 60_000 })).toEqual([]);
    expect(decidirAceno({ urgentes: ['a', 'b'], silenciado: false, quieto: false, agora: t0 + INTERVALO_ACENO_MS })).toEqual(['b']);
  });

  it('não acena em silêncio nem em momento quieto (e tenta de novo depois)', () => {
    expect(decidirAceno({ urgentes: ['a'], silenciado: true, quieto: false })).toEqual([]);
    expect(decidirAceno({ urgentes: ['a'], silenciado: false, quieto: true })).toEqual([]);
    expect(decidirAceno({ urgentes: ['a'], silenciado: false, quieto: false })).toEqual(['a']);
  });
});

describe('presença', () => {
  it('soma e desfaz sem passar de zero (seguro sob StrictMode)', () => {
    const a = registrarPresenca();
    const b = registrarPresenca();
    expect(usePresenca.getState().total).toBe(2);
    a(); a();
    expect(usePresenca.getState().total).toBe(1);
    b();
    expect(usePresenca.getState().total).toBe(0);
  });
});

describe('carregar do servidor', () => {
  beforeEach(() => {
    localStorage.clear();
    pendenciasServico.reiniciar();
    useAuth.setState({ usuario: { id: 2, nome: 'Pedro', email: 'p@x.com', nivel: 'Gerente' }, token: 't' });
  });
  afterEach(() => useAuth.setState({ usuario: null, token: null }));

  it('busca, respeita o limite de 20 s e deixa forçar', async () => {
    const pedidos = apiFalsa({ '/api/pendencias': { corpo: servidor({ id: 'prontas', tipo: 'prontas', quantidade: 2 }) } });
    await pendenciasServico.atualizar();
    expect(usePendenciasStore.getState().itens).toHaveLength(1);
    await pendenciasServico.atualizar();
    expect(pedidos).toHaveLength(1);
    await pendenciasServico.atualizar(true);
    expect(pedidos).toHaveLength(2);
  });

  it('sem rede marca offline; erro do servidor é ignorado; troca de usuário limpa', async () => {
    apiFalsa({ '/api/pendencias': { status: 500 } });
    await pendenciasServico.atualizar(true);
    expect(usePendenciasStore.getState().offline).toBe(false);
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('rede'); }));
    await pendenciasServico.atualizar(true);
    expect(usePendenciasStore.getState().offline).toBe(true);
    act(() => useAuth.setState({ usuario: { id: 3, nome: 'Dario', email: 'd@x.com', nivel: 'Operador' } }));
    await waitFor(() => expect(usePendenciasStore.getState().offline).toBe(false));
    expect(usePendenciasStore.getState().itens).toEqual([]);
  });
});

