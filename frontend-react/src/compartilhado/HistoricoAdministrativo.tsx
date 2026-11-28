import { useRef, useState } from 'react';
import { api, mensagemDeErro } from '../nucleo/servicos/api';
import { dataHora } from './formatos';
import { Modal } from './Modal';
import './historico-administrativo.scss';

interface Alteracao {
  id: number;
  ator: string;
  campo: string;
  anterior: string | null;
  atual: string | null;
  registradoEm: string;
}

export function HistoricoAdministrativo({ id, nome, tipo }: { id: number; nome: string; tipo: 'usuarios' | 'unidades' }) {
  const requisicao = useRef(0);
  const [aberto, setAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [itens, setItens] = useState<Alteracao[]>([]);
  const [proximo, setProximo] = useState<number | null>(null);

  async function carregar(antes: number | null) {
    const atual = ++requisicao.current;
    setErro('');
    setCarregando(true);
    try {
      const pagina = await api.get<{ itens: Alteracao[]; proximo: number | null }>(
        `/${tipo}/${id}/auditoria`, antes === null ? {} : { antes },
      );
      if (requisicao.current !== atual) return;
      setItens((lista) => [...lista, ...pagina.itens]);
      setProximo(pagina.proximo);
    } catch (e) {
      if (requisicao.current === atual) setErro(mensagemDeErro(e));
    } finally {
      if (requisicao.current === atual) setCarregando(false);
    }
  }

  function abrir() {
    setItens([]);
    setProximo(null);
    setAberto(true);
    void carregar(null);
  }

  function fechar() {
    requisicao.current++;
    setCarregando(false);
    setAberto(false);
  }

  return (
    <pf-historico-administrativo>
      <button type="button" className="pf-btn pf-btn--ghost" onClick={abrir} aria-label={`Histórico de ${nome}`}>Histórico</button>
      {aberto && (
        <Modal titulo={`Histórico · ${nome}`} aoFechar={fechar}>
          {erro && (
            <>
              <p className="pf-error" role="alert">{erro}</p>
              <button type="button" className="pf-btn pf-btn--ghost" onClick={() => carregar(proximo)}>Tentar novamente</button>
            </>
          )}
          <ol aria-label="Alterações administrativas">
            {itens.map((item) => (
              <li key={item.id}>
                <strong>{item.campo}</strong>
                <p>{item.anterior ?? '—'} → {item.atual ?? '—'}</p>
                <small>{item.ator} · {dataHora(item.registradoEm, 'dd/MM/yyyy HH:mm', '-0300')}</small>
              </li>
            ))}
            {!itens.length && !carregando && !erro && <li>Nenhuma alteração detalhada registrada.</li>}
          </ol>
          {carregando ? (
            <p role="status">Carregando alterações…</p>
          ) : (
            proximo !== null && !erro && (
              <button type="button" className="pf-btn pf-btn--ghost" onClick={() => carregar(proximo)}>Ver alterações anteriores</button>
            )
          )}
        </Modal>
      )}
    </pf-historico-administrativo>
  );
}
