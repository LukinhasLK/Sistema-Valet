import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CabecalhoPagina } from '../../compartilhado/CabecalhoPagina';
import { Calendario } from '../../compartilhado/Calendario';
import { CartaoKpi } from '../../compartilhado/CartaoKpi';
import { dataBr, dataHora, moeda, numero } from '../../compartilhado/formatos';
import { Modal } from '../../compartilhado/Modal';
import { avisos } from '../../nucleo/estado/aviso';
import { useIsMobile } from '../../nucleo/estado/layout';
import { useManobristas } from '../../nucleo/estado/manobristas';
import { useUnidades } from '../../nucleo/estado/unidades';
import { ErroHttp, mensagemDeErro } from '../../nucleo/servicos/api';
import {
  Aba, Candidato, Confirmacao, Diaria, FiltroPagamentos, Forma, Pagamento, pagamentosServico, Pendencia, Resumo, Situacao,
} from '../../nucleo/servicos/pagamentos-manobristas';
import { MESES } from '../../nucleo/servicos/periodo';
import { Icone } from '../../compartilhado/Icone';
import { PixManobrista } from './PixManobrista';
import { reduzido } from '../../compartilhado/movimento';
import { PerdidinhoDiz } from '../../compartilhado/perdidinho/PerdidinhoDiz';
import { EstadoVazio } from '../../compartilhado/EstadoVazio';
import { CampoSelecao } from '../../compartilhado/CampoSelecao';
import './pagamentos-manobristas.scss';

const FILTRO_INICIAL: FiltroPagamentos = { inicio: '', fim: '', manobristaId: 0, unidadeId: 0, busca: '', situacao: '' };
const ABAS: { id: Aba; nome: string }[] = [
  { id: 'diarias', nome: 'Diárias a pagar' },
  { id: 'conferencia', nome: 'Conferir fichas' },
  { id: 'historico', nome: 'Histórico' },
];
const FORMAS: Record<Forma, string> = { PIX: 'Pix', DINHEIRO: 'Dinheiro', TRANSFERENCIA: 'Transferência bancária', OUTRA: 'Outra' };
const OPCOES_FORMA = Object.keys(FORMAS) as Forma[];
const SITUACOES: Record<Situacao, { nome: string; cor: string }> = {
  PENDENTE: { nome: 'Pendente', cor: 'orange' },
  PAGO: { nome: 'Pago', cor: 'green' },
  ESTORNADO: { nome: 'Estornado', cor: 'gray' },
};
/** Hoje no horário de São Paulo (AAAA-MM-DD). */
const HOJE = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' }).format(new Date());

type Dialogo =
  | { tipo: 'conferencia'; candidato: Candidato }
  | { tipo: 'pix'; id: number; nome: string }
  | { tipo: 'pagamento'; diarias: Diaria[] }
  | { tipo: 'historico' | 'estorno'; pagamento: Pagamento }
  | { tipo: 'anular'; diaria: Diaria };

const totalCentavos = (diarias: Diaria[]) => diarias.reduce((total, item) => total + Math.round(item.saldo * 100), 0);
/** Valor monetário digitado (aceita vírgula) com até duas casas e maior que zero. */
function decimal(entrada: string): string | null {
  const valor = entrada.trim().replace(',', '.');
  return /^\d{1,14}(\.\d{1,2})?$/.test(valor) && Number(valor) > 0 ? valor : null;
}
const classeSituacaoPagamento = (p: Pagamento) => `pf-badge ${p.estornadoEm ? 'pf-badge--gray' : 'pf-badge--green'}`;

export default function PagamentosManobristas() {
  const [parametros] = useSearchParams();
  const manobristas = useManobristas((s) => s.manobristas);
  const unidades = useUnidades((s) => s.unidades);
  const mobile = useIsMobile();

  const [aba, setAba] = useState<Aba>(() => (parametros.get('aba') === 'historico' ? 'historico' : 'diarias'));
  const [pagina, setPagina] = useState(0);
  const [tamanho, setTamanho] = useState(15);
  const [total, setTotal] = useState(0);
  const ultimaPagina = Math.max(1, Math.ceil(total / tamanho));
  const [diarias, setDiarias] = useState<Diaria[]>([]);
  const [candidatos, setCandidatos] = useState<Candidato[]>([]);
  const [historico, setHistorico] = useState<Pagamento[]>([]);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [selecao, setSelecao] = useState<Diaria[]>([]);
  const soma = totalCentavos(selecao) / 100;
  const [dialogo, setDialogo] = useState<Dialogo | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erroDialogo, setErroDialogo] = useState('');
  const [tentativa, setTentativa] = useState<{ dados: Confirmacao; arquivo: File | null } | null>(null);
  const [filtroAtual, setFiltroAtual] = useState<FiltroPagamentos>(() => ({
    ...FILTRO_INICIAL, manobristaId: Number(parametros.get('manobristaId')) || 0,
  }));
  /** Campos do formulário de filtros (só valem ao aplicar). */
  const [filtro, setFiltro] = useState<FiltroPagamentos>(filtroAtual);
  const [valor, setValor] = useState('');
  const [dataPagamento, setDataPagamento] = useState(HOJE);
  const [forma, setForma] = useState<Forma>('PIX');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [motivo, setMotivo] = useState('');
  const [dataMinima, setDataMinima] = useState('');
  const requisicao = useRef(0);
  const ocupadoRef = useRef(false);

  const nomeFiltrado = manobristas.find((m) => m.id === filtroAtual.manobristaId)?.nome;

  /** Saldo pendente agrupado por manobrista (soma em centavos para não acumular erro). */
  const saldosPorPessoa = useMemo(() => {
    const pessoas = new Map<number, { id: number; nome: string; centavos: number; unidades: Pendencia[] }>();
    for (const linha of resumo?.pendencias ?? []) {
      const pessoa = pessoas.get(linha.manobristaId) ?? { id: linha.manobristaId, nome: linha.manobrista, centavos: 0, unidades: [] };
      pessoa.centavos += Math.round(linha.saldo * 100);
      pessoa.unidades.push(linha);
      pessoas.set(pessoa.id, pessoa);
    }
    return Array.from(pessoas.values());
  }, [resumo]);

  async function carregar(f: FiltroPagamentos = filtroAtual, a: Aba = aba, p: number = pagina): Promise<void> {
    const id = ++requisicao.current;
    setCarregando(true);
    setErro('');
    try {
      if (f.inicio && f.fim && f.inicio > f.fim) {
        setErro('A data final deve ser igual ou posterior à inicial.');
        return;
      }
      let novoTotal = 0;
      let novoTamanho = tamanho;
      if (a === 'diarias') {
        const [dados, r] = await Promise.all([pagamentosServico.listar<Diaria>(a, f, p), pagamentosServico.resumo(f)]);
        if (id !== requisicao.current) return;
        setDiarias(dados.itens);
        setResumo(r);
        novoTotal = dados.total;
        novoTamanho = dados.tamanho;
      } else if (a === 'conferencia') {
        const dados = await pagamentosServico.listar<Candidato>(a, f, p);
        if (id !== requisicao.current) return;
        setCandidatos(dados.itens);
        novoTotal = dados.total;
        novoTamanho = dados.tamanho;
      } else {
        const dados = await pagamentosServico.listar<Pagamento>(a, f, p);
        if (id !== requisicao.current) return;
        setHistorico(dados.itens);
        novoTotal = dados.total;
        novoTamanho = dados.tamanho;
      }
      setTotal(novoTotal);
      setTamanho(novoTamanho);
      // A página atual sumiu (ex.: depois de pagar a última diária dela): volta para a última existente.
      const ultima = Math.max(1, Math.ceil(novoTotal / novoTamanho));
      if (p >= ultima) {
        setPagina(ultima - 1);
        void carregar(f, a, ultima - 1);
      }
    } catch (e) {
      if (id === requisicao.current) setErro(mensagemDeErro(e, 'Não foi possível carregar os pagamentos.'));
    } finally {
      if (id === requisicao.current) setCarregando(false);
    }
  }

  function aplicar(novoFiltro: FiltroPagamentos = filtro, novaAba: Aba = aba) {
    setFiltro(novoFiltro);
    setFiltroAtual({ ...novoFiltro });
    setSelecao([]);
    setPagina(0);
    void carregar({ ...novoFiltro }, novaAba, 0);
  }

  function trocarAba(nova: Aba) {
    if (aba === nova) return;
    setAba(nova);
    aplicar({ ...filtro, situacao: '' }, nova);
  }

  const limparFiltros = () => aplicar({ ...FILTRO_INICIAL });
  const verDiarias = (id: number, unidade: number) => aplicar({ ...filtroAtual, manobristaId: id, unidadeId: unidade, situacao: '' });

  function irPara(nova: number) {
    if (nova < 0 || nova >= ultimaPagina || carregando) return;
    setPagina(nova);
    void carregar(filtroAtual, aba, nova);
  }

  function abrir(novo: Dialogo) {
    setErroDialogo('');
    setDialogo(novo);
  }
  const abrirHistorico = (pagamento: Pagamento) => abrir({ tipo: 'historico', pagamento });

  async function executar(acao: () => Promise<void>) {
    if (ocupadoRef.current) return;
    ocupadoRef.current = true;
    setOcupado(true);
    setErroDialogo('');
    try {
      await acao();
    } catch (e) {
      setErroDialogo(mensagemDeErro(e));
    } finally {
      ocupadoRef.current = false;
      setOcupado(false);
    }
  }

  async function consultarPagamento(id: number) {
    if (ocupadoRef.current) return;
    ocupadoRef.current = true;
    setOcupado(true);
    try {
      abrirHistorico(await pagamentosServico.detalhar(id));
    } catch (e) {
      avisos.erro(e);
    } finally {
      ocupadoRef.current = false;
      setOcupado(false);
    }
  }

  // Carga inicial e ?detalhe=ID (links das notificações) abrindo o pagamento no histórico.
  const idDetalhe = Number(parametros.get('detalhe'));
  useEffect(() => {
    if (Number.isSafeInteger(idDetalhe) && idDetalhe > 0) {
      setAba('historico');
      void carregar(filtroAtual, 'historico', 0);
      void consultarPagamento(idDetalhe);
    } else {
      void carregar();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idDetalhe]);

  const selecionada = (d: Diaria) => selecao.some((item) => item.id === d.id);
  const podeSelecionar = (d: Diaria) => d.saldo > 0 && (selecionada(d) || (selecao.length < 100
    && (!selecao.length || selecao[0].manobristaId === d.manobristaId)));
  function selecionar(d: Diaria) {
    if (!podeSelecionar(d)) return;
    setSelecao((itens) => (itens.some((i) => i.id === d.id) ? itens.filter((i) => i.id !== d.id) : [...itens, d]));
  }

  function abrirConferencia(candidato: Candidato) {
    setValor(candidato.custo.toFixed(2).replace('.', ','));
    abrir({ tipo: 'conferencia', candidato });
  }

  function reconhecer(evento: FormEvent, candidato: Candidato) {
    evento.preventDefault();
    const v = decimal(valor);
    if (!v) return;
    void executar(async () => {
      await pagamentosServico.reconhecer(candidato, v);
      setDialogo(null);
      avisos.sucesso('Diária reconhecida e disponível para pagamento.');
      await carregar();
    });
  }

  function abrirPagamento(lista: Diaria[] = selecao) {
    if (!lista.length) return;
    setTentativa(null);
    setArquivo(null);
    setForma('PIX');
    setValor('');
    setDataPagamento(HOJE);
    setDataMinima(lista.reduce((maior, d) => (d.data > maior ? d.data : maior), ''));
    abrir({ tipo: 'pagamento', diarias: lista });
  }

  /** Atalho de "Quem falta pagar": seleciona as diárias pendentes listadas da pessoa e abre a revisão. */
  const pendentesDe = (manobristaId: number) => diarias.filter((d) => d.manobristaId === manobristaId && d.saldo > 0).slice(0, 100);
  function pagarPessoa(manobristaId: number) {
    const lista = pendentesDe(manobristaId);
    setSelecao(lista);
    abrirPagamento(lista);
  }

  function anexar(input: HTMLInputElement) {
    setErroDialogo('');
    const escolhido = input.files?.[0] ?? null;
    if (escolhido && (escolhido.size > 2 * 1024 * 1024 || !escolhido.name.toLowerCase().endsWith('.pdf'))) {
      setArquivo(null);
      input.value = '';
      setErroDialogo('Escolha um PDF de até 2 MB.');
      return;
    }
    setArquivo(escolhido);
  }

  async function confirmarPagamento(evento: FormEvent, lista: Diaria[]) {
    evento.preventDefault();
    if (ocupadoRef.current) return;
    // Reenvio usa exatamente o mesmo registro (mesma "operacao"): o servidor não duplica o pagamento.
    const envio = tentativa ?? {
      dados: {
        operacao: globalThis.crypto.randomUUID(), manobristaId: lista[0].manobristaId,
        diarias: lista.map(({ id, revisao }) => ({ id, revisao })), data: dataPagamento,
        forma, efetuado: true as const, valor: (totalCentavos(lista) / 100).toFixed(2),
      },
      arquivo,
    };
    ocupadoRef.current = true;
    setOcupado(true);
    setErroDialogo('');
    try {
      const pagamento = await pagamentosServico.confirmar(envio.dados, envio.arquivo);
      setTentativa(null);
      abrirHistorico(pagamento);
      setSelecao([]);
      avisos.sucesso('Pagamento registrado.');
      await carregar();
    } catch (e) {
      if (!(e instanceof ErroHttp) || e.status === 0 || e.status >= 500) {
        // Sem resposta confiável: guarda o envio para reenviar o mesmo registro.
        setTentativa(envio);
        setErroDialogo('O servidor não confirmou a resposta. Tente enviar o mesmo registro novamente.');
      } else {
        setTentativa(null);
        setErroDialogo(mensagemDeErro(e));
      }
    } finally {
      ocupadoRef.current = false;
      setOcupado(false);
    }
  }

  function verHistoricoDoManobrista(manobristaId: number) {
    setDialogo(null);
    setAba('historico');
    aplicar({ ...FILTRO_INICIAL, manobristaId }, 'historico');
  }

  function abrirEstorno(pagamento: Pagamento) {
    setMotivo('');
    abrir({ tipo: 'estorno', pagamento });
  }

  function anular(evento: FormEvent, diaria: Diaria) {
    evento.preventDefault();
    if (!motivo.trim()) return;
    void executar(async () => {
      await pagamentosServico.anular(diaria.id, motivo.trim());
      setDialogo(null);
      setSelecao((lista) => lista.filter((d) => d.id !== diaria.id));
      avisos.sucesso('Diária anulada. A ficha pode ser corrigida e a diária reconhecida de novo na conferência.');
      await carregar();
    });
  }

  function estornar(evento: FormEvent, pagamento: Pagamento) {
    evento.preventDefault();
    if (!motivo.trim()) return;
    void executar(async () => {
      abrirHistorico(await pagamentosServico.estornar(pagamento.id, motivo.trim()));
      setSelecao([]);
      avisos.sucesso('Estorno registrado. As diárias voltaram ao saldo pendente.');
      await carregar();
    });
  }

  function baixar(pagamento: Pagamento) {
    void executar(async () => {
      const url = URL.createObjectURL(await pagamentosServico.comprovante(pagamento.id));
      const link = document.createElement('a');
      link.href = url;
      link.download = `comprovante-${pagamento.id}.pdf`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  }

  const fechar = () => { if (!ocupadoRef.current) setDialogo(null); };
  const alterarFiltro = (mudanca: Partial<FiltroPagamentos>) => setFiltro((f) => ({ ...f, ...mudanca }));

  const acoesDiaria = (d: Diaria) => (
    <div className="acoes">
      <button type="button" className="pf-btn pf-btn--ghost" onClick={() => abrir({ tipo: 'pix', id: d.manobristaId, nome: d.manobrista })}
        aria-label={`Chave Pix de ${d.manobrista}`}>Pix</button>
      {d.situacao === 'PENDENTE' && (
        <button type="button" className="pf-btn pf-btn--ghost perigo" onClick={() => { setMotivo(''); abrir({ tipo: 'anular', diaria: d }); }}
          aria-label={`Anular diária de ${d.manobrista} em ${dataBr(d.data)}`}>Anular</button>
      )}
      {d.pagamentoId
        ? <button type="button" className="pf-btn pf-btn--ghost" disabled={ocupado} onClick={() => consultarPagamento(d.pagamentoId!)}>Pagamento</button>
        : <button type="button" className="pf-btn pf-btn--ghost" onClick={() => verHistoricoDoManobrista(d.manobristaId)}>Histórico</button>}
    </div>
  );
  const rotuloSelecao = (d: Diaria) => `Selecionar diária de ${d.manobrista} em ${dataBr(d.data)}, ficha ${d.fichaId}`;
  const badgeSituacao = (s: Situacao) => <span className={`pf-badge pf-badge--${SITUACOES[s].cor}`}>{SITUACOES[s].nome}</span>;

  return (
    <pf-pagamentos-manobristas>
      <div className="pf-page pagamentos">
        <CabecalhoPagina titulo="Pagamentos de Manobristas" subtitulo="Confira as diárias e registre os pagamentos da equipe.">
          <Link className="pf-btn pf-btn--ghost" to="/app/manobristas">Cadastro de manobristas</Link>
        </CabecalhoPagina>

        <nav className="abas" aria-label="Áreas de pagamentos">
          {ABAS.map((item) => (
            <button key={item.id} type="button" className={`pf-btn ${aba === item.id ? 'pf-btn--dark' : 'pf-btn--ghost'}`}
              aria-pressed={aba === item.id} onClick={() => trocarAba(item.id)}>{item.nome}</button>
          ))}
        </nav>

        <form className="pf-card filtros" onSubmit={(e) => { e.preventDefault(); aplicar(); }} aria-label="Filtros de pagamentos">
          <div className="pf-field busca">
            <label htmlFor="pg-busca" className="pf-label">Buscar pelo nome</label>
            <input id="pg-busca" name="busca" type="search" className="pf-input" maxLength={100} value={filtro.busca} onChange={(e) => alterarFiltro({ busca: e.target.value })} />
          </div>
          <div className="pf-field">
            <label htmlFor="pg-manobrista" className="pf-label">Manobrista</label>
            <CampoSelecao id="pg-manobrista" name="manobrista" className="pf-select" value={filtro.manobristaId} onChange={(e) => alterarFiltro({ manobristaId: +e.target.value })}>
              <option value={0}>Todos</option>
              {manobristas.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
            </CampoSelecao>
          </div>
          <div className="pf-field">
            <label htmlFor="pg-unidade" className="pf-label">Unidade</label>
            <CampoSelecao id="pg-unidade" name="unidade" className="pf-select" value={filtro.unidadeId} onChange={(e) => alterarFiltro({ unidadeId: +e.target.value })}>
              <option value={0}>Todas</option>
              {unidades.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </CampoSelecao>
          </div>
          <div className="pf-field">
            <label htmlFor="pg-inicio" className="pf-label">Início</label>
            <Calendario><input id="pg-inicio" name="inicio" type="date" className="pf-input" value={filtro.inicio} onChange={(e) => alterarFiltro({ inicio: e.target.value })} /></Calendario>
          </div>
          <div className="pf-field">
            <label htmlFor="pg-fim" className="pf-label">Fim</label>
            <Calendario><input id="pg-fim" name="fim" type="date" className="pf-input" min={filtro.inicio} value={filtro.fim} onChange={(e) => alterarFiltro({ fim: e.target.value })} /></Calendario>
          </div>
          {aba !== 'conferencia' && (
            <div className="pf-field">
              <label htmlFor="pg-situacao" className="pf-label">Situação</label>
              <CampoSelecao id="pg-situacao" name="situacao" className="pf-select" value={filtro.situacao} onChange={(e) => alterarFiltro({ situacao: e.target.value as Situacao | '' })}>
                <option value="">Todas</option>
                {aba === 'diarias' && <option value="PENDENTE">Pendente</option>}
                <option value="PAGO">Pago</option>
                <option value="ESTORNADO">Estornado</option>
              </CampoSelecao>
            </div>
          )}
          <div className="acoes">
            <button type="submit" className="pf-btn pf-btn--dark">Aplicar filtros</button>
            <button type="button" className="pf-btn pf-btn--ghost" onClick={limparFiltros}>Limpar</button>
          </div>
        </form>

        {nomeFiltrado && (
          <div className="contexto acoes">
            <button type="button" className="pf-btn pf-btn--ghost" onClick={() => abrir({ tipo: 'pix', id: filtroAtual.manobristaId, nome: nomeFiltrado })}>
              Chave Pix de {nomeFiltrado}
            </button>
          </div>
        )}

        <section aria-label="Resultados de pagamentos" aria-busy={carregando}>
          {carregando ? (
            <div className="pf-card estado" role="status">Carregando pagamentos…</div>
          ) : erro ? (
            <div className="pf-card estado">
              <p className="pf-error" role="alert">{erro}</p>
              <button type="button" className="pf-btn pf-btn--ghost" onClick={() => carregar()}>Atualizar resultados</button>
            </div>
          ) : (
            <>
              {aba === 'diarias' && (
                <>
                  {resumo && (
                    <div className="pf-grid-kpi kpis" aria-label="Resumo financeiro">
                      <CartaoKpi rotulo="Total a pagar" icone="relogio" valor={moeda(resumo.aPagar)} numero={resumo.aPagar} formato={moeda} tom="accent" dica="Por data de trabalho" />
                      <CartaoKpi rotulo="Total pago" icone="sucesso" valor={moeda(resumo.pago)} numero={resumo.pago} formato={moeda} tom="success" dica="Por data de pagamento" />
                      <CartaoKpi rotulo="Manobristas pendentes" icone="manobristas" valor={numero(resumo.manobristasPendentes)} numero={resumo.manobristasPendentes} formato={numero} />
                      <CartaoKpi rotulo="Pagamentos realizados" icone="pagamentos" valor={numero(resumo.pagamentos)} numero={resumo.pagamentos} formato={numero} />
                    </div>
                  )}
                  <section className="pf-card saldos-pessoa" aria-label="Saldo a receber por manobrista" data-tour="pagamentos">
                    <header className="pf-card__head">
                      <h2 className="pf-card__title">Quem falta pagar</h2>
                      <p className="pf-card__subtitle">Pague pelo seu banco usando a chave Pix e confirme aqui. O sistema não faz transferências.</p>
                    </header>
                    <div className="pf-card__body">
                      {saldosPorPessoa.length ? saldosPorPessoa.map((p) => (
                        <article key={p.id}>
                          <div className="linha-card__head pessoa">
                            <span className="pessoa__nome"><strong>{p.nome}</strong><span className="pessoa__valor">{moeda(p.centavos / 100)} pendente</span></span>
                            <span className="pessoa__acoes">
                              <button type="button" className="pf-btn pf-btn--ghost pf-btn--sm" onClick={() => abrir({ tipo: 'pix', id: p.id, nome: p.nome })}
                                aria-label={`Chave Pix de ${p.nome}`}><Icone nome="pix" tamanho={15} />Chave Pix</button>
                              {pendentesDe(p.id).length > 0 && (
                                <button type="button" className="pf-btn pf-btn--primary pf-btn--sm" onClick={() => pagarPessoa(p.id)}
                                  aria-label={`Pagar ${p.nome}: revisar e confirmar pagamento`}><Icone nome="pagamentos" tamanho={15} />Pagar</button>
                              )}
                            </span>
                          </div>
                          {p.unidades.map((u) => (
                            <div key={u.unidadeId} className="saldo-unidade">
                              <span>{u.unidade} · {u.diarias} {u.diarias === 1 ? 'diária' : 'diárias'}</span>
                              <span>{moeda(u.saldo)}</span>
                              <button type="button" className="pf-link-btn" onClick={() => verDiarias(p.id, u.unidadeId)}
                                aria-label={`Ver diárias de ${p.nome} em ${u.unidade}`}>Ver diárias</button>
                            </div>
                          ))}
                        </article>
                      )) : <div className="tudo-pago" role="status"><PerdidinhoDiz humor="feliz" tamanho={48} reduzirMovimento={reduzido()} titulo="Nenhuma diária a pagar" texto="As diárias reconhecidas já foram todas pagas." /></div>}
                    </div>
                  </section>
                  <div className="pf-card selecao">
                    {selecao.length ? (
                      <>
                        <p aria-live="polite"><strong>{selecao[0].manobrista}</strong> · {selecao.length} diária(s) · <strong>{moeda(soma)}</strong></p>
                        <div className="acoes">
                          <button type="button" className="pf-btn pf-btn--ghost" onClick={() => setSelecao([])}>Limpar seleção</button>
                          <button type="button" className="pf-btn pf-btn--primary" onClick={() => abrirPagamento()}>Revisar pagamento</button>
                        </div>
                      </>
                    ) : <p>Selecione as diárias de um manobrista para registrar o pagamento.</p>}
                  </div>
                  {diarias.length ? (
                    mobile ? (
                      <div className="lista-cards">
                        {diarias.map((d) => (
                          <article key={d.id} className="pf-card linha-card">
                            <div className="linha-card__head">
                              <label className="check">
                                <input type="checkbox" checked={selecionada(d)} disabled={!podeSelecionar(d)} onChange={() => selecionar(d)} aria-label={rotuloSelecao(d)} />
                                <strong>{d.manobrista}</strong>
                              </label>
                              {badgeSituacao(d.situacao)}
                            </div>
                            <p className="muted">{d.unidade} · {dataBr(d.data)} · Ficha #{d.fichaId}</p>
                            <dl className="valores-mobile">
                              <div><dt>Devido</dt><dd>{moeda(d.devido)}</dd></div>
                              <div><dt>Pago</dt><dd>{moeda(d.pago)}</dd></div>
                              <div><dt>Saldo</dt><dd>{moeda(d.saldo)}</dd></div>
                            </dl>
                            {d.dataPagamento && <p className="muted">Pagamento em {dataBr(d.dataPagamento)}</p>}
                            {acoesDiaria(d)}
                          </article>
                        ))}
                      </div>
                    ) : (
                      <div className="pf-card tabela"><div className="pf-table-wrap" tabIndex={0} role="region" aria-label="Tabela de diárias">
                        <table className="pf-table">
                          <thead><tr>
                            <th scope="col">Seleção</th><th scope="col">Manobrista</th><th scope="col">Unidade e trabalho</th>
                            <th scope="col" className="num">Devido</th><th scope="col" className="num">Pago</th><th scope="col" className="num">Saldo</th>
                            <th scope="col">Situação</th><th scope="col">Ações</th>
                          </tr></thead>
                          <tbody>
                            {diarias.map((d) => (
                              <tr key={d.id}>
                                <td><input type="checkbox" checked={selecionada(d)} disabled={!podeSelecionar(d)} onChange={() => selecionar(d)} aria-label={rotuloSelecao(d)} /></td>
                                <td><strong>{d.manobrista}</strong></td>
                                <td>{d.unidade}<span className="subtexto">{dataBr(d.data)} · Ficha #{d.fichaId}</span></td>
                                <td className="num">{moeda(d.devido)}</td>
                                <td className="num">{moeda(d.pago)}</td>
                                <td className="num"><strong>{moeda(d.saldo)}</strong></td>
                                <td>{badgeSituacao(d.situacao)}{d.dataPagamento && <span className="subtexto">{dataBr(d.dataPagamento)}</span>}</td>
                                <td>{acoesDiaria(d)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div></div>
                    )
                  ) : (
                    <EstadoVazio ilustracao="busca" titulo="Nenhuma diária encontrada" texto="Ajuste os filtros ou confira as novas fichas para reconhecer um saldo.">
                      <button type="button" className="pf-btn pf-btn--ghost" onClick={() => trocarAba('conferencia')}>Conferir fichas</button>
                    </EstadoVazio>
                  )}
                </>
              )}

              {aba === 'conferencia' && (
                <>
                  <p className="orientacao">Confira as diárias das fichas elegíveis antes de incluí-las no saldo a pagar. O custo registrado na ficha fica preservado.</p>
                  {candidatos.length && mobile ? (
                    <div className="lista-cards">
                      {candidatos.map((c) => (
                        <article key={`${c.fichaId}-${c.manobristaId}`} className="pf-card linha-card">
                          <div className="linha-card__head"><strong>{c.manobrista}</strong><strong>{moeda(c.custo)}</strong></div>
                          <p className="muted">{c.unidade} · {dataBr(c.data)} · {c.turno === 'DIA' ? 'Dia' : 'Noite'} · Ficha #{c.fichaId}</p>
                          <div className="acoes"><button type="button" className="pf-btn pf-btn--ghost" onClick={() => abrirConferencia(c)}>Conferir</button></div>
                        </article>
                      ))}
                    </div>
                  ) : candidatos.length ? (
                    <div className="pf-card tabela"><div className="pf-table-wrap" tabIndex={0} role="region" aria-label="Fichas para conferência">
                      <table className="pf-table">
                        <thead><tr><th scope="col">Manobrista</th><th scope="col">Unidade e trabalho</th><th scope="col" className="num">Custo na ficha</th>
                          <th scope="col" className="actions">Ações</th></tr></thead>
                        <tbody>
                          {candidatos.map((c) => (
                            <tr key={`${c.fichaId}-${c.manobristaId}`}>
                              <td><strong>{c.manobrista}</strong></td>
                              <td>{c.unidade}<span className="subtexto">{dataBr(c.data)} · {c.turno === 'DIA' ? 'Dia' : 'Noite'} · Ficha #{c.fichaId}</span></td>
                              <td className="num">{moeda(c.custo)}</td>
                              <td className="actions"><button type="button" className="pf-btn pf-btn--ghost" onClick={() => abrirConferencia(c)}>Conferir</button></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div></div>
                  ) : (
                    <EstadoVazio ilustracao="tudo-certo" titulo="Nenhuma ficha para conferir" texto="As novas fichas elegíveis com diárias lançadas aparecem aqui.">
                      <Link className="pf-btn pf-btn--ghost" to="/app/fichas">Ver fichas</Link>
                    </EstadoVazio>
                  )}
                </>
              )}

              {aba === 'historico' && (
                historico.length && mobile ? (
                  <div className="lista-cards">
                    {historico.map((p) => (
                      <article key={p.id} className="pf-card linha-card">
                        <div className="linha-card__head">
                          <strong>{p.manobrista}</strong>
                          <span className={classeSituacaoPagamento(p)}>{p.estornadoEm ? 'Estornado' : 'Pago'}</span>
                        </div>
                        <p className="muted">{dataBr(p.data)} · {FORMAS[p.forma]} · Pagamento #{p.id}</p>
                        <div className="linha-card__head">
                          <strong>{moeda(p.valor)}</strong>
                          <button type="button" className="pf-btn pf-btn--ghost" onClick={() => abrirHistorico(p)}>Detalhes</button>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : historico.length ? (
                  <div className="pf-card tabela"><div className="pf-table-wrap" tabIndex={0} role="region" aria-label="Histórico de pagamentos">
                    <table className="pf-table">
                      <thead><tr><th scope="col">Manobrista</th><th scope="col">Data</th><th scope="col">Forma</th><th scope="col" className="num">Valor</th>
                        <th scope="col">Situação</th><th scope="col" className="actions">Ações</th></tr></thead>
                      <tbody>
                        {historico.map((p) => (
                          <tr key={p.id}>
                            <td><strong>{p.manobrista}</strong><span className="subtexto">Pagamento #{p.id} · {p.itens.length} diária(s)</span></td>
                            <td>{dataBr(p.data)}</td>
                            <td>{FORMAS[p.forma]}</td>
                            <td className="num">{moeda(p.valor)}</td>
                            <td><span className={classeSituacaoPagamento(p)}>{p.estornadoEm ? 'Estornado' : 'Pago'}</span></td>
                            <td className="actions"><button type="button" className="pf-btn pf-btn--ghost" onClick={() => abrirHistorico(p)}>Detalhes</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div></div>
                ) : (
                  <EstadoVazio ilustracao="busca" titulo="Nenhum pagamento encontrado" texto="Os pagamentos registrados aparecem aqui, inclusive os estornados." />
                )
              )}

              {ultimaPagina > 1 && (
                <nav className="paginacao" aria-label="Páginas de resultados">
                  <button type="button" className="pf-btn pf-btn--ghost" disabled={pagina === 0} onClick={() => irPara(pagina - 1)}>Anterior</button>
                  <span aria-live="polite">Página {pagina + 1} de {ultimaPagina}</span>
                  <button type="button" className="pf-btn pf-btn--ghost" disabled={pagina + 1 === ultimaPagina} onClick={() => irPara(pagina + 1)}>Próxima</button>
                </nav>
              )}

              {aba === 'diarias' && resumo && (
                <div className="detalhamento">
                  <section className="pf-card tabela">
                    <header className="pf-card__head"><h2 className="pf-card__title">Por unidade</h2></header>
                    {resumo.unidades.length ? (
                      <div className="pf-table-wrap"><table className="pf-table"><thead><tr>
                        <th scope="col">Unidade</th><th scope="col" className="num">A pagar</th><th scope="col" className="num">Pago</th>
                      </tr></thead><tbody>
                        {resumo.unidades.map((u) => <tr key={u.unidade}><td>{u.unidade}</td><td className="num">{moeda(u.aPagar)}</td><td className="num">{moeda(u.pago)}</td></tr>)}
                      </tbody></table></div>
                    ) : <p className="pf-card__body muted">Sem valores para os filtros aplicados.</p>}
                  </section>
                  <section className="pf-card tabela">
                    <header className="pf-card__head"><h2 className="pf-card__title">Por mês</h2></header>
                    {resumo.meses.length ? (
                      <div className="pf-table-wrap"><table className="pf-table"><thead><tr>
                        <th scope="col">Mês</th><th scope="col" className="num">A pagar</th><th scope="col" className="num">Pago</th>
                      </tr></thead><tbody>
                        {resumo.meses.map((m) => (
                          <tr key={m.ano * 100 + m.mes}><td>{MESES[m.mes - 1]} {m.ano}</td><td className="num">{moeda(m.aPagar)}</td><td className="num">{moeda(m.pago)}</td></tr>
                        ))}
                      </tbody></table></div>
                    ) : <p className="pf-card__body muted">Sem valores para o período.</p>}
                  </section>
                </div>
              )}
            </>
          )}
        </section>
      </div>

      {dialogo?.tipo === 'pix' && (
        <Modal titulo={dialogo.nome} aoFechar={fechar}>
          <PixManobrista manobristaId={dialogo.id} />
        </Modal>
      )}

      {dialogo?.tipo === 'conferencia' && (
        <Modal titulo="Reconhecer diária" aoFechar={fechar}>
          <form className="dialogo" onSubmit={(e) => reconhecer(e, dialogo.candidato)}>
            <p><strong>{dialogo.candidato.manobrista}</strong><br />
              {dialogo.candidato.unidade} · {dataBr(dialogo.candidato.data)} · Ficha #{dialogo.candidato.fichaId}</p>
            <p>Custo registrado na ficha <strong>{moeda(dialogo.candidato.custo)}</strong></p>
            <div className="pf-field">
              <label className="pf-label" htmlFor="valor-devido">Valor devido (R$)</label>
              <input id="valor-devido" name="valor" className="pf-input" type="text" inputMode="decimal" maxLength={13}
                value={valor} onChange={(e) => setValor(e.target.value)} disabled={ocupado} required />
            </div>
            <p className="muted">Ao confirmar, a diária passa a compor o saldo a pagar.</p>
            {erroDialogo && <p className="pf-error" role="alert">{erroDialogo}</p>}
            <div className="acoes fim">
              <button type="button" className="pf-btn pf-btn--ghost" onClick={fechar} disabled={ocupado}>Cancelar</button>
              <button type="submit" className="pf-btn pf-btn--primary" disabled={ocupado || !decimal(valor)}>{ocupado ? 'Salvando…' : 'Reconhecer diária'}</button>
            </div>
          </form>
        </Modal>
      )}

      {dialogo?.tipo === 'pagamento' && (
        <Modal titulo="Registrar pagamento" aoFechar={fechar}>
          <form className="dialogo" onSubmit={(e) => confirmarPagamento(e, dialogo.diarias)}>
            <p><strong>{dialogo.diarias[0].manobrista}</strong></p>
            <ul className="itens" aria-label="Diárias selecionadas">
              {dialogo.diarias.map((d) => (
                <li key={d.id}><span>{d.unidade} · {dataBr(d.data)} · Ficha #{d.fichaId}</span><strong>{moeda(d.saldo)}</strong></li>
              ))}
            </ul>
            <div className="total"><span>Total a pagar</span><strong>{moeda(totalCentavos(dialogo.diarias) / 100)}</strong></div>
            {forma === 'PIX' && <PixManobrista manobristaId={dialogo.diarias[0].manobristaId} />}
            <details>
              <summary>Data, forma de pagamento e comprovante</summary>
              <fieldset disabled={ocupado || tentativa !== null}>
                <div className="campos-pagamento">
                  <div className="pf-field">
                    <label className="pf-label" htmlFor="data-pg">Data do pagamento</label>
                    <Calendario><input className="pf-input" id="data-pg" name="data" type="date" min={dataMinima} max={HOJE} required
                      value={dataPagamento} onChange={(e) => setDataPagamento(e.target.value)} /></Calendario>
                  </div>
                  <div className="pf-field">
                    <label className="pf-label" htmlFor="forma-pg">Forma</label>
                    <CampoSelecao className="pf-select" id="forma-pg" name="forma" value={forma} onChange={(e) => setForma(e.target.value as Forma)}>
                      {OPCOES_FORMA.map((f) => <option key={f} value={f}>{FORMAS[f]}</option>)}
                    </CampoSelecao>
                  </div>
                </div>
                <div className="pf-field">
                  <label className="pf-label" htmlFor="arquivo-pg">Comprovante opcional (PDF, até 2 MB)</label>
                  <input className="pf-input arquivo" id="arquivo-pg" type="file" accept="application/pdf,.pdf" onChange={(e) => anexar(e.target)} />
                </div>
              </fieldset>
            </details>
            <p className="muted">Pagamento em {dataBr(dataPagamento)} por {FORMAS[forma]}.</p>
            {erroDialogo && <p className="pf-error" role="alert">{erroDialogo}</p>}
            <div className="acoes fim">
              <button type="button" className="pf-btn pf-btn--ghost" onClick={fechar} disabled={ocupado}>Fechar</button>
              <button type="submit" className="pf-btn pf-btn--primary"
                disabled={ocupado || (!tentativa && (!dataPagamento || dataPagamento < dataMinima || dataPagamento > HOJE))}>
                {ocupado ? 'Registrando…' : tentativa ? 'Reenviar confirmação' : 'Já paguei · confirmar'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {dialogo?.tipo === 'historico' && (() => {
        const p = dialogo.pagamento;
        return (
          <Modal titulo={`Pagamento #${p.id}`} aoFechar={fechar}>
            <div className="dialogo">
              <div className="total"><strong>{p.manobrista}</strong><strong>{moeda(p.valor)}</strong></div>
              <p>{dataBr(p.data)} · {FORMAS[p.forma]} <span className={classeSituacaoPagamento(p)}>{p.estornadoEm ? 'Estornado' : 'Pago'}</span></p>
              <p className="muted">Confirmado por {p.confirmador} em {dataHora(p.confirmadoEm, 'dd/MM/yyyy HH:mm', '-0300')}</p>
              <ul className="itens" aria-label="Diárias relacionadas">
                {p.itens.map((i) => (
                  <li key={i.diariaId}><span>{i.unidade} · {dataBr(i.data)} · Ficha #{i.fichaId}</span><strong>{moeda(i.valor)}</strong></li>
                ))}
              </ul>
              {p.estornadoEm && (
                <div className="orientacao">
                  <strong>Estornado por {p.estornador} em {dataHora(p.estornadoEm, 'dd/MM/yyyy HH:mm', '-0300')}</strong>
                  <p>{p.motivoEstorno}</p>
                </div>
              )}
              {erroDialogo && <p className="pf-error" role="alert">{erroDialogo}</p>}
              <div className="acoes">
                {p.temComprovante && <button type="button" className="pf-btn pf-btn--ghost" disabled={ocupado} onClick={() => baixar(p)}>Baixar comprovante</button>}
                <button type="button" className="pf-btn pf-btn--ghost" disabled={ocupado} onClick={() => verHistoricoDoManobrista(p.manobristaId)}>Histórico do manobrista</button>
                {!p.estornadoEm && <button type="button" className="pf-btn pf-btn--ghost perigo" disabled={ocupado} onClick={() => abrirEstorno(p)}>Estornar registro</button>}
              </div>
            </div>
          </Modal>
        );
      })()}

      {dialogo?.tipo === 'anular' && (
        <Modal titulo="Anular diária" aoFechar={fechar}>
          <form className="dialogo" onSubmit={(e) => anular(e, dialogo.diaria)}>
            <p><strong>{dialogo.diaria.manobrista}</strong> · {dialogo.diaria.unidade} · {dataBr(dialogo.diaria.data)} · {moeda(dialogo.diaria.devido)}</p>
            <p className="orientacao">Use quando o valor foi lançado errado. A diária sai do saldo a pagar e fica registrada com o motivo.
              Depois, corrija a ficha #{dialogo.diaria.fichaId} e reconheça a diária com o valor certo na conferência.</p>
            <div className="pf-field">
              <label className="pf-label" htmlFor="motivo-anulacao">Motivo da anulação</label>
              <textarea className="pf-input" id="motivo-anulacao" name="motivo" rows={3} maxLength={500} value={motivo}
                onChange={(e) => setMotivo(e.target.value)} disabled={ocupado} required />
            </div>
            {erroDialogo && <p className="pf-error" role="alert">{erroDialogo}</p>}
            <div className="acoes fim">
              <button type="button" className="pf-btn pf-btn--ghost" disabled={ocupado} onClick={fechar}>Manter diária</button>
              <button type="submit" className="pf-btn pf-btn--dark" disabled={ocupado || !motivo.trim()}>{ocupado ? 'Anulando…' : 'Anular diária'}</button>
            </div>
          </form>
        </Modal>
      )}

      {dialogo?.tipo === 'estorno' && (
        <Modal titulo="Estornar pagamento" aoFechar={fechar}>
          <form className="dialogo" onSubmit={(e) => estornar(e, dialogo.pagamento)}>
            <p>Pagamento #{dialogo.pagamento.id} · <strong>{dialogo.pagamento.manobrista}</strong> · {moeda(dialogo.pagamento.valor)}</p>
            <p className="orientacao">As diárias voltarão ao saldo a pagar e o registro original ficará no histórico. Qualquer devolução de dinheiro deve ser feita externamente.</p>
            <div className="pf-field">
              <label className="pf-label" htmlFor="motivo-estorno">Motivo do estorno</label>
              <textarea className="pf-input" id="motivo-estorno" name="motivo" rows={3} maxLength={500} value={motivo}
                onChange={(e) => setMotivo(e.target.value)} disabled={ocupado} required />
            </div>
            {erroDialogo && <p className="pf-error" role="alert">{erroDialogo}</p>}
            <div className="acoes fim">
              <button type="button" className="pf-btn pf-btn--ghost" disabled={ocupado} onClick={() => abrirHistorico(dialogo.pagamento)}>Voltar</button>
              <button type="submit" className="pf-btn pf-btn--dark" disabled={ocupado || !motivo.trim()}>{ocupado ? 'Estornando…' : 'Confirmar estorno'}</button>
            </div>
          </form>
        </Modal>
      )}
    </pf-pagamentos-manobristas>
  );
}
