import { useRef, useState } from 'react';
import { dataBr, moeda } from '../../compartilhado/formatos';
import { Modal } from '../../compartilhado/Modal';
import { api, mensagemDeErro } from '../../nucleo/servicos/api';
import { CampoSelecao } from '../../compartilhado/CampoSelecao';
import './financeiro-evento.scss';

type Tipo = 'FICHA' | 'DESPESA';
interface Item { id: number; data: string | null; descricao: string; valor: number | null; vinculado: boolean; elegivel: boolean }
interface Total { valor: number; validos: number; vinculados: number }
interface Conciliacao { fichas: Total; despesas: Total; resultado: number; itens: Item[]; mais: boolean; cancelado: boolean }

/** Conciliação do resultado realizado do evento: vincula fichas fechadas e despesas da unidade. */
export function FinanceiroEvento({ id, nome }: { id: number; nome: string }) {
  const requisicao = useRef(0);
  const aberto = useRef(false);
  const [mostrar, setMostrar] = useState(false);
  const [alterando, setAlterando] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [dados, setDados] = useState<Conciliacao | null>(null);
  const [tipo, setTipo] = useState<Tipo>('FICHA');
  const [pagina, setPagina] = useState(0);
  const url = `/eventos/${id}/financeiro`;

  async function carregar(t = tipo, p = pagina) {
    const atual = ++requisicao.current;
    setCarregando(true);
    setErro('');
    try {
      const resposta = await api.get<Conciliacao>(url, { tipo: t, pagina: p });
      if (atual === requisicao.current) setDados(resposta);
    } catch (e) {
      if (atual === requisicao.current) {
        setDados(null);
        setErro(mensagemDeErro(e));
      }
    } finally {
      if (atual === requisicao.current) setCarregando(false);
    }
  }

  function abrir() {
    setDados(null);
    setPagina(0);
    setTipo('FICHA');
    aberto.current = true;
    setMostrar(true);
    void carregar('FICHA', 0);
  }

  function fechar() {
    requisicao.current++;
    aberto.current = false;
    setMostrar(false);
  }

  function mudarTipo(novo: Tipo) {
    setTipo(novo);
    setPagina(0);
    void carregar(novo, 0);
  }

  function mudarPagina(delta: number) {
    const nova = pagina + delta;
    setPagina(nova);
    void carregar(tipo, nova);
  }

  async function alternar(item: Item) {
    if (alterando || carregando) return;
    setAlterando(true);
    setErro('');
    const caminho = `${url}/${tipo}/${item.id}`;
    try {
      if (item.vinculado) await api.delete(caminho);
      else await api.put<void>(caminho, {});
      if (aberto.current) {
        setPagina(0);
        await carregar(tipo, 0);
      }
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setAlterando(false);
    }
  }

  return (
    <pf-financeiro-evento>
      <button type="button" className="pf-btn pf-btn--ghost" onClick={abrir}>Financeiro</button>
      {mostrar && (
        <Modal titulo={`Financeiro · ${nome}`} largo aoFechar={fechar}>
          <p>Vincule fichas fechadas e despesas da unidade no período do evento. Cada registro pode entrar em um único evento. Selecione despesas que ainda não estejam no líquido da ficha.</p>
          {dados && (
            <>
              <dl className="resumo" aria-label="Resultado realizado">
                <div><dt>Líquido das fichas</dt><dd>{moeda(dados.fichas.valor)}</dd></div>
                <div><dt>Despesas vinculadas</dt><dd>{moeda(dados.despesas.valor)}</dd></div>
                <div><dt>Resultado realizado</dt><dd>{dados.fichas.validos + dados.despesas.validos ? moeda(dados.resultado) : 'Sem lançamentos'}</dd></div>
              </dl>
              {dados.fichas.vinculados + dados.despesas.vinculados > dados.fichas.validos + dados.despesas.validos && (
                <p role="status">Há vínculos fora da conciliação. Confira os registros reabertos, cancelados ou fora do período.</p>
              )}
            </>
          )}
          <label className="pf-field">
            <span className="pf-label">Tipo de lançamento</span>
            <CampoSelecao className="pf-select" value={tipo} disabled={alterando} onChange={(e) => mudarTipo(e.target.value as Tipo)}>
              <option value="FICHA">Fichas</option><option value="DESPESA">Despesas</option>
            </CampoSelecao>
          </label>
          {erro && (
            <>
              <p className="pf-error" role="alert">{erro}</p>
              <button type="button" className="pf-btn pf-btn--ghost" onClick={() => carregar()}>Atualizar lista</button>
            </>
          )}
          {carregando ? (
            <p role="status">Carregando lançamentos…</p>
          ) : dados && (
            <>
              <ul aria-label="Lançamentos">
                {dados.itens.length ? dados.itens.map((item) => (
                  <li key={item.id}>
                    <div>
                      <strong>{item.descricao}</strong>
                      {item.data && <p>{dataBr(item.data)} · {moeda(item.valor)}</p>}
                      {item.vinculado && <p>{item.elegivel ? 'Vinculado' : 'Fora da conciliação'}</p>}
                    </div>
                    <button type="button" className="pf-btn pf-btn--ghost" disabled={alterando || (dados.cancelado && !item.vinculado)}
                      aria-label={`${item.vinculado ? 'Remover vínculo de ' : 'Vincular '}${item.descricao} #${item.id}`}
                      onClick={() => alternar(item)}>{item.vinculado ? 'Remover vínculo' : 'Vincular'}</button>
                  </li>
                )) : <li>Não há lançamentos elegíveis neste recorte.</li>}
              </ul>
              {(pagina > 0 || dados.mais) && (
                <nav aria-label="Páginas dos lançamentos">
                  <button type="button" className="pf-btn pf-btn--ghost" disabled={!pagina || alterando} onClick={() => mudarPagina(-1)}>Anterior</button>
                  <span>Página {pagina + 1}</span>
                  <button type="button" className="pf-btn pf-btn--ghost" disabled={!dados.mais || alterando} onClick={() => mudarPagina(1)}>Próxima</button>
                </nav>
              )}
            </>
          )}
        </Modal>
      )}
    </pf-financeiro-evento>
  );
}
