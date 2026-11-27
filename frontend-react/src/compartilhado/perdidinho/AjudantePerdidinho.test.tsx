import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { apiFalsa } from '../../testes/api-falsa';
import { useAuth } from '../../nucleo/estado/auth';
import type { Usuario } from '../../nucleo/modelos';
import { useOnboarding } from '../../nucleo/onboarding/estado';
import { pendenciasServico, registrarPresenca, reiniciarChamadasParaTeste, silencioServico, usePresenca } from '../../nucleo/servicos/pendencias';
import { salvarRascunho } from '../../nucleo/servicos/rascunho-ficha';
import { AjudantePerdidinho } from './AjudantePerdidinho';
import { TEXTO_EM_DIA } from './PainelAtencao';

const GERENTE: Usuario = { id: 2, nome: 'Pedro', email: 'p@x.com', nivel: 'Gerente' };
const OPERADOR: Usuario = { id: 3, nome: 'Dario', email: 'd@x.com', nivel: 'Operador' };

const pendencia = (p: object) => ({ id: 'prontas', tipo: 'prontas', nivel: 'ATENCAO', quantidade: 3, rota: '/app/fichas?situacao=PRONTA', ...p });

async function montar(usuario: Usuario = GERENTE, variante: 'lado' | 'topo' = 'lado') {
  useAuth.setState({ usuario, token: 't' });
  let resultado!: ReturnType<typeof render>;
  // Deixa a primeira busca de pendências terminar dentro do act.
  await act(async () => {
    resultado = render(<MemoryRouter initialEntries={['/app/dashboard']}><AjudantePerdidinho variante={variante} /></MemoryRouter>);
  });
  return resultado;
}

describe('AjudantePerdidinho', () => {
  beforeEach(() => {
    localStorage.clear();
    pendenciasServico.reiniciar();
    reiniciarChamadasParaTeste();
  });
  afterEach(() => {
    useAuth.setState({ usuario: null, token: null });
    useOnboarding.setState({ ativo: null });
    usePresenca.setState({ total: 0 });
  });

  it('sem pendência: rótulo "nenhuma", sem selo e feliz; o painel diz que está tudo em dia', async () => {
    apiFalsa({ '/api/pendencias': { corpo: [] } });
    const { container } = await montar();
    const botao = screen.getByRole('button', { name: /Pendências: nenhuma$/ });
    expect(container.querySelector('.ajud__selo')).toBeNull();
    expect(container.querySelector('pf-ajudante-perdidinho')?.getAttribute('data-nivel')).toBe('nada');
    fireEvent.click(botao);
    expect(await screen.findByText(TEXTO_EM_DIA)).toBeTruthy();
  });

  it('mostra o número de atenção+urgente, rótulo com urgentes e links por grupo', async () => {
    apiFalsa({ '/api/pendencias': { corpo: [
      pendencia({}),
      pendencia({ id: 'unidadesSemRateio', tipo: 'unidadesSemRateio', nivel: 'URGENTE', quantidade: 1, rota: '/app/socios' }),
      pendencia({ id: 'eventosHojeAmanha', tipo: 'eventosHojeAmanha', nivel: 'INFO', quantidade: 2, rota: '/app/eventos' }),
    ] } });
    const { container } = await montar();
    const botao = await screen.findByRole('button', { name: /Pendências: 3, 1 urgente$/ });
    expect(container.querySelector('.ajud__selo')?.textContent).toContain('3');
    expect(container.querySelector('pf-ajudante-perdidinho')?.getAttribute('data-nivel')).toBe('urgente');
    expect(botao.getAttribute('aria-expanded')).toBe('false');
    expect(botao.getAttribute('aria-haspopup')).toBe('dialog');

    fireEvent.click(botao);
    expect(botao.getAttribute('aria-expanded')).toBe('true');
    const painel = screen.getByRole('dialog', { name: 'Precisa da sua atenção' });
    expect(botao.getAttribute('aria-controls')).toBe(painel.id);
    expect(painel.getAttribute('aria-modal')).toBeNull();
    const links = screen.getAllByRole('link').map((a) => [a.textContent, a.getAttribute('href')]);
    expect(links.map(([, h]) => h)).toEqual(['/app/socios', '/app/fichas?situacao=PRONTA', '/app/eventos']);
    expect(screen.getByText('Urgente')).toBeTruthy();
    expect(screen.getByText('Atenção')).toBeTruthy();
    expect(screen.getByText('Para saber')).toBeTruthy();
    expect(screen.getByText('3 fichas esperando sua conferência.')).toBeTruthy();
  });

  it('abrir leva o foco ao título; Esc fecha e devolve o foco ao botão', async () => {
    apiFalsa({ '/api/pendencias': { corpo: [pendencia({})] } });
    await montar();
    const botao = await screen.findByRole('button', { name: /Pendências: 1$/ });
    botao.focus();
    fireEvent.click(botao);
    const titulo = screen.getByRole('heading', { name: 'Precisa da sua atenção' });
    expect(document.activeElement).toBe(titulo);
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(botao));
  });

  it('"Silenciar até amanhã" grava por usuário e o painel passa a oferecer "Voltar a avisar"', async () => {
    apiFalsa({ '/api/pendencias': { corpo: [pendencia({})] } });
    await montar();
    fireEvent.click(await screen.findByRole('button', { name: /Pendências: 1$/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Silenciar até amanhã' }));
    expect(silencioServico.ativo(GERENTE.id)).toBe(true);
    expect(silencioServico.ativo(OPERADOR.id)).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: /Pendências: 1$/ }));
    expect(await screen.findByRole('button', { name: 'Voltar a avisar' })).toBeTruthy();
  });

  it('"Rever tour" inicia o tour do nível', async () => {
    apiFalsa({ '/api/pendencias': { corpo: [] } });
    await montar();
    fireEvent.click(await screen.findByRole('button', { name: /Pendências: nenhuma$/ }));
    expect(screen.queryByRole('button', { name: 'Silenciar até amanhã' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Rever tour' }));
    expect(useOnboarding.getState().ativo?.usuario).toBe(GERENTE.id);
  });

  it('operador vê só o rascunho do aparelho, com link para a ficha', async () => {
    apiFalsa({ '/api/pendencias': { corpo: [] } });
    salvarRascunho(OPERADOR.id, null, { campos: { fichaInicio: '1' } });
    await montar(OPERADOR);
    const botao = await screen.findByRole('button', { name: /Pendências: 1$/ });
    fireEvent.click(botao);
    const link = screen.getByRole('link', { name: /Você tem uma ficha começada neste aparelho/ });
    expect(link.getAttribute('href')).toBe('/app/fichas/nova');
  });

  it('com outro Perdidinho à vista (presença) ou tour, o do menu vira silhueta sem olhos; o contador continua', async () => {
    apiFalsa({ '/api/pendencias': { corpo: [pendencia({})] } });
    const { container } = await montar();
    await screen.findByRole('button', { name: /Pendências: 1$/ });
    await waitFor(() => expect(container.querySelector('pf-perdidinho[data-humor]')).not.toBeNull());
    let desfazer = () => {};
    act(() => { desfazer = registrarPresenca(); });
    expect(container.querySelector('pf-perdidinho[data-silhueta]')).not.toBeNull();
    expect(container.querySelector('pf-perdidinho[data-humor]')).toBeNull();
    expect(container.querySelector('.ajud__selo')?.textContent).toContain('1');
    act(() => desfazer());
    await waitFor(() => expect(container.querySelector('pf-perdidinho[data-silhueta]')).toBeNull());
  });

  it('anuncia só quando urgentes aumentam, na região educada', async () => {
    const urgente = pendencia({ id: 'unidadesSemRateio', tipo: 'unidadesSemRateio', nivel: 'URGENTE', quantidade: 1, rota: '/app/socios' });
    let corpo: object[] = [pendencia({})];
    apiFalsa({ '/api/pendencias': () => ({ corpo }) });
    const { container } = await montar();
    await screen.findByRole('button', { name: /Pendências: 1$/ });
    const regiao = container.querySelector('.ajud__anuncio')!;
    expect(regiao.getAttribute('aria-live')).toBe('polite');
    expect(regiao.textContent).toBe('');
    corpo = [pendencia({}), urgente];
    await act(async () => { await pendenciasServico.atualizar(true); });
    await waitFor(() => expect(regiao.textContent).toContain('1 unidade sem divisão entre sócios.'));
  });

  it('desktop: entra (data-entrada) só na primeira vez de cada usuário nesta carga da página', async () => {
    apiFalsa({ '/api/pendencias': { corpo: [] } });
    const novo: Usuario = { id: 77, nome: 'Nina', email: 'n@x.com', nivel: 'Gerente' };
    const primeira = await montar(novo);
    expect(primeira.container.querySelector('pf-ajudante-perdidinho')?.hasAttribute('data-entrada')).toBe(true);
    primeira.unmount();
    const segunda = await montar(novo);
    expect(segunda.container.querySelector('pf-ajudante-perdidinho')?.hasAttribute('data-entrada')).toBe(false);
  });

  it('no topo do celular só mostra o cubo (sem o texto), com alvo próprio', async () => {
    apiFalsa({ '/api/pendencias': { corpo: [pendencia({})] } });
    const { container } = await montar(GERENTE, 'topo');
    await screen.findByRole('button', { name: 'Pendências: 1' });
    expect(container.querySelector('.ajud__texto')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Pendências: 1' }));
    expect(screen.getByRole('dialog', { name: 'Precisa da sua atenção' }).getAttribute('aria-modal')).toBe('true');
  });

  it('desktop: o olhar acompanha o foco (rAF) e solta depois de 3 s; campo de senha fecha os olhos', async () => {
    apiFalsa({ '/api/pendencias': { corpo: [] } });
    const { container } = await montar();
    await waitFor(() => expect(container.querySelector('pf-perdidinho[data-humor]')).not.toBeNull());
    const campo = document.createElement('input');
    campo.type = 'password';
    document.body.appendChild(campo);
    await act(async () => { campo.focus(); await new Promise((r) => requestAnimationFrame(() => r(null))); });
    expect(container.querySelector('pf-perdidinho')?.getAttribute('data-olhos')).toBe('fechados');
    await act(async () => { campo.blur(); });
    await waitFor(() => expect(container.querySelector('pf-perdidinho')?.getAttribute('data-olhos')).not.toBe('fechados'));
    campo.remove();
  });
});
