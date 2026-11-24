import { FormEvent, useMemo, useRef, useState } from 'react';
import { CabecalhoPagina } from '../../compartilhado/CabecalhoPagina';
import { Calendario } from '../../compartilhado/Calendario';
import { dataBr, dataHora, moeda } from '../../compartilhado/formatos';
import { Icone } from '../../compartilhado/Icone';
import { Modal } from '../../compartilhado/Modal';
import { Paginacao, usePaginar } from '../../compartilhado/Paginacao';
import { useFormulario } from '../../compartilhado/useFormulario';
import { avisos } from '../../nucleo/estado/aviso';
import { CLASSE_CATEGORIA, despesasServico, filtrarDespesas, TODAS_CATEGORIAS, totalDespesas, useDespesas } from '../../nucleo/estado/despesas';
import { anosDisponiveis, periodoReferencia, useFichas } from '../../nucleo/estado/fichas';
import { useIsMobile } from '../../nucleo/estado/layout';
import { nomeUnidade, useUnidades } from '../../nucleo/estado/unidades';
import { CATEGORIAS_DESPESA, CategoriaDespesa, Despesa, HistoricoDespesa } from '../../nucleo/modelos';
import { hojeIso, MESES, TODAS_UNIDADES } from '../../nucleo/servicos/periodo';
import { EstadoVazio } from '../../compartilhado/EstadoVazio';
import { CampoSelecao } from '../../compartilhado/CampoSelecao';
import './despesas.scss';

const ROTULO_HISTORICO: Record<string, string> = {
  CRIAR: 'Registrou', ANTES_EDICAO: 'Versão anterior à edição', EDITAR: 'Editou', CANCELAR: 'Cancelou',
};

interface FormDespesa extends Record<string, unknown> {
  data: string;
  unidadeId: number | null;
  categoria: CategoriaDespesa;
  descricao: string;
  valor: number | null;
}

export default function Despesas() {
  const isMobile = useIsMobile();
  const todasDespesas = useDespesas((s) => s.despesas);
  const fichas = useFichas((s) => s.fichas);
  const unidades = useUnidades((s) => s.unidades);
  const anos = useMemo(() => anosDisponiveis(fichas, todasDespesas), [fichas, todasDespesas]);

  const [mes, setMes] = useState(() => periodoReferencia(fichas).mes);
  const [ano, setAno] = useState(() => periodoReferencia(fichas).ano);
  const [unidadeId, setUnidadeId] = useState(TODAS_UNIDADES);
  const [categoria, setCategoria] = useState<string>(TODAS_CATEGORIAS);
  const [verCanceladas, setVerCanceladas] = useState(false);

  const despesas = useMemo(
    () => filtrarDespesas(todasDespesas, { mes, ano, unidadeId, categoria, canceladas: verCanceladas }),
    [todasDespesas, mes, ano, unidadeId, categoria, verCanceladas],
  );
  const paginacao = usePaginar(despesas);
  const total = totalDespesas(despesas);

  const [formAberto, setFormAberto] = useState(false);
  const [emEdicao, setEmEdicao] = useState<Despesa | null>(null);
  const unidadesParaLancamento = unidades.filter((u) => u.ativa !== false || u.id === emEdicao?.unidadeId);
  const [paraCancelar, setParaCancelar] = useState<Despesa | null>(null);
  const [motivoCancelamento, setMotivoCancelamento] = useState('');
  const [cancelando, setCancelando] = useState(false);
  const [carregandoHistorico, setCarregandoHistorico] = useState(false);
  const [historico, setHistorico] = useState<HistoricoDespesa[] | null>(null);
  const [detalhe, setDetalhe] = useState<Despesa | null>(null);
  const detalheAtual = useRef<Despesa | null>(null);
  detalheAtual.current = detalhe;

  const f = useFormulario<FormDespesa>(
    { data: hojeIso(), unidadeId: null, categoria: 'Outros', descricao: '', valor: null },
    (v) => ({ data: !v.data, unidadeId: v.unidadeId === null, descricao: !v.descricao, valor: v.valor === null || v.valor < 0.01 }),
  );

  const classe = (c: CategoriaDespesa) => `pf-badge ${CLASSE_CATEGORIA[c]}`;

  function abrirForm(despesa?: Despesa) {
    setEmEdicao(despesa ?? null);
    const lancaveis = unidades.filter((u) => u.ativa !== false || u.id === despesa?.unidadeId);
    f.resetar(despesa
      ? { data: despesa.data, unidadeId: despesa.unidadeId, categoria: despesa.categoria, descricao: despesa.descricao, valor: despesa.valor }
      : { data: hojeIso(), unidadeId: lancaveis.some((u) => u.id === unidadeId) ? unidadeId : null, categoria: 'Outros', descricao: '', valor: null });
    setDetalhe(null);
    setFormAberto(true);
  }

  async function salvar(evento: FormEvent) {
    evento.preventDefault();
    if (!f.valido) {
      f.tocarTodos();
      return;
    }
    const v = f.valores;
    const dados = { data: v.data, categoria: v.categoria, descricao: v.descricao, unidadeId: v.unidadeId!, valor: Number(v.valor) };
    try {
      if (emEdicao) await despesasServico.atualizar({ ...dados, id: emEdicao.id });
      else await despesasServico.adicionar(dados);
      setFormAberto(false);
      avisos.sucesso('Despesa salva.');
    } catch (erro) {
      avisos.erro(erro);
    }
  }

  function abrirDetalhe(despesa: Despesa | null) {
    setDetalhe(despesa);
    setHistorico(null);
  }

  function abrirCancelamento(despesa: Despesa) {
    setDetalhe(null);
    setMotivoCancelamento('');
    setParaCancelar(despesa);
  }

  async function consultarHistorico(despesa: Despesa) {
    if (carregandoHistorico) return;
    setCarregandoHistorico(true);
    try {
      const registros = await despesasServico.historico(despesa.id);
      if (detalheAtual.current === despesa) setHistorico(registros);
    } catch (erro) {
      avisos.erro(erro);
    } finally {
      setCarregandoHistorico(false);
    }
  }

  async function confirmarCancelamento() {
    const motivo = motivoCancelamento.trim();
    if (!paraCancelar || !motivo || cancelando) return;
    setCancelando(true);
    try {
      await despesasServico.cancelar(paraCancelar.id, motivo);
      setParaCancelar(null);
      avisos.sucesso('Despesa cancelada. O registro permanece no histórico.');
    } catch (erro) {
      avisos.erro(erro);
    } finally {
      setCancelando(false);
    }
  }

  return (
    <pf-despesas>
      <div className="pf-page">
        <CabecalhoPagina titulo="Despesas" subtitulo="Despesas fixas (aluguel, seguro, manutenção) — descontadas do resultado do mês">
          <button type="button" className="pf-btn pf-btn--primary" onClick={() => abrirForm()}>
            <Icone nome="plus" tamanho={17} />
            Nova despesa
          </button>
        </CabecalhoPagina>

        <div className="pf-filters">
          <CampoSelecao className="pf-select" value={mes} onChange={(e) => setMes(+e.target.value)} aria-label="Mês">
            <option value={0}>Todos os meses</option>
            {MESES.map((nome, i) => <option key={nome} value={i + 1}>{nome}</option>)}
          </CampoSelecao>
          <CampoSelecao className="pf-select" value={ano} onChange={(e) => setAno(+e.target.value)} aria-label="Ano">
            {anos.map((a) => <option key={a} value={a}>{a}</option>)}
          </CampoSelecao>
          <CampoSelecao className="pf-select" value={unidadeId} onChange={(e) => setUnidadeId(+e.target.value)} aria-label="Unidade">
            <option value={TODAS_UNIDADES}>Todas as unidades</option>
            {unidades.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
          </CampoSelecao>
          <CampoSelecao className="pf-select" value={categoria} onChange={(e) => setCategoria(e.target.value)} aria-label="Categoria">
            <option value={TODAS_CATEGORIAS}>Categoria</option>
            {CATEGORIAS_DESPESA.map((c) => <option key={c} value={c}>{c}</option>)}
          </CampoSelecao>
        </div>

        <label className="pf-label">
          <input type="checkbox" checked={verCanceladas} onChange={(e) => setVerCanceladas(e.target.checked)} /> Mostrar canceladas
        </label>

        {/* Barra de resumo */}
        <div className="pf-card barra">
          <span className="barra__qtd">{despesas.length} {despesas.length === 1 ? 'despesa' : 'despesas'}</span>
          <span className="barra__total">{verCanceladas ? 'Valor dos registros cancelados:' : 'Total:'} <strong>{moeda(total)}</strong></span>
        </div>

        {despesas.length === 0 ? (
          <EstadoVazio ilustracao="busca" titulo="Nenhuma despesa neste período" texto="Ajuste os filtros ou registre uma nova despesa." />
        ) : isMobile ? (
          <div className="cards">
            {paginacao.visiveis.map((d) => (
              <article key={d.id} className="pf-card card-despesa">
                <div className="card-despesa__info">
                  <span className={classe(d.categoria)}>{d.categoria}</span>
                  <button type="button" className="acao card-despesa__desc" onClick={() => abrirDetalhe(d)}>{d.descricao}</button>
                  <p className="card-despesa__meta">{nomeUnidade(unidades, d.unidadeId)} · {dataBr(d.data)}</p>
                </div>
                <p className="card-despesa__valor">{moeda(d.valor)}</p>
              </article>
            ))}
          </div>
        ) : (
          <div className="pf-card tabela">
            <div className="pf-table-wrap">
              <table className="pf-table">
                <thead>
                  <tr><th>Data</th><th>Unidade</th><th>Categoria</th><th>Descrição</th><th className="num">Valor</th><th className="actions">Ações</th></tr>
                </thead>
                <tbody>
                  {paginacao.visiveis.map((d) => (
                    <tr key={d.id}>
                      <td>{dataBr(d.data)}</td>
                      <td>{nomeUnidade(unidades, d.unidadeId)}</td>
                      <td><span className={classe(d.categoria)}>{d.categoria}</span></td>
                      <td>{d.descricao}</td>
                      <td className="num">{moeda(d.valor)}</td>
                      <td className="actions">
                        <button type="button" className="acao" onClick={() => abrirDetalhe(d)}>Ver</button>
                        {!d.cancelada && (
                          <>
                            <button type="button" className="acao" onClick={() => abrirForm(d)}>Editar</button>
                            <button type="button" className="acao acao--danger" onClick={() => abrirCancelamento(d)}>Cancelar</button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        <Paginacao pagina={paginacao.pagina} paginas={paginacao.paginas} aoSelecionar={paginacao.setPagina} />
      </div>

      {formAberto && (
        <Modal titulo={emEdicao ? 'Editar despesa' : 'Nova despesa'} aoFechar={() => setFormAberto(false)}>
          <form className="modal-form" onSubmit={salvar} noValidate>
            <div className="modal-form__par">
              <div className="pf-field">
                <label className="pf-label" htmlFor="d-data">Data</label>
                <Calendario><input id="d-data" type="date" {...f.campo('data')} /></Calendario>
              </div>
              <div className="pf-field">
                <label className="pf-label" htmlFor="d-unidade">Unidade</label>
                <CampoSelecao id="d-unidade" className={f.classe('unidadeId', 'pf-select')} value={f.valores.unidadeId ?? ''}
                  onChange={(e) => f.definir('unidadeId', e.target.value === '' ? null : Number(e.target.value))} onBlur={() => f.tocar('unidadeId')}>
                  <option value="" disabled>Selecione</option>
                  {unidadesParaLancamento.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
                </CampoSelecao>
                {f.invalido('unidadeId') && <span className="pf-error">Escolha a unidade.</span>}
              </div>
            </div>
            <div className="pf-field">
              <label className="pf-label" htmlFor="d-categoria">Categoria</label>
              <CampoSelecao id="d-categoria" {...f.campo('categoria')} className="pf-select">
                {CATEGORIAS_DESPESA.map((c) => <option key={c} value={c}>{c}</option>)}
              </CampoSelecao>
            </div>
            <div className="pf-field">
              <label className="pf-label" htmlFor="d-descricao">Descrição</label>
              <input id="d-descricao" type="text" placeholder="Ex.: aluguel do terreno" {...f.campo('descricao')} />
              {f.invalido('descricao') && <span className="pf-error">Descreva a despesa.</span>}
            </div>
            <div className="pf-field">
              <label className="pf-label" htmlFor="d-valor">Valor (R$)</label>
              <input id="d-valor" min={0} step={0.01} inputMode="decimal" placeholder="0,00" {...f.numero('valor')} />
              {f.invalido('valor') && <span className="pf-error">Informe um valor maior que zero.</span>}
            </div>
            <div className="modal-form__acoes">
              <button type="button" className="pf-btn pf-btn--ghost" onClick={() => setFormAberto(false)}>Cancelar</button>
              <button type="submit" className="pf-btn pf-btn--primary">{emEdicao ? 'Salvar alterações' : 'Salvar despesa'}</button>
            </div>
          </form>
        </Modal>
      )}

      {detalhe && (
        <Modal titulo="Detalhe da despesa" aoFechar={() => abrirDetalhe(null)}>
          <dl className="det">
            <div><dt>Data</dt><dd>{dataBr(detalhe.data)}</dd></div>
            <div><dt>Unidade</dt><dd>{nomeUnidade(unidades, detalhe.unidadeId)}</dd></div>
            <div><dt>Categoria</dt><dd><span className={classe(detalhe.categoria)}>{detalhe.categoria}</span></dd></div>
            <div><dt>Descrição</dt><dd>{detalhe.descricao}</dd></div>
            <div className="det--total"><dt>Valor</dt><dd>{moeda(detalhe.valor)}</dd></div>
          </dl>
          {historico ? (
            <ul>
              {historico.length ? historico.map((r) => (
                <li key={r.id}>
                  {dataHora(r.registradoEm, 'dd/MM/yyyy HH:mm', '-0300')} · {r.ator} · {ROTULO_HISTORICO[r.acao]} {moeda(r.valor)}
                  {r.justificativa && ` (${r.justificativa})`}
                </li>
              )) : <li>Sem alterações registradas.</li>}
            </ul>
          ) : (
            <button type="button" className="pf-btn pf-btn--ghost" disabled={carregandoHistorico} onClick={() => consultarHistorico(detalhe)}>
              {carregandoHistorico ? 'Carregando…' : 'Ver histórico'}
            </button>
          )}
          <div className="modal-form__acoes">
            {!detalhe.cancelada && (
              <>
                <button type="button" className="pf-btn pf-btn--ghost" onClick={() => abrirCancelamento(detalhe)}>Cancelar despesa</button>
                <button type="button" className="pf-btn pf-btn--ghost" onClick={() => abrirForm(detalhe)}>Editar</button>
              </>
            )}
            <button type="button" className="pf-btn pf-btn--dark" onClick={() => abrirDetalhe(null)}>Fechar</button>
          </div>
        </Modal>
      )}

      {paraCancelar && (
        <Modal titulo="Cancelar despesa" aoFechar={() => setParaCancelar(null)}>
          <p>“{paraCancelar.descricao}” deixará de compor o resultado do período. O histórico será preservado.</p>
          <div className="pf-field">
            <label className="pf-label" htmlFor="d-motivo">Motivo</label>
            <textarea className="pf-input" id="d-motivo" maxLength={500} rows={3} required
              value={motivoCancelamento} onChange={(e) => setMotivoCancelamento(e.target.value)} />
          </div>
          <div className="modal-form__acoes">
            <button type="button" className="pf-btn pf-btn--ghost" disabled={cancelando} onClick={() => setParaCancelar(null)}>Voltar</button>
            <button type="button" className="pf-btn pf-btn--primary" disabled={cancelando || !motivoCancelamento.trim()} onClick={confirmarCancelamento}>
              {cancelando ? 'Cancelando…' : 'Confirmar cancelamento'}
            </button>
          </div>
        </Modal>
      )}
    </pf-despesas>
  );
}
