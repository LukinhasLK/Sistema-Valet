import { fireEvent, render, screen, within } from '@testing-library/react';
import { createRef } from 'react';
import { MemoryRouter } from 'react-router-dom';
import type { Fala } from '../../nucleo/servicos/falas-estado';
import type { Avisos, Notificacao } from '../../nucleo/servicos/notificacoes';
import { vi } from 'vitest';
import { PainelAtencao, TEXTO_EM_DIA, TEXTO_SEM_AVISOS } from './PainelAtencao';

const fala: Fala = {
  id: 'resumoOntem', numero: 1, canais: ['balao', 'painel'], prioridade: 3, humor: 'explicando', noPainel: true,
  texto: 'Ontem: 42 carros, R$ 750,00 líquido das fichas.', acao: { rotulo: 'Ver ontem', rota: '/app/fichas?mes=11' },
  chave: 'resumoOntem:2026-11-27', validaAte: Date.now() + 1000,
};

function montar(falas: Fala[], itens = [] as never[], avisos?: Avisos | null) {
  return render(
    <MemoryRouter>
      <PainelAtencao id="p" variante="gaveta" itens={itens} falas={falas} avisos={avisos} botao={createRef<HTMLElement>() as never} silenciado={false}
        temTour={false} comPendencia={false} aoFechar={() => undefined} aoSilenciar={() => undefined} aoVoltarAvisar={() => undefined}
        aoReverTour={() => undefined} />
    </MemoryRouter>,
  );
}

describe('PainelAtencao: Hoje o Perdidinho disse', () => {
  it('lista as falas do dia com a ação, e não diz "tudo em dia" quando há fala', () => {
    montar([fala]);
    const secao = screen.getByRole('region', { name: 'Hoje o Perdidinho disse' });
    expect(within(secao).getByText(fala.texto)).toBeTruthy();
    expect(within(secao).getByRole('link').getAttribute('href')).toBe('/app/fichas?mes=11');
    expect(screen.queryByText(TEXTO_EM_DIA)).toBeNull();
  });
  it('sem falas nem pendências, o painel continua dizendo que está tudo em dia', () => {
    montar([]);
    expect(screen.getByText(TEXTO_EM_DIA)).toBeTruthy();
    expect(screen.queryByText('Hoje o Perdidinho disse')).toBeNull();
  });
});

const notificacao = (n: Partial<Notificacao>): Notificacao => ({
  id: 1, categoria: 'FICHA_CRIADA', titulo: 'Ficha 123 registrada', destino: 'FICHA', destinoId: 123,
  criadoEm: new Date(Date.now() - 5 * 60_000).toISOString(), lida: false, ...n,
});
const avisosDe = (itens: Notificacao[], extra: Partial<Avisos> = {}): Avisos => ({
  total: itens.filter((n) => !n.lida).length, itens, carregado: true, nova: null, marcarLidas: vi.fn(async () => undefined), marcarLida: vi.fn(), ...extra,
});

describe('PainelAtencao: Avisos', () => {
  it('sem permissão (avisos ausentes) a seção não existe', () => {
    montar([], [], null);
    expect(screen.queryByRole('region', { name: 'Avisos' })).toBeNull();
  });
  it('lista texto, quando (relativo) e o destino da notificação, entre a atenção e o que o Perdidinho disse', () => {
    montar([fala], [], avisosDe([notificacao({}), notificacao({ id: 2, titulo: 'Pagamento pendente', destino: 'PAGAMENTO', destinoId: 9 })]));
    const secao = screen.getByRole('region', { name: 'Avisos' });
    const links = within(secao).getAllByRole('link');
    expect(links[0].getAttribute('href')).toBe('/app/fichas?detalhe=123');
    expect(links[0].textContent).toContain('Ficha 123 registrada');
    expect(links[0].textContent).toContain('há 5 min');
    expect(links[1].getAttribute('href')).toBe('/app/pagamentos-manobristas?detalhe=9&aba=historico');
    expect(within(secao).getByRole('link', { name: 'Ver todas' }).getAttribute('href')).toBe('/app/notificacoes');
    const ordem = [...document.querySelectorAll('section')].map((x) => x.querySelector('h3')?.textContent);
    expect(ordem).toEqual(['Avisos', 'Hoje o Perdidinho disse']);
  });
  it('"Marcar como lidas" chama o serviço; só aparece com não lidas', () => {
    const a = avisosDe([notificacao({})]);
    const { unmount } = montar([], [], a);
    fireEvent.click(screen.getByRole('button', { name: 'Marcar como lidas' }));
    expect(a.marcarLidas).toHaveBeenCalledTimes(1);
    unmount();
    montar([], [], avisosDe([notificacao({ lida: true })]));
    expect(screen.queryByRole('button', { name: 'Marcar como lidas' })).toBeNull();
    expect(screen.getByText(/· lida/)).toBeTruthy();
  });
  it('vazio: "Nenhum aviso novo."', () => {
    montar([], [], avisosDe([]));
    expect(screen.getByText(TEXTO_SEM_AVISOS)).toBeTruthy();
  });
});
