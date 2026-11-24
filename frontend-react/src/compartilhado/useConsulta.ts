import { DependencyList, useCallback, useEffect, useState } from 'react';
import { mensagemDeErro } from '../nucleo/servicos/api';

export type Consulta<T> =
  | { tipo: 'carregando' }
  | { tipo: 'erro'; mensagem: string }
  | { tipo: 'pronta'; dados: T };

/**
 * Busca na API sempre que as dependências mudam (o switchMap do Angular): a busca
 * anterior é cancelada, e o resultado antigo não aparece enquanto a nova carrega.
 */
export function useConsulta<T>(buscar: (sinal: AbortSignal) => Promise<T>, dependencias: DependencyList) {
  const [consulta, setConsulta] = useState<Consulta<T>>({ tipo: 'carregando' });
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    const controle = new AbortController();
    setConsulta({ tipo: 'carregando' });
    buscar(controle.signal)
      .then((dados) => { if (!controle.signal.aborted) setConsulta({ tipo: 'pronta', dados }); })
      .catch((erro) => { if (!controle.signal.aborted) setConsulta({ tipo: 'erro', mensagem: mensagemDeErro(erro) }); });
    return () => controle.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...dependencias, tentativa]);

  const tentarNovamente = useCallback(() => setTentativa((n) => n + 1), []);
  return { consulta, tentarNovamente };
}
