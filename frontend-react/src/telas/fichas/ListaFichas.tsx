import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { BarraFiltros, FiltroPilula } from '../../compartilhado/BarraFiltros';
import { CabecalhoPagina } from '../../compartilhado/CabecalhoPagina';
import { CartaoKpi } from '../../compartilhado/CartaoKpi';
import { Confirmar } from '../../compartilhado/Confirmar';
import { Dica } from '../../compartilhado/Dica';
import { EstadoVazio } from '../../compartilhado/EstadoVazio';
import { dataBr, dataHora, moeda, numero } from '../../compartilhado/formatos';
import { Icone } from '../../compartilhado/Icone';
import { Modal } from '../../compartilhado/Modal';
import { pulso } from '../../compartilhado/movimento';
import { Paginacao, usePaginar } from '../../compartilhado/Paginacao';
import { IconeSituacao, Situacao } from '../../compartilhado/Situacao';
import { lerFiltro, useFiltrosUrl } from '../../compartilhado/useFiltrosUrl';
import { DicaContextual } from '../../layout/TourGuiado';
import { useNivel } from '../../nucleo/estado/auth';
import { avisos } from '../../nucleo/estado/aviso';
import { useDespesas } from '../../nucleo/estado/despesas';
import { anosDisponiveis, filtrarFichas, fichasServico, periodoReferencia, resumirFichas, useFichas } from '../../nucleo/estado/fichas';
import { useIsMobile } from '../../nucleo/estado/layout';
import { nomeManobrista, useManobristas } from '../../nucleo/estado/manobristas';
import { nomeUnidade, useUnidades } from '../../nucleo/estado/unidades';
import { AcaoFicha, Ficha, MODALIDADES_CUSTO, RegistroFicha, SituacaoFicha } from '../../nucleo/modelos';
import { calcLiquidoCartao, calcTaxaDescontada, calcTotalDespesas, calcTotalDiarias } from '../../nucleo/servicos/calc';
import { notificacoesServico } from '../../nucleo/servicos/notificacoes';
import { MESES, TODAS_UNIDADES } from '../../nucleo/servicos/periodo';
import { podeAcessar } from '../../nucleo/servicos/permissoes';
import { agruparFichas, diaCurto, GrupoFichas, ModoAgrupar, MODOS_AGRUPAR, situacaoDe } from './agrupar';
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
const SITUACOES: (SituacaoFicha | 'TODAS')[] = ['TODAS', 'PRONTA', 'EM_EDICAO', 'FECHADA', 'CANCELADA'];
const ROTULO_SITUACAO_FILTRO: Record<SituacaoFicha | 'TODAS', string> = {
  TODAS: 'Todas', PRONTA: 'Pronta para conferência', EM_EDICAO: 'Em edição', FECHADA: 'Fechada', CANCELADA: 'Cancelada',
};
const ROTULO_AGRUPAR: Record<ModoAgrupar, string> = { situacao: 'Situação', dia: 'Dia', nenhum: 'Sem grupos' };
const ETAPAS: { situacao: SituacaoFicha; rotulo: string }[] = [
  { situacao: 'EM_EDICAO', rotulo: 'Em edição' },
  { situacao: 'PRONTA', rotulo: 'Conferência' },
  { situacao: 'FECHADA', rotulo: 'Fechada' },
];

const emEdicao = (ficha: Ficha) => !ficha.situacao || ficha.situacao === 'EM_EDICAO';
const classeSaldo = (valor: number) => (valor < 0 ? 'pf-money--neg' : 'pf-money--pos');
const digitando = (alvo: EventTarget | null) => !!(alvo as HTMLElement | null)?.closest?.('input, textarea, select, [contenteditable]');

/** Faixa de tickets da ficha, como no talão: "#1000 → #1040". */
function Tickets({ ficha }: { ficha: Ficha }) {
  return (
    <span className="tickets">
      <span className="tickets__faixa">#{ficha.fichaInicio} → #{ficha.fichaFim}</span>
      {ficha.fichasCanceladas > 0 && <span className="tickets__canc">{ficha.fichasCanceladas} canc.</span>}
    </span>
  );
}

function Turno({ ficha }: { ficha: Ficha }) {
  const dia = ficha.turno === 'dia';
  return (
    <span className={`turno turno--${ficha.turno}`}>
      <Icone nome={dia ? 'dia' : 'noite'} tamanho={13} />
      {dia ? 'Dia' : 'Noite'}
    </span>
  );
}

export default function ListaFichas() {
  const isMobile = useIsMobile();
  const navegar = useNavigate();
  const nivel = useNivel();
  const todas = useFichas((s) => s.fichas);
  const despesas = useDespesas((s) => s.despesas);
  const unidades = useUnidades((s) => s.unidades);
  const manobristas = useManobristas((s) => s.manobristas);
  const anos = useMemo(() => anosDisponiveis(todas, despesas), [todas, despesas]);
  const podeEditar = podeAcessar(nivel, 'fichas/:id/editar');
  const podeLancar = podeAcessar(nivel, 'fichas/nova');
  const [parametros, setParametros] = useSearchParams();
  const referencia = useMemo(() => periodoReferencia(todas), [todas]);

  // Filtros na URL: o link copiado abre a mesma lista.
  const filtros = useFiltrosUrl({
    busca: { padrao: '', ler: lerFiltro.texto },
    mes: { padrao: referencia.mes, ler: lerFiltro.inteiro(0, 12) },
    ano: { padrao: referencia.ano, ler: (b: string) => { const n = Number(b); return anos.includes(n) ? n : undefined; } },
    unidadeId: { padrao: TODAS_UNIDADES, ler: (b: string) => { const n = Number(b); return unidades.some((u) => u.id === n) ? n : undefined; } },
    manobristaId: { padrao: null as number | null, ler: lerFiltro.idOuNulo },
    situacao: { padrao: 'TODAS' as SituacaoFicha | 'TODAS', ler: lerFiltro.opcao(SITUACOES) },
    agrupar: { padrao: 'situacao' as ModoAgrupar, ler: lerFiltro.opcao(MODOS_AGRUPAR) },
  });
  const { busca, mes, ano, unidadeId, manobristaId, situacao, agrupar } = filtros.valores;
  const filtrosAtivos = filtros.ativos - (agrupar !== 'situacao' ? 1 : 0);

  const fichas = useMemo(
    () => filtrarFichas(todas, { mes, ano, unidadeId, busca }, (id) => nomeUnidade(unidades, id))
      .filter((ficha) => manobristaId === null || ficha.manobristas.some((linha) => linha.manobristaId === manobristaId))
      .filter((ficha) => situacao === 'TODAS' || situacaoDe(ficha) === situacao),
    [todas, mes, ano, unidadeId, busca, unidades, manobristaId, situacao],
  );
  const grupos = useMemo(() => agruparFichas(fichas, agrupar), [fichas, agrupar]);
  const ordenadas = useMemo(() => grupos.flatMap((g) => g.fichas), [grupos]);
  const paginacao = usePaginar(ordenadas);
  const resumo = useMemo(() => resumirFichas(fichas), [fichas]);
  const custoManobrista = useMemo(
    () => calcTotalDiarias(fichas.flatMap((ficha) => ficha.manobristas.filter((linha) => linha.manobristaId === manobristaId))),
    [fichas, manobristaId],
  );

  // Grupos da página atual (o cabeçalho mostra o total do grupo inteiro).
  const gruposDaPagina = useMemo(() => {
    const visiveis = new Set(paginacao.visiveis.map((f) => f.id));
    return grupos.map((g) => ({ ...g, fichasPagina: g.fichas.filter((f) => visiveis.has(f.id)) })).filter((g) => g.fichasPagina.length);
  }, [grupos, paginacao.visiveis]);

  const [recolhidos, setRecolhidos] = useState<Set<string>>(new Set());
  const alternarGrupo = (chave: string) => setRecolhidos((r) => {
    const novo = new Set(r);
    if (novo.has(chave)) novo.delete(chave); else novo.add(chave);
    return novo;
  });
  const navegaveis = useMemo(
    () => gruposDaPagina.flatMap((g) => (recolhidos.has(g.chave) ? [] : g.fichasPagina)),
    [gruposDaPagina, recolhidos],
  );

  const [cursor, setCursor] = useState<number | null>(null);
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
  const seloSituacao = useRef<HTMLDivElement>(null);
  const lista = useRef<HTMLDivElement>(null);
  const [pedidoFoco, setPedidoFoco] = useState(0);

  // Leva o foco à etapa aberta (ou às ações) depois que ela aparece na tela.
  useEffect(() => {
    if (pedidoFoco) (focoEtapa.current ?? acoesDaFicha.current)?.focus();
  }, [pedidoFoco]);

  const abrirDetalhe = useCallback((ficha: Ficha | null) => {
    setDetalhe(ficha);
    setAcao(null);
    setIndicandoDivergencia(false);
    setJustificativa('');
    setHistorico(null);
    // ?detalhe=ID na URL: o link da ficha aberta pode ser compartilhado.
    setParametros((p) => {
      const novos = new URLSearchParams(p);
      if (ficha) novos.set('detalhe', String(ficha.id)); else novos.delete('detalhe');
      return novos;
    }, { replace: true });
  }, [setParametros]);

  // ?detalhe=ID abre a ficha (links das notificações, do painel e da paleta de comandos).
  const idDetalhe = Number(parametros.get('detalhe'));
  useEffect(() => {
    if (!Number.isSafeInteger(idDetalhe) || idDetalhe <= 0 || detalheAtual.current?.id === idDetalhe) return;
    let ativo = true;
    fichasServico.detalhe(idDetalhe).then((f) => { if (ativo) abrirDetalhe(f); }).catch((e) => { if (ativo) avisos.erro(e); });
    return () => { ativo = false; };
  }, [idDetalhe, abrirDetalhe]);

  // Atalhos da lista: J/K percorrem, Enter abre, N cria (estilo Linear). No detalhe, J/K trocam de ficha.
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || digitando(e.target) || paraExcluir) return;
      const tecla = e.key.toLowerCase();
      if (detalheAtual.current) {
        if (tecla !== 'j' && tecla !== 'k') return;
        if (acao || indicandoDivergencia) return;
        const i = navegaveis.findIndex((f) => f.id === detalheAtual.current?.id);
        const proxima = navegaveis[i + (tecla === 'j' ? 1 : -1)];
        if (proxima) { e.preventDefault(); setCursor(navegaveis.indexOf(proxima)); abrirDetalhe(proxima); }
        return;
      }
      if (document.querySelector('[role=dialog]')) return;
      if (tecla === 'j' || tecla === 'arrowdown') {
        if (tecla === 'arrowdown' && cursor === null) return;
        e.preventDefault();
        setCursor((c) => Math.min((c ?? -1) + 1, navegaveis.length - 1));
      } else if (tecla === 'k' || (tecla === 'arrowup' && cursor !== null)) {
        e.preventDefault();
        setCursor((c) => Math.max((c ?? 1) - 1, 0));
      } else if (tecla === 'enter' && cursor !== null && navegaveis[cursor]) {
        e.preventDefault();
        abrirDetalhe(navegaveis[cursor]);
      } else if (tecla === 'escape' && cursor !== null) {
        setCursor(null);
      } else if (tecla === 'n' && podeLancar) {
        e.preventDefault();
        navegar('/app/fichas/nova');
      }
    };
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [navegaveis, cursor, acao, indicandoDivergencia, paraExcluir, podeLancar, navegar, abrirDetalhe]);

  useEffect(() => setCursor(null), [fichas, paginacao.pagina]);
  useEffect(() => {
    if (cursor === null) return;
    lista.current?.querySelector<HTMLElement>(`[data-cursor="${cursor}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

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
        requestAnimationFrame(() => { if (seloSituacao.current) pulso(seloSituacao.current); });
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

  /** Quebra do saldo usada no detalhe. */
  const calculos = detalhe && {
    taxaDescontada: calcTaxaDescontada(detalhe.valorCartao, detalhe.taxaMaquininha),
    liquidoCartao: calcLiquidoCartao(detalhe.valorCartao, detalhe.taxaMaquininha),
    totalDiarias: calcTotalDiarias(detalhe.manobristas),
    totalDespesas: calcTotalDespesas(detalhe.despesasAdicionais),
  };
  const motivoObrigatorio = acao === 'DEVOLVER' || acao === 'REABRIR';
  const refEtapa = (el: HTMLElement | null) => { focoEtapa.current = el; };
  const indiceDetalhe = detalhe ? navegaveis.findIndex((f) => f.id === detalhe.id) : -1;

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
          {podeEditar && <button type="button" className="pf-btn pf-btn--quiet" onClick={() => prepararAcao('DIVERGENCIA')}>Sinalizar divergência</button>}
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

  const opcoesMes = [{ valor: 0, rotulo: 'Todos os meses' }, ...MESES.map((nome, i) => ({ valor: i + 1, rotulo: nome }))];
  const opcoesUnidade = [{ valor: TODAS_UNIDADES, rotulo: 'Todas' }, ...unidades.map((u) => ({ valor: u.id, rotulo: u.nome }))];
  const textoResultado = `${fichas.length}${fichas.length === 1 ? ' ficha encontrada' : ' fichas encontradas'}`;

  const cabecalhoGrupo = (grupo: GrupoFichas) => {
    const aberto = !recolhidos.has(grupo.chave);
    return (
      <button type="button" className="grupo-cab" aria-expanded={aberto} onClick={() => alternarGrupo(grupo.chave)}>
        <Icone nome="abrir" tamanho={14} className={`grupo-cab__seta${aberto ? '' : ' grupo-cab__seta--fechada'}`} />
        {grupo.situacao && <IconeSituacao tipo={grupo.situacao} />}
        <span className="grupo-cab__titulo">{grupo.titulo}</span>
        <span className="grupo-cab__contador">{grupo.fichas.length}</span>
        <span className="grupo-cab__resumo">
          {numero(grupo.resumo.carros)} carros · <span className={classeSaldo(grupo.resumo.liquido)}>{moeda(grupo.resumo.liquido)}</span>
        </span>
      </button>
    );
  };

  const seletorAgrupar = (
    <FiltroPilula rotulo="Agrupar" icone="ajustes" valor={agrupar} padrao="situacao"
      opcoes={MODOS_AGRUPAR.map((m) => ({ valor: m, rotulo: ROTULO_AGRUPAR[m] }))} aoMudar={(v) => filtros.definir({ agrupar: v })} />
  );

  let indiceNavegavel = -1;

  return (
    <pf-fichas-list>
      <div className="pf-page">
        <CabecalhoPagina sobretitulo="Operação" titulo="Fichas" subtitulo="Controle de veículos e caixa por turno: tickets, cancelamentos, recebimentos e equipe.">
          {!isMobile && <pf-barra-filtros className="no-cabecalho">{seletorAgrupar}</pf-barra-filtros>}
          {podeLancar && (
            <Dica texto="Lançar uma nova ficha" atalho="N" lado="bottom">
              <Link className="pf-btn pf-btn--primary" to="/app/fichas/nova" data-tour="nova-ficha">
                <Icone nome="plus" tamanho={17} />
                Nova ficha
              </Link>
            </Dica>
          )}
        </CabecalhoPagina>

        <DicaContextual id="fichas" />

        <div data-tour="filtros-fichas">
          <BarraFiltros busca={busca} aoBuscar={(texto) => filtros.definir({ busca: texto })} placeholder="Buscar unidade ou data…"
            ativos={filtrosAtivos} aoLimpar={() => filtros.definir({ busca: '', mes: referencia.mes, ano: referencia.ano, unidadeId: TODAS_UNIDADES, manobristaId: null, situacao: 'TODAS' })}
            resultado={textoResultado}>
            <FiltroPilula rotulo="Mês" icone="eventos" valor={mes} padrao={referencia.mes} opcoes={opcoesMes} aoMudar={(v) => filtros.definir({ mes: v })} />
            <FiltroPilula rotulo="Ano" valor={ano} padrao={referencia.ano} opcoes={anos.map((a) => ({ valor: a, rotulo: String(a) }))} aoMudar={(v) => filtros.definir({ ano: v })} />
            <FiltroPilula rotulo="Unidade" icone="unidades" valor={unidadeId} padrao={TODAS_UNIDADES} opcoes={opcoesUnidade} aoMudar={(v) => filtros.definir({ unidadeId: v })} />
            <FiltroPilula rotulo="Situação" valor={situacao} padrao="TODAS"
              opcoes={SITUACOES.map((s) => ({ valor: s, rotulo: ROTULO_SITUACAO_FILTRO[s] }))} aoMudar={(v) => filtros.definir({ situacao: v })} />
            <FiltroPilula rotulo="Manobrista" icone="manobristas" valor={manobristaId ?? 0} padrao={0}
              opcoes={[{ valor: 0, rotulo: 'Todos' }, ...manobristas.map((m) => ({ valor: m.id, rotulo: m.nome }))]}
              aoMudar={(v) => filtros.definir({ manobristaId: v || null })} />
            {isMobile && seletorAgrupar}
          </BarraFiltros>
        </div>

        {manobristaId !== null && (
          <p className="nota-manobrista">
            <Icone nome="info" tamanho={15} />
            Custo registrado de <strong>{nomeManobrista(manobristas, manobristaId)}</strong> no período: <strong>{moeda(custoManobrista)}</strong>. Os indicadores mostram os totais das fichas filtradas.
          </p>
        )}

        {/* Resumo do período filtrado */}
        <section className="pf-grid-kpi">
          <CartaoKpi rotulo="Fichas" icone="fichas" valor={numero(resumo.fichas)} numero={resumo.fichas} formato={numero} />
          <CartaoKpi rotulo="Carros" icone="carros" valor={numero(resumo.carros)} numero={resumo.carros} formato={numero} />
          <CartaoKpi rotulo="Total bruto" icone="dinheiro" valor={moeda(resumo.bruto)} numero={resumo.bruto} formato={moeda} />
          <CartaoKpi rotulo="Líquido" icone="tendencia" valor={moeda(resumo.liquido)} numero={resumo.liquido} formato={moeda} tom={resumo.liquido >= 0 ? 'success' : 'danger'} />
        </section>

        {/* Listagem */}
        <div ref={lista} className="lista" data-tour="lista-fichas">
          {fichas.length === 0 ? (
            todas.length === 0 ? (
              <EstadoVazio ilustracao="fichas" titulo="Nenhuma ficha lançada ainda"
                texto="As fichas registram o caixa de cada turno: numeração dos tickets, cancelados, recebimentos e a equipe.">
                {podeLancar && <Link className="pf-btn pf-btn--primary" to="/app/fichas/nova"><Icone nome="plus" tamanho={16} />Lançar a primeira ficha</Link>}
              </EstadoVazio>
            ) : (
              <EstadoVazio ilustracao="busca" titulo="Nenhuma ficha com esses filtros"
                texto={busca ? `Nada encontrado para “${busca}” no período.` : 'Não há fichas neste período com os filtros escolhidos.'}>
                <button type="button" className="pf-btn pf-btn--ghost" onClick={filtros.limpar}>Limpar filtros</button>
                {podeLancar && <Link className="pf-btn pf-btn--primary" to="/app/fichas/nova"><Icone nome="plus" tamanho={16} />Nova ficha</Link>}
              </EstadoVazio>
            )
          ) : isMobile ? (
            <div className="cards">
              {gruposDaPagina.map((grupo) => (
                <section key={grupo.chave} className="grupo-m">
                  {agrupar !== 'nenhum' && cabecalhoGrupo(grupo)}
                  {!recolhidos.has(grupo.chave) && grupo.fichasPagina.map((ficha) => (
                    <button key={ficha.id} type="button" className="card-ficha" data-entrada-linha
                      onClick={() => abrirDetalhe(ficha)}>
                      <span className="card-ficha__topo">
                        <span className="card-ficha__data">{dataBr(ficha.data)} <small>{diaCurto(ficha.data)}</small></span>
                        <span className={`card-ficha__valor ${classeSaldo(ficha.totalLiquido)}`}>{moeda(ficha.totalLiquido)}</span>
                      </span>
                      <span className="card-ficha__meta">
                        {nomeUnidade(unidades, ficha.unidadeId)} · <Turno ficha={ficha} />
                      </span>
                      <span className="card-ficha__rodape">
                        <Tickets ficha={ficha} />
                        <span className="card-ficha__carros">{numero(ficha.totalCarros)} carros</span>
                      </span>
                      {agrupar !== 'situacao' && <Situacao tipo={ficha.situacao} />}
                    </button>
                  ))}
                </section>
              ))}
            </div>
          ) : (
            <div className="pf-card tabela">
              <div className="pf-table-wrap">
                <table className="pf-table pf-table--fichas">
                  <thead>
                    <tr>
                      <th>Data</th><th>Unidade</th><th className="col-secundaria">Turno</th><th>Tickets</th>
                      <th className="num">Carros</th><th className="num col-secundaria">Bruto</th><th className="num">Líquido</th>
                      {agrupar !== 'situacao' && <th>Situação</th>}
                      <th className="actions"><span className="pf-sr-only">Ações</span></th>
                    </tr>
                  </thead>
                  {gruposDaPagina.map((grupo) => (
                    <tbody key={grupo.chave}>
                      {agrupar !== 'nenhum' && (
                        <tr className="linha-grupo"><th colSpan={agrupar !== 'situacao' ? 9 : 8} scope="colgroup">{cabecalhoGrupo(grupo)}</th></tr>
                      )}
                      {!recolhidos.has(grupo.chave) && grupo.fichasPagina.map((ficha) => {
                        indiceNavegavel += 1;
                        const i = indiceNavegavel;
                        return (
                          <tr key={ficha.id} data-cursor={i}
                            className={`linha-ficha${cursor === i ? ' linha-ficha--cursor' : ''}${detalhe?.id === ficha.id ? ' linha-ficha--aberta' : ''}${situacaoDe(ficha) === 'CANCELADA' ? ' linha-ficha--cancelada' : ''}`}
                            onClick={(e) => { if (!(e.target as HTMLElement).closest('a, button')) { setCursor(i); abrirDetalhe(ficha); } }}>
                            <td>
                              <span className="data">{dataBr(ficha.data)}</span>
                              <span className="data__dia">{diaCurto(ficha.data)}</span>
                            </td>
                            <td>{nomeUnidade(unidades, ficha.unidadeId)}</td>
                            <td className="col-secundaria"><Turno ficha={ficha} /></td>
                            <td><Tickets ficha={ficha} /></td>
                            <td className="num">{numero(ficha.totalCarros)}</td>
                            <td className="num col-secundaria">{moeda(ficha.totalBruto)}</td>
                            <td className={`num ${classeSaldo(ficha.totalLiquido)}`}>{moeda(ficha.totalLiquido)}</td>
                            {agrupar !== 'situacao' && <td><Situacao tipo={ficha.situacao} estilo="texto" /></td>}
                            <td className="actions">
                              <span className="acoes-linha">
                                <button type="button" className="acao" onClick={() => { setCursor(i); abrirDetalhe(ficha); }}>Ver</button>
                                {podeEditar && emEdicao(ficha) && (
                                  <>
                                    <Link className="acao" to={`/app/fichas/${ficha.id}/editar`}>Editar</Link>
                                    <button type="button" className="acao acao--danger" onClick={() => setParaExcluir(ficha)}>Excluir</button>
                                  </>
                                )}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  ))}
                </table>
              </div>
              <p className="atalhos" aria-hidden="true">
                <kbd>J</kbd><kbd>K</kbd> navegar · <kbd>Enter</kbd> abrir · <kbd>/</kbd> buscar{podeLancar && <> · <kbd>N</kbd> nova ficha</>}
              </p>
            </div>
          )}
        </div>
        <Paginacao pagina={paginacao.pagina} paginas={paginacao.paginas} aoSelecionar={paginacao.setPagina} />
      </div>

      {/* Detalhe: painel lateral (desktop) ou folha (celular) */}
      {detalhe && calculos && (
        <Modal variante="lateral" titulo={`Ficha de ${dataBr(detalhe.data)}`}
          subtitulo={<>{nomeUnidade(unidades, detalhe.unidadeId)} · Turno {detalhe.turno === 'dia' ? 'dia' : 'noite'}</>}
          aoFechar={() => abrirDetalhe(null)} rodape={acoesDetalhe}
          cabecalho={!isMobile && indiceDetalhe >= 0 && (
            <>
              <Dica texto="Ficha anterior" atalho="K" lado="bottom">
                <button type="button" className="sheet__nav" aria-label="Ficha anterior" disabled={indiceDetalhe <= 0}
                  onClick={() => { const f = navegaveis[indiceDetalhe - 1]; setCursor(indiceDetalhe - 1); abrirDetalhe(f); }}>
                  <Icone nome="abrir" tamanho={17} className="seta-cima" />
                </button>
              </Dica>
              <Dica texto="Próxima ficha" atalho="J" lado="bottom">
                <button type="button" className="sheet__nav" aria-label="Próxima ficha" disabled={indiceDetalhe >= navegaveis.length - 1}
                  onClick={() => { const f = navegaveis[indiceDetalhe + 1]; setCursor(indiceDetalhe + 1); abrirDetalhe(f); }}>
                  <Icone nome="abrir" tamanho={17} />
                </button>
              </Dica>
            </>
          )}>
          <pf-ficha-detalhe>
            {/* Etapas do fluxo da ficha */}
            <div ref={seloSituacao} className="fluxo" aria-label={`Situação: ${ROTULO_SITUACAO_FILTRO[situacaoDe(detalhe)]}`}>
              {situacaoDe(detalhe) === 'CANCELADA' ? (
                <Situacao tipo="CANCELADA" />
              ) : ETAPAS.map((etapa, i) => {
                const atual = ETAPAS.findIndex((e) => e.situacao === situacaoDe(detalhe));
                return (
                  <span key={etapa.situacao} className={`fluxo__etapa${i < atual ? ' fluxo__etapa--feita' : ''}${i === atual ? ' fluxo__etapa--atual' : ''}`}>
                    <IconeSituacao tipo={i <= atual ? (i === atual ? etapa.situacao : 'FECHADA') : 'EM_EDICAO'} tamanho={15} />
                    {etapa.rotulo}
                  </span>
                );
              })}
            </div>

            <div className="talao" aria-label="Tickets do turno">
              <div className="talao__bloco">
                <span className="talao__rotulo">Ticket inicial</span>
                <span className="talao__valor">#{detalhe.fichaInicio}</span>
              </div>
              <Icone nome="seta" tamanho={18} className="talao__seta" />
              <div className="talao__bloco">
                <span className="talao__rotulo">Ticket final</span>
                <span className="talao__valor">#{detalhe.fichaFim}</span>
              </div>
              <div className="talao__picote" aria-hidden="true" />
              <div className="talao__bloco talao__bloco--total">
                <span className="talao__rotulo">Carros</span>
                <span className="talao__valor">{numero(detalhe.totalCarros)}</span>
                <span className="talao__nota">{detalhe.fichasCanceladas} cancelado{detalhe.fichasCanceladas === 1 ? '' : 's'}</span>
              </div>
            </div>

            <dl className="det">
              <div className="det__linha"><dt>Situação</dt><dd>{ROTULO_SITUACAO_FILTRO[situacaoDe(detalhe)]}</dd></div>
              {detalhe.fechadoEm && <div className="det__linha"><dt>Fechada em</dt><dd>{dataHora(detalhe.fechadoEm, 'dd/MM/yyyy HH:mm', '-0300')}</dd></div>}
              {detalhe.valorInicialCaixa != null && <div className="det__linha"><dt>Caixa inicial</dt><dd>{moeda(detalhe.valorInicialCaixa)}</dd></div>}
              {detalhe.valorFinalCaixa != null && <div className="det__linha"><dt>Caixa final</dt><dd>{moeda(detalhe.valorFinalCaixa)}</dd></div>}
            </dl>

            <p className="det__titulo">Caixa</p>
            <dl className="det det--caixa">
              <div className="det__linha"><dt><Icone nome="dinheiro" tamanho={15} />Dinheiro</dt><dd>{moeda(detalhe.valorDinheiro)}</dd></div>
              <div className="det__linha"><dt><Icone nome="cartao" tamanho={15} />Cartão</dt><dd>{moeda(detalhe.valorCartao)}</dd></div>
              <div className="det__linha"><dt><Icone nome="pix" tamanho={15} />Pix</dt><dd>{moeda(detalhe.valorPix ?? 0)}</dd></div>
              <div className="det__sep" />
              <div className="det__linha det__linha--neg"><dt>Taxa da maquininha ({detalhe.taxaMaquininha}%)</dt><dd>− {moeda(calculos.taxaDescontada)}</dd></div>
              <div className="det__linha det__linha--neg"><dt>Custo da equipe ({detalhe.manobristas.length})</dt><dd>− {moeda(calculos.totalDiarias)}</dd></div>
              <div className="det__linha det__linha--neg"><dt>Despesas adicionais</dt><dd>− {moeda(calculos.totalDespesas)}</dd></div>
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
                <p className="det__obs">{detalhe.observacoes}</p>
              </>
            )}

            {historico ? (
              <>
                <p className="det__titulo">Histórico</p>
                <ol className="linha-tempo">
                  {historico.length ? historico.map((r, i) => (
                    <li key={i}>
                      <span className="linha-tempo__ponto" aria-hidden="true" />
                      <span className="linha-tempo__texto"><strong>{r.ator}</strong> · {EVENTOS[r.acao] ?? r.acao}{r.justificativa && ` (${r.justificativa})`}</span>
                      <span className="linha-tempo__quando">{dataHora(r.registradoEm, 'dd/MM/yyyy HH:mm', '-0300')}</span>
                    </li>
                  )) : <li className="linha-tempo__vazio">Sem alterações registradas.</li>}
                </ol>
              </>
            ) : (
              <button type="button" className="pf-btn pf-btn--ghost pf-btn--sm det__historico" disabled={consultandoHistorico} onClick={consultarHistorico}>
                <Icone nome="historico" tamanho={15} />
                {consultandoHistorico ? 'Carregando…' : 'Ver histórico'}
              </button>
            )}

            {indicandoDivergencia ? (
              <div className="pf-field det__etapa">
                <label className="pf-label" htmlFor="motivo-divergencia">Descreva a divergência encontrada</label>
                <textarea ref={refEtapa} className="pf-input" id="motivo-divergencia" rows={3} maxLength={500} required
                  value={justificativa} onChange={(e) => setJustificativa(e.target.value)} />
                <p className="det__ajuda">A gestão autorizada receberá um alerta. Os valores da ficha serão preservados.</p>
              </div>
            ) : acao ? (
              <div className="pf-field det__etapa">
                <h3 ref={refEtapa} tabIndex={-1} className="det__etapa-titulo">{ROTULOS[acao]}</h3>
                {motivoObrigatorio ? (
                  <>
                    <label className="pf-label" htmlFor="motivo-ficha">Motivo da correção</label>
                    <textarea className="pf-input" id="motivo-ficha" rows={3} maxLength={500} required
                      value={justificativa} onChange={(e) => setJustificativa(e.target.value)} />
                  </>
                ) : acao === 'FECHAR' ? (
                  <>
                    {detalhe.totalLiquido < 0 && (
                      <p className="det__saldo-alerta"><Icone nome="alerta" tamanho={16} />A ficha tem saldo negativo de {moeda(detalhe.totalLiquido)}. Confira os recebimentos e os custos antes de fechar.</p>
                    )}
                    <p className="det__ajuda">O fechamento bloqueia alterações até que a ficha seja reaberta.</p>
                  </>
                ) : (
                  <p className="det__ajuda">A ficha ficará disponível para a conferência da gestão.</p>
                )}
              </div>
            ) : null}
          </pf-ficha-detalhe>
        </Modal>
      )}

      {/* Cancelamento */}
      {paraExcluir && (
        <Confirmar titulo="Cancelar ficha" rotuloConfirmar="Cancelar ficha"
          mensagem={`A ficha de ${dataBr(paraExcluir.data)} (${nomeUnidade(unidades, paraExcluir.unidadeId)}) ficará no histórico com a situação Cancelada.`}
          aoConfirmar={confirmarExclusao} aoCancelar={() => setParaExcluir(null)} />
      )}
    </pf-fichas-list>
  );
}
