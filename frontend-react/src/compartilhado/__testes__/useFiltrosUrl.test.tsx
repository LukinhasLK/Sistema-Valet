import { act, renderHook } from '@testing-library/react';
import { ReactNode } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { lerFiltro, useFiltrosUrl } from '../useFiltrosUrl';

function usar(url: string) {
  const envoltorio = ({ children }: { children: ReactNode }) => <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>;
  return renderHook(() => {
    const filtros = useFiltrosUrl({
      mes: { padrao: 11, ler: lerFiltro.inteiro(0, 12) },
      situacao: { padrao: 'TODAS', ler: lerFiltro.opcao(['TODAS', 'PRONTA'] as const) },
      manobristaId: { padrao: null as number | null, ler: lerFiltro.idOuNulo },
    });
    return { filtros, local: useLocation() };
  }, { wrapper: envoltorio });
}

describe('useFiltrosUrl', () => {
  it('sem parâmetros usa os padrões e não conta filtros ativos', () => {
    const { result } = usar('/app/fichas');
    expect(result.current.filtros.valores).toEqual({ mes: 11, situacao: 'TODAS', manobristaId: null });
    expect(result.current.filtros.ativos).toBe(0);
  });

  it('lê a URL e ignora valores inválidos', () => {
    const { result } = usar('/app/fichas?mes=3&situacao=PRONTA&manobristaId=7');
    expect(result.current.filtros.valores).toEqual({ mes: 3, situacao: 'PRONTA', manobristaId: 7 });
    expect(result.current.filtros.ativos).toBe(3);
    const invalido = usar('/app/fichas?mes=99&situacao=XYZ&manobristaId=-1');
    expect(invalido.result.current.filtros.valores).toEqual({ mes: 11, situacao: 'TODAS', manobristaId: null });
  });

  it('grava na URL, remove o que voltou ao padrão e preserva outros parâmetros (ex.: detalhe)', () => {
    const { result } = usar('/app/fichas?detalhe=5');
    act(() => result.current.filtros.definir({ mes: 2, situacao: 'PRONTA' }));
    expect(result.current.local.search).toBe('?detalhe=5&mes=2&situacao=PRONTA');
    act(() => result.current.filtros.definir({ mes: 11 }));
    expect(result.current.local.search).toBe('?detalhe=5&situacao=PRONTA');
    act(() => result.current.filtros.limpar());
    expect(result.current.local.search).toBe('?detalhe=5');
  });
});
