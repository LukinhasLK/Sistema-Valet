import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { apiFalsa } from '../../testes/api-falsa';
import { useAuth } from '../../nucleo/estado/auth';
import type { Usuario } from '../../nucleo/modelos';
import { useOnboarding } from '../../nucleo/onboarding/estado';
import { limparAlertasDoPainel, pendenciasServico, publicarAlertasDoPainel, registrarPresenca, reiniciarChamadasParaTeste, silencioServico, usePresenca } from '../../nucleo/servicos/pendencias';
import { salvarRascunho } from '../../nucleo/servicos/rascunho-ficha';
import { AjudantePerdidinho } from './AjudantePerdidinho';
import { useFalaAtiva, type Fala } from '../../nucleo/servicos/falas-estado';
import { TEXTO_EM_DIA } from './PainelAtencao';

const GERENTE: Usuario = { id: 2, nome: 'Pedro', email: 'p@x.com', nivel: 'Gerente' };
const OPERADOR: Usuario = { id: 3, nome: 'Dario', email: 'd@x.com', nivel: 'Operador' };

const pendencia = (p: object) => ({ id: 'prontas', tipo: 'prontas', nivel: 'ATENCAO', quantidade: 3, rota: '/app/fichas?situacao=PRONTA', ...p });

async function montar(usuario: Usuario = GERENTE, variante: 'barra' | 'topo' = 'barra', aoMudarGaveta?: (aberta: boolean) => void) {
  useAuth.setState({ usuario, token: 't' });
  let resultado!: ReturnType<typeof render>;
  // Deixa a primeira busca de pendências terminar dentro do act.
  await act(async () => {
    resultado = render(<MemoryRouter initialEntries={['/app/dashboard']}><AjudantePerdidinho variante={variante} aoMudarGaveta={aoMudarGaveta} /></MemoryRouter>);
  });
  return resultado;
}

describe('AjudantePerdidinho', () => {
  beforeEach(() => {
    localStorage.clear();
    pendenciasServico.reiniciar();
    reiniciarChamadasParaTeste();
    useOnboarding.setState({ conviteAdiado: true }); // sem o convite do tour na barra (há um teste só dele)
  });
  afterEach(() => {
    useAuth.setState({ usuario: null, token: null });
    useFalaAtiva.setState({ ativa: null });
    useOnboarding.setState({ ativo: null, conviteAdiado: false, conviteRecolhido: false });
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

  const humorAtual = (c: HTMLElement) => c.querySelector('pf-perdidinho[data-humor]')?.getAttribute('data-humor');

  it('humor por situação: atenção aponta, só aviso explica, urgente surpreende, falha de rede entristece', async () => {
    apiFalsa({ '/api/pendencias': { corpo: [pendencia({})] } });
    const a = await montar();
    await waitFor(() => expect(humorAtual(a.container)).toBe('apontando'));
    a.unmount();
    pendenciasServico.reiniciar();
    apiFalsa({ '/api/pendencias': { corpo: [pendencia({ id: 'e', tipo: 'eventosHojeAmanha', nivel: 'INFO' })] } });
    const b = await montar();
    await waitFor(() => expect(humorAtual(b.container)).toBe('explicando'));
    b.unmount();
    pendenciasServico.reiniciar();
    apiFalsa({ '/api/pendencias': { corpo: [pendencia({ nivel: 'URGENTE' })] } });
    const c = await montar();
    await waitFor(() => expect(['surpreso', 'acenando']).toContain(humorAtual(c.container)));
    c.unmount();
    pendenciasServico.reiniciar();
    apiFalsa({ '/api/pendencias': { status: 500, corpo: { erro: 'x' } } });
    const d = await montar();
    await waitFor(() => expect(humorAtual(d.container)).toBe('triste'));
  });

  it('alerta de prejuízo do painel: preocupado, com subtítulo do período; some ao limpar', async () => {
    apiFalsa({ '/api/pendencias': { corpo: [pendencia({})] } });
    const { container } = await montar();
    act(() => publicarAlertasDoPainel([{ id: 'painel:resultadoNegativo:2026-11', tipo: 'resultadoNegativo', nivel: 'ATENCAO', quantidade: 1,
      rota: '/app/despesas', texto: 'Resultado de novembro negativo após despesas fixas', grupo: 'Do painel (Nov/2026)' }]));
    const botao = await screen.findByRole('button', { name: /Pendências: 2, com prejuízo no período$/ });
    await waitFor(() => expect(['pensando', 'acenando']).toContain(humorAtual(container)));
    fireEvent.click(botao);
    expect(screen.getByText('Do painel (Nov/2026)')).toBeTruthy();
    act(() => limparAlertasDoPainel());
    await screen.findByRole('button', { name: /Pendências: 1$/ });
    await waitFor(() => expect(humorAtual(container)).toBe('apontando'));
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

  it('desktop: não há mais companheiro flutuante (nada fixo no canto) e o botão é um alvo de 44 px na barra', async () => {
    apiFalsa({ '/api/pendencias': { corpo: [] } });
    const { container } = await montar();
    const raiz = container.querySelector('pf-ajudante-perdidinho')!;
    expect(raiz.getAttribute('data-variante')).toBe('barra');
    expect(raiz.hasAttribute('data-entrada')).toBe(false);
    expect(container.querySelector('pf-balao-companheiro')).toBeNull();
  });

  it('gaveta: avisa o layout ao abrir/fechar (para reservar os 380 px em telas largas), não é modal e devolve ao desmontar', async () => {
    apiFalsa({ '/api/pendencias': { corpo: [pendencia({})] } });
    const aoMudar = vi.fn();
    const { unmount } = await montar(GERENTE, 'barra', aoMudar);
    expect(aoMudar).toHaveBeenLastCalledWith(false);
    fireEvent.click(await screen.findByRole('button', { name: /Pendências: 1$/ }));
    expect(aoMudar).toHaveBeenLastCalledWith(true);
    expect(screen.getByRole('dialog', { name: 'Precisa da sua atenção' }).getAttribute('aria-modal')).toBeNull();
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(aoMudar).toHaveBeenLastCalledWith(false));
    fireEvent.click(screen.getByRole('button', { name: /Pendências: 1$/ }));
    expect(aoMudar).toHaveBeenLastCalledWith(true);
    unmount();
    expect(aoMudar).toHaveBeenLastCalledWith(false);
  });

  it('gaveta: Tab saindo do último elemento fecha; Tab no meio não fecha', async () => {
    apiFalsa({ '/api/pendencias': { corpo: [pendencia({})] } });
    await montar();
    fireEvent.click(await screen.findByRole('button', { name: /Pendências: 1$/ }));
    const dialogo = screen.getByRole('dialog', { name: 'Precisa da sua atenção' });
    const focaveis = [...dialogo.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')];
    act(() => focaveis[0].focus());
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(screen.queryByRole('dialog')).not.toBeNull();
    act(() => focaveis[focaveis.length - 1].focus());
    fireEvent.keyDown(document, { key: 'Tab' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  const falaDeTeste: Fala = {
    id: 'resumoOntem', numero: 1, canais: ['balao', 'painel'], prioridade: 3, humor: 'explicando', noPainel: true,
    texto: 'Ontem: 42 carros, R$ 750,00 líquido das fichas.', acao: { rotulo: 'Ver ontem', rota: '/app/fichas?mes=11' },
    chave: 'resumoOntem:2026-11-27', validaAte: Date.now() + 60_000,
  };

  it('fala na barra: renderiza DENTRO da barra (antes do botão), sem região própria; a região viva única a anuncia', async () => {
    apiFalsa({ '/api/pendencias': { corpo: [] } });
    const { container } = await montar();
    await screen.findByRole('button', { name: /Pendências: nenhuma$/ });
    act(() => useFalaAtiva.setState({ ativa: falaDeTeste }));
    const fala = container.querySelector('pf-balao-companheiro[data-variante=barra]')!;
    expect(fala).not.toBeNull();
    const botao = container.querySelector('.ajud__botao')!;
    expect(fala.compareDocumentPosition(botao) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(container.querySelectorAll('[aria-live]').length).toBe(1);
    await waitFor(() => expect(container.querySelector('.ajud__anuncio')?.textContent).toBe(falaDeTeste.texto));
    fireEvent.click(screen.getByRole('button', { name: 'Fechar mensagem' }));
    await waitFor(() => expect(container.querySelector('pf-balao-companheiro')).toBeNull());
    await waitFor(() => expect(container.querySelector('.ajud__anuncio')?.textContent).toBe(''));
  });

  it('convite do tour (primeiro acesso) vira fala na barra, com as 3 ações, e não é um balão no canto', async () => {
    apiFalsa({ '/api/pendencias': { corpo: [] } });
    useOnboarding.setState({ conviteAdiado: false, conviteRecolhido: false, progresso: {} });
    const { container } = await montar();
    const convite = await screen.findByRole('group', { name: 'Convite para o tour' });
    expect(container.contains(convite)).toBe(true);
    expect(screen.getByRole('button', { name: 'Fazer o tour' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Lembrar depois' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Não mostrar mais' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Lembrar depois' }));
    await waitFor(() => expect(screen.queryByRole('group', { name: 'Convite para o tour' })).toBeNull());
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
