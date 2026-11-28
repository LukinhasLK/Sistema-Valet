import { onboardingServico, progressoDe, useOnboarding } from '../estado';
import { roteiroDo } from '../roteiros';

const estado = () => useOnboarding.getState();

describe('onboarding', () => {
  beforeEach(() => {
    localStorage.clear();
    useOnboarding.setState({ progresso: {}, ativo: null, conviteAdiado: false });
  });

  it('o roteiro respeita as permissões de cada nível', () => {
    const ids = (n: Parameters<typeof roteiroDo>[0]) => roteiroDo(n).map((p) => p.id);
    expect(ids('Operador')).not.toContain('dashboard');
    expect(ids('Operador')).not.toContain('pagamentos');
    expect(ids('Operador')).toContain('nova-ficha');
    expect(ids('Proprietário')).toContain('pagamentos');
  });

  it('avança, pausa ("continuar depois") e retoma do mesmo passo', () => {
    onboardingServico.iniciar(7, 'Gerente');
    onboardingServico.avancar();
    onboardingServico.avancar();
    expect(estado().ativo?.indice).toBe(2);
    onboardingServico.pausar();
    expect(estado().ativo).toBeNull();
    expect(progressoDe(estado().progresso, 7)).toMatchObject({ status: 'pausado', passo: 2 });
    expect(estado().conviteAdiado).toBe(true);
    onboardingServico.retomar(7, 'Gerente');
    expect(estado().ativo?.indice).toBe(2);
  });

  it('salva o progresso por usuário no aparelho', () => {
    onboardingServico.iniciar(7, 'Gerente');
    onboardingServico.pular();
    expect(JSON.parse(localStorage.getItem('parkflash.v3.onboarding')!)[7].status).toBe('pulado');
    expect(progressoDe(estado().progresso, 8).status).toBe('nao_iniciado');
  });

  it('conclui no último passo e pode ser revisto do início', () => {
    onboardingServico.iniciar(1, 'Operador');
    const total = roteiroDo('Operador').length;
    for (let i = 0; i < total; i++) onboardingServico.avancar();
    expect(progressoDe(estado().progresso, 1).status).toBe('concluido');
    onboardingServico.iniciar(1, 'Operador');
    expect(estado().ativo?.indice).toBe(0);
  });

  it('marca dicas contextuais como vistas', () => {
    onboardingServico.marcarDica(4, 'fichas');
    expect(progressoDe(estado().progresso, 4).dicasVistas).toEqual(['fichas']);
  });
});
