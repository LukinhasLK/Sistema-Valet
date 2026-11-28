import { render, screen, within } from '@testing-library/react';
import { createRef } from 'react';
import { MemoryRouter } from 'react-router-dom';
import type { Fala } from '../../nucleo/servicos/falas-estado';
import { PainelAtencao, TEXTO_EM_DIA } from './PainelAtencao';

const fala: Fala = {
  id: 'resumoOntem', numero: 1, canais: ['balao', 'painel'], prioridade: 3, humor: 'explicando', noPainel: true,
  texto: 'Ontem: 42 carros, R$ 750,00 líquido das fichas.', acao: { rotulo: 'Ver ontem', rota: '/app/fichas?mes=11' },
  chave: 'resumoOntem:2026-11-27', validaAte: Date.now() + 1000,
};

function montar(falas: Fala[], itens = [] as never[]) {
  return render(
    <MemoryRouter>
      <PainelAtencao id="p" variante="desktop" itens={itens} falas={falas} botao={createRef<HTMLElement>() as never} silenciado={false}
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
