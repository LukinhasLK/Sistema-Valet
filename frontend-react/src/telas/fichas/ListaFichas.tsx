import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CabecalhoPagina } from '../../compartilhado/CabecalhoPagina';
import { CartaoKpi } from '../../compartilhado/CartaoKpi';
import { Confirmar } from '../../compartilhado/Confirmar';
import { dataBr, dataHora, moeda, numero } from '../../compartilhado/formatos';
import { Icone } from '../../compartilhado/Icone';
import { Modal } from '../../compartilhado/Modal';
import { Paginacao, usePaginar } from '../../compartilhado/Paginacao';
import { useNivel } from '../../nucleo/estado/auth';
import { avisos } from '../../nucleo/estado/aviso';
import { useDespesas } from '../../nucleo/estado/despesas';
import { anosDisponiveis, filtrarFichas, fichasServico, periodoReferencia, resumirFichas, useFichas } from '../../nucleo/estado/fichas';
import { useIsMobile } from '../../nucleo/estado/layout';
import { nomeManobrista, useManobristas } from '../../nucleo/estado/manobristas';
import { nomeUnidade, useUnidades } from '../../nucleo/estado/unidades';
import { AcaoFicha, Ficha, MODALIDADES_CUSTO, RegistroFicha } from '../../nucleo/modelos';
import { calcLiquidoCartao, calcTaxaDescontada, calcTotalDespesas, calcTotalDiarias } from '../../nucleo/servicos/calc';
import { notificacoesServico } from '../../nucleo/servicos/notificacoes';
import { MESES, TODAS_UNIDADES } from '../../nucleo/servicos/periodo';
import { podeAcessar } from '../../nucleo/servicos/permissoes';
import './fichas-list.scss';

const ROTULOS: Record<AcaoFicha, string> = {
  ENVIAR: 'Enviar para conferência', FECHAR: 'Confirmar fechamento',
  DEVOLVER: 'Devolver para edição', REABRIR: 'Reabrir ficha',
};
const EVENTOS: Record<string, string> = {
  CRIAR: 'Registrou a ficha', ALTERAR: 'Alterou a ficha', CANCELAR: 'Cancelou a ficha',
  ENVIAR: 'Enviou para conferência', FECHAR: 'Fechou a ficha',
  DEVOLVER: 'Devolveu para edição', REABRIR: 'Reabriu a ficha', DIVERGENCIA: 'Sinalizou divergência financeira',
};

function situacao(ficha: Ficha): string {
  switch (ficha.situacao) {
    case 'FECHADA': return 'Fechada';
    case 'PRONTA': return 'Pronta para conferência';
    case 'CANCELADA': return 'Cancelada';
    default: return 'Em edição';
  }
}
const emEdicao = (ficha: Ficha) => !ficha.situacao || ficha.situacao === 'EM_EDICAO';
const classeSaldo = (valor: number) => (valor < 0 ? 'pf-money--neg' : 'pf-money--pos');

export default function ListaFichas() {
  const isMobile = useIsMobile();
  const nivel = useNivel();
  const todas = useFichas((s) => s.fichas);
  const despesas = useDespesas((s) => s.despesas);
  const unidades = useUnidades((s) => s.unidades);
  const manobristas = useManobristas((s) => s.manobristas);
  const anos = useMemo(() => anosDisponiveis(todas, despesas), [todas, despesas]);
  const podeEditar = podeAcessar(nivel, 'fichas/:id/editar');
  const [parametros] = useSearchParams();

  // Filtros iniciais podem vir da URL (ex.: "Ver fichas" de um manobrista).
  const [inicial] = useState(() => {
    const ref = periodoReferencia(todas);
    const idManobrista = Number(parametros.get('manobristaId'));
    const mes = parametros.has('mes') ? Number(parametros.get('mes')) : ref.mes;
    const ano = Number(parametros.get('ano'));
    const unidadeId = Number(parametros.get('unidadeId'));
    return {
      manobristaId: Number.isSafeInteger(idManobrista) && idManobrista > 0 ? idManobrista : null,
      mes: Number.isInteger(mes) && mes >= 0 && mes <= 12 ? mes : ref.mes,
      ano: anos.includes(ano) ? ano : ref.ano,
      unidadeId: unidades.some((u) => u.id === unidadeId) ? unidadeId : TODAS_UNIDADES,
    };
  });
  const [busca, setBusca] = useState('');
  const [mes, setMes] = useState(inicial.mes);
  const [ano, setAno] = useState(inicial.ano);
  const [unidadeId, setUnidadeId] = useState(inicial.unidadeId);
  const [manobristaId, setManobristaId] = useState<number | null>(inicial.manobristaId);

  const fichas = useMemo(
    () => filtrarFichas(todas, { mes, ano, unidadeId, busca }, (id) => nomeUnidade(unidades, id))
      .filter((ficha) => manobristaId === null || ficha.manobristas.some((linha) => linha.manobristaId === manobristaId)),
    [todas, mes, ano, unidadeId, busca, unidades, manobristaId],
  );
  const paginacao = usePaginar(fichas);
  const resumo = useMemo(() => resumirFichas(fichas), [fichas]);
  const custoManobrista = useMemo(
    () => calcTotalDiarias(fichas.flatMap((ficha) => ficha.manobristas.filter((linha) => linha.manobristaId === manobristaId))),
    [fichas, manobristaId],
  );

  const [detalhe, setDetalhe] = useState<Ficha | null>(null);
  const [paraExcluir, setParaExcluir] = useState<Ficha | null>(null);
  const [acao, setAcao] = useState<AcaoFicha | null>(null);
  const [justificativa, setJustificativa] = useState('');
  const [indicandoDivergencia, setIndicandoDivergencia] = useState(false);
  const [alterando, setAlterando] = useState(false);
  const [consultandoHistorico, setConsultandoHistorico] = useState(false);
  const [historico, setHistorico] = useState<RegistroFicha[] | null>(null);
  const detalheAtual = useRef<Ficha | null>(null);
  detalheAtual.current = detalhe;
  const focoEtapa = useRef<HTMLElement | null>(null);
  const acoesDaFicha = useRef<HTMLDivElement>(null);
  const [pedidoFoco, setPedidoFoco] = useState(0);

  // Leva o foco à etapa aberta (ou às ações) depois que ela aparece na tela.
  useEffect(() => {
    if (pedidoFoco) (focoEtapa.current ?? acoesDaFicha.current)?.focus();
  }, [pedidoFoco]);

  function abrirDetalhe(ficha: Ficha | null) {
    setDetalhe(ficha);
    setAcao(null);
    setIndicandoDivergencia(false);
    setJustificativa('');
    setHistorico(null);
  }

  // ?detalhe=ID abre a ficha (links das notificações e do painel).
  const idDetalhe = Number(parametros.get('detalhe'));
  useEffect(() => {
    if (!Number.isSafeInteger(idDetalhe) || idDetalhe <= 0) return;
    let ativo = true;
    fichasServico.detalhe(idDetalhe).then((f) => { if (ativo) abrirDetalhe(f); }).catch((e) => { if (ativo) avisos.erro(e); });
    return () => { ativo = false; };
  }, [idDetalhe]);

  function prepararAcao(etapa: AcaoFicha | 'DIVERGENCIA' | null) {
    setAcao(etapa === 'DIVERGENCIA' ? null : etapa);
    setIndicandoDivergencia(etapa === 'DIVERGENCIA');
    setJustificativa('');
    setPedidoFoco((n) => n + 1);
  }

  async function sinalizarDivergencia() {
    const motivo = justificativa.trim();
    if (!detalhe || !motivo || alterando) return;
    setAlterando(true);
    try {
      await notificacoesServico.divergencia(detalhe.id, motivo);
      prepararAcao(null);
      setHistorico(null);
      notificacoesServico.atualizarContador();
      avisos.sucesso('Divergência sinalizada.');
    } catch (erro) {
      avisos.erro(erro);
    } finally {
      setAlterando(false);
    }
  }

  async function registrarTransicao() {
    const ficha = detalhe;
    if (!ficha || !acao || alterando) return;
    setAlterando(true);
    try {
      const atual = await fichasServico.transicao(ficha.id, acao, justificativa.trim() || undefined);
      if (detalheAtual.current?.id === ficha.id) {
        abrirDetalhe(atual);
        setPedidoFoco((n) => n + 1);
      }
      avisos.sucesso('Situação da ficha atualizada.');
    } catch (erro) {
      avisos.erro(erro);
    } finally {
      setAlterando(false);
    }
  }

  async function consultarHistorico() {
    const ficha = detalhe;
    if (!ficha || consultandoHistorico) return;
    setConsultandoHistorico(true);
    try {
      const registros = await fichasServico.historico(ficha.id);
      if (detalheAtual.current === ficha) setHistorico(registros);
    } catch (erro) {
      avisos.erro(erro);
    } finally {
      setConsultandoHistorico(false);
    }
  }

  async function confirmarExclusao() {
    const ficha = paraExcluir;
    setParaExcluir(null);
    if (!ficha) return;
    try {
      await fichasServico.excluir(ficha.id);
      avisos.sucesso('Ficha cancelada.');
    } catch (erro) {
      avisos.erro(erro);
    }
  }

  function limparFiltros() {
    const ref = periodoReferencia(todas);
    setBusca('');
    setMes(ref.mes);
    setAno(ref.ano);
    setUnidadeId(TODAS_UNIDADES);
    setManobristaId(null);
  }

  /** Quebra do saldo usada no modal de detalhe. */
  const calculos = detalhe && {
    taxaDescontada: calcTaxaDescontada(detalhe.valorCartao, detalhe.taxaMaquininha),
    liquidoCartao: calcLiquidoCartao(detalhe.valorCartao, detalhe.taxaMaquininha),
    totalDiarias: calcTotalDiarias(detalhe.manobristas),
    totalDespesas: calcTotalDespesas(detalhe.despesasAdicionais),
  };
  const motivoObrigatorio = acao === 'DEVOLVER' || acao === 'REABRIR';
  const refEtapa = (el: HTMLElement | null) => { focoEtapa.current = el; };

  const acoesDetalhe = detalhe && (podeEditar || emEdicao(detalhe)) && (
    <div ref={acoesDaFicha} className="det__acoes" tabIndex={-1} role="group" aria-label="Ações da ficha">
      {indicandoDivergencia ? (
        <>
          <button type="button" className="pf-btn pf-btn--ghost" disabled={alterando} onClick={() => prepararAcao(null)}>Voltar</button>
          <button type="button" className="pf-btn pf-btn--primary" onClick={sinalizarDivergencia} disabled={alterando || !justificativa.trim()}>Sinalizar divergência</button>
        </>
      ) : acao ? (
        <>
          <button type="button" className="pf-btn pf-btn--ghost" disabled={alterando} onClick={() => prepararAcao(null)}>Voltar</button>
          <button type="button" className="pf-btn pf-btn--primary" onClick={registrarTransicao}
            disabled={alterando || (motivoObrigatorio && !justificativa.trim())}>{alterando ? 'Salvando…' : 'Confirmar'}</button>
        </>
      ) : (
        <>
          {podeEditar && <button type="button" className="pf-btn pf-btn--ghost" onClick={() => prepararAcao('DIVERGENCIA')}>Sinalizar divergência</button>}
          {emEdicao(detalhe) ? (
            <>
              {podeEditar && (
                <>
                  <button type="button" className="pf-btn pf-btn--ghost" onClick={() => { setParaExcluir(detalhe); abrirDetalhe(null); }}>Cancelar ficha</button>
                  <Link className="pf-btn pf-btn--ghost" to={`/app/fichas/${detalhe.id}/editar`}>Editar</Link>
                </>
              )}
              <button type="button" className="pf-btn pf-btn--primary" onClick={() => prepararAcao('ENVIAR')}>Enviar para conferência</button>
            </>
          ) : podeEditar && detalhe.situacao === 'PRONTA' ? (
            <>
              <button type="button" className="pf-btn pf-btn--ghost" onClick={() => prepararAcao('DEVOLVER')}>Devolver para edição</button>
              <button type="button" className="pf-btn pf-btn--primary" onClick={() => prepararAcao('FECHAR')}>Confirmar fechamento</button>
            </>
          ) : podeEditar && detalhe.situacao === 'FECHADA' ? (
            <button type="button" className="pf-btn pf-btn--ghost" onClick={() => prepararAcao('REABRIR')}>Reabrir ficha</button>
          ) : null}
        </>
      )}
    </div>
  );

  return (
    <pf-fichas-list>
      <div className="pf-page">
        <CabecalhoPagina titulo="Fichas" subtitulo={`${fichas.length}${fichas.length === 1 ? ' ficha encontrada' : ' fichas encontradas'}`}>
          <Link className="pf-btn pf-btn--primary" to="/app/fichas/nova">
            <Icone nome="plus" tamanho={17} />
            Nova ficha
          </Link>
        </CabecalhoPagina>

        {/* Filtros */}
        <div className="pf-filters">
          <input className="pf-input pf-filters__search" type="search" placeholder="Buscar unidade ou data..."
            value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar fichas" />
          <select className="pf-select" value={mes} onChange={(e) => setMes(+e.target.value)} aria-label="Mês">
            <option value={0}>Todos os meses</option>
            {MESES.map((nome, i) => <option key={nome} value={i + 1}>{nome}</option>)}
          </select>
          <select className="pf-select" value={ano} onChange={(e) => setAno(+e.target.value)} aria-label="Ano">
            {anos.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <select className="pf-select" value={unidadeId} onChange={(e) => setUnidadeId(+e.target.value)} aria-label="Unidade">
            <option value={TODAS_UNIDADES}>Todas as unidades</option>
            {unidades.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
          </select>
          <select className="pf-select" value={manobristaId ?? ''} onChange={(e) => setManobristaId(e.target.value === '' ? null : +e.target.value)} aria-label="Manobrista">
            <option value="">Todos os manobristas</option>
            {manobristas.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </select>
        </div>

        {manobristaId !== null && (
          <p className="det__nota">
            Custo registrado de {nomeManobrista(manobristas, manobristaId)} no período: {moeda(custoManobrista)}. Os indicadores abaixo mostram os totais das fichas filtradas.
          </p>
        )}

        {/* Resumo do período filtrado */}
        <section className="pf-grid-kpi">
          <CartaoKpi rotulo="Fichas" valor={numero(resumo.fichas)} />
          <CartaoKpi rotulo="Carros" valor={numero(resumo.carros)} />
          <CartaoKpi rotulo="Total bruto" valor={moeda(resumo.bruto)} />
          <CartaoKpi rotulo="Líquido" valor={moeda(resumo.liquido)} tom={resumo.liquido >= 0 ? 'success' : 'danger'} />
        </section>

        {/* Listagem */}
        {fichas.length === 0 ? (
          <div className="pf-card vazio">
            <p className="vazio__titulo">Nenhuma ficha neste período</p>
            <p className="vazio__texto">Ajuste os filtros ou lance a primeira ficha do mês.</p>
            <button type="button" className="pf-btn pf-btn--ghost" onClick={limparFiltros}>Limpar filtros</button>
          </div>
        ) : isMobile ? (
          <div className="cards">
            {paginacao.visiveis.map((ficha) => (
              <article key={ficha.id} className="pf-card card-ficha">
                <div className="card-ficha__info">
                  <button type="button" className="acao" onClick={() => abrirDetalhe(ficha)} aria-label={`Ver ficha de ${dataBr(ficha.data)}`}>
                    {dataBr(ficha.data)}
                  </button>
                  <p className="card-ficha__meta">{situacao(ficha)}</p>
                  <p className="card-ficha__meta">{nomeUnidade(unidades, ficha.unidadeId)} · {numero(ficha.totalCarros)} carros</p>
                </div>
                <p className={`card-ficha__valor ${classeSaldo(ficha.totalLiquido)}`}>{moeda(ficha.totalLiquido)}</p>
              </article>
            ))}
          </div>
        ) : (
          <div className="pf-card tabela">
            <div className="pf-table-wrap">
              <table className="pf-table">
                <thead>
                  <tr>
                    <th>Data</th><th>Unidade</th><th>Situação</th>
                    <th className="num">Carros</th><th className="num">Bruto</th><th className="num">Líquido</th>
                    <th className="actions">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {paginacao.visiveis.map((ficha) => (
                    <tr key={ficha.id}>
                      <td>{dataBr(ficha.data)}</td>
                      <td>{nomeUnidade(unidades, ficha.unidadeId)}</td>
                      <td>{situacao(ficha)}</td>
                      <td className="num">{numero(ficha.totalCarros)}</td>
                      <td className="num">{moeda(ficha.totalBruto)}</td>
                      <td className={`num ${classeSaldo(ficha.totalLiquido)}`}>{moeda(ficha.totalLiquido)}</td>
                      <td className="actions">
                        <button type="button" className="acao" onClick={() => abrirDetalhe(ficha)}>Ver</button>
                        {podeEditar && emEdicao(ficha) && (
                          <>
                            <Link className="acao" to={`/app/fichas/${ficha.id}/editar`}>Editar</Link>
                            <button type="button" className="acao acao--danger" onClick={() => setParaExcluir(ficha)}>Excluir</button>
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

      {/* Detalhe */}
      {detalhe && calculos && (
        <Modal largo titulo={`Ficha de ${dataBr(detalhe.data)}`} aoFechar={() => abrirDetalhe(null)} rodape={acoesDetalhe}>
          <dl className="det">
            <div className="det__linha"><dt>Unidade</dt><dd>{nomeUnidade(unidades, detalhe.unidadeId)}</dd></div>
            <div className="det__linha"><dt>Situação</dt><dd>{situacao(detalhe)}</dd></div>
            {detalhe.fechadoEm && <div className="det__linha"><dt>Fechada em</dt><dd>{dataHora(detalhe.fechadoEm, 'dd/MM/yyyy HH:mm', '-0300')}</dd></div>}
            {detalhe.valorInicialCaixa != null && <div className="det__linha"><dt>Caixa inicial</dt><dd>{moeda(detalhe.valorInicialCaixa)}</dd></div>}
            {detalhe.valorFinalCaixa != null && <div className="det__linha"><dt>Caixa final</dt><dd>{moeda(detalhe.valorFinalCaixa)}</dd></div>}
            <div className="det__linha"><dt>Turno</dt><dd>{detalhe.turno === 'dia' ? 'Dia' : 'Noite'}</dd></div>
            <div className="det__linha">
              <dt>Carros</dt>
              <dd>{numero(detalhe.totalCarros)} <span className="det__nota">({detalhe.fichaInicio} → {detalhe.fichaFim}, {detalhe.fichasCanceladas} canceladas)</span></dd>
            </div>
            <div className="det__sep" />
            <div className="det__linha"><dt>Dinheiro</dt><dd>{moeda(detalhe.valorDinheiro)}</dd></div>
            <div className="det__linha"><dt>Cartão</dt><dd>{moeda(detalhe.valorCartao)}</dd></div>
            <div className="det__linha"><dt>Pix</dt><dd>{moeda(detalhe.valorPix ?? 0)}</dd></div>
            <div className="det__linha det__linha--neg"><dt>Taxa da maquininha ({detalhe.taxaMaquininha}%)</dt><dd>− {moeda(calculos.taxaDescontada)}</dd></div>
            <div className="det__linha det__linha--neg"><dt>Custo da equipe ({detalhe.manobristas.length})</dt><dd>− {moeda(calculos.totalDiarias)}</dd></div>
            <div className="det__linha det__linha--neg"><dt>Despesas adicionais</dt><dd>− {moeda(calculos.totalDespesas)}</dd></div>
            <div className="det__sep" />
            <div className="det__linha det__linha--total">
              <dt>Saldo final</dt>
              <dd className={classeSaldo(detalhe.totalLiquido)}>{moeda(detalhe.totalLiquido)}</dd>
            </div>
          </dl>

          {detalhe.manobristas.length > 0 && (
            <>
              <p className="det__titulo">Equipe</p>
              <ul className="det__lista">
                {detalhe.manobristas.map((m) => (
                  <li key={m.manobristaId}>
                    <div>{nomeManobrista(manobristas, m.manobristaId)}<p className="det__nota">{MODALIDADES_CUSTO[m.modalidade ?? 'DIARIA_FIXA']}</p></div>
                    <span>{moeda(m.diaria)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}

          {detalhe.despesasAdicionais.length > 0 && (
            <>
              <p className="det__titulo">Despesas adicionais</p>
              <ul className="det__lista">
                {detalhe.despesasAdicionais.map((d, i) => <li key={`${d.descricao}-${i}`}><span>{d.descricao}</span><span>{moeda(d.valor)}</span></li>)}
              </ul>
            </>
          )}

          {detalhe.observacoes && (
            <>
              <p className="det__titulo">Observações</p>
              <p>{detalhe.observacoes}</p>
            </>
          )}

          {historico ? (
            <>
              <p className="det__titulo">Histórico</p>
              <ul className="det__lista">
                {historico.length ? historico.map((r, i) => (
                  <li key={i}>
                    <span>{r.ator} · {EVENTOS[r.acao]}{r.justificativa && ` (${r.justificativa})`}</span>
                    <span>{dataHora(r.registradoEm, 'dd/MM/yyyy HH:mm', '-0300')}</span>
                  </li>
                )) : <li>Sem alterações registradas.</li>}
              </ul>
            </>
          ) : (
            <button type="button" className="pf-btn pf-btn--ghost" disabled={consultandoHistorico} onClick={consultarHistorico}>
              {consultandoHistorico ? 'Carregando…' : 'Ver histórico'}
            </button>
          )}

          {indicandoDivergencia ? (
            <div className="pf-field det__etapa">
              <label className="pf-label" htmlFor="motivo-divergencia">Descreva a divergência encontrada</label>
              <textarea ref={refEtapa} className="pf-input" id="motivo-divergencia" rows={3} maxLength={500} required
                value={justificativa} onChange={(e) => setJustificativa(e.target.value)} />
              <p>A gestão autorizada receberá um alerta. Os valores da ficha serão preservados.</p>
            </div>
          ) : acao ? (
            <div className="pf-field det__etapa">
              <h3 ref={refEtapa} tabIndex={-1} className="det__titulo">{ROTULOS[acao]}</h3>
              {motivoObrigatorio ? (
                <>
                  <label className="pf-label" htmlFor="motivo-ficha">Motivo da correção</label>
                  <textarea className="pf-input" id="motivo-ficha" rows={3} maxLength={500} required
                    value={justificativa} onChange={(e) => setJustificativa(e.target.value)} />
                </>
              ) : acao === 'FECHAR' ? (
                <>
                  {detalhe.totalLiquido < 0 && (
                    <p className="det__saldo-alerta">A ficha tem saldo negativo de {moeda(detalhe.totalLiquido)}. Confira os recebimentos e os custos antes de fechar.</p>
                  )}
                  <p>O fechamento bloqueia alterações até que a ficha seja reaberta.</p>
                </>
              ) : (
                <p>A ficha ficará disponível para a conferência da gestão.</p>
              )}
            </div>
          ) : null}
        </Modal>
      )}

      {/* Exclusão */}
      {paraExcluir && (
        <Confirmar titulo="Cancelar ficha" rotuloConfirmar="Cancelar ficha"
          mensagem={`A ficha de ${dataBr(paraExcluir.data)} (${nomeUnidade(unidades, paraExcluir.unidadeId)}) ficará no histórico com a situação Cancelada.`}
          aoConfirmar={confirmarExclusao} aoCancelar={() => setParaExcluir(null)} />
      )}
    </pf-fichas-list>
  );
}
