import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CabecalhoPagina } from '../../compartilhado/CabecalhoPagina';
import { Calendario } from '../../compartilhado/Calendario';
import { moeda } from '../../compartilhado/formatos';
import { Icone } from '../../compartilhado/Icone';
import { cpfValido, telefoneValido } from '../../compartilhado/mascara';
import { Modal } from '../../compartilhado/Modal';
import { useFormulario } from '../../compartilhado/useFormulario';
import { useNivel } from '../../nucleo/estado/auth';
import { avisos } from '../../nucleo/estado/aviso';
import { fichasServico, useFichas } from '../../nucleo/estado/fichas';
import { useIsMobile } from '../../nucleo/estado/layout';
import { manobristasServico, useManobristas } from '../../nucleo/estado/manobristas';
import { totaisPorUnidade, useSocios } from '../../nucleo/estado/socios';
import { useUnidades } from '../../nucleo/estado/unidades';
import { Ficha, ModalidadeCusto, MODALIDADES_CUSTO, Turno } from '../../nucleo/modelos';
import {
  calcLiquidoCartao, calcSaldoFinal, calcTaxaDescontada, calcTotalBruto, calcTotalCarros, calcTotalDespesas, calcTotalDiarias,
  dividirEntreSocios,
} from '../../nucleo/servicos/calc';
import type { Forma, TipoPix } from '../../nucleo/servicos/pagamentos-manobristas';
import { hojeIso } from '../../nucleo/servicos/periodo';
import './nova-ficha.scss';

const ETAPAS = [
  { titulo: 'Identificação', subtitulo: 'Onde e quando o serviço aconteceu' },
  { titulo: 'Controle de Carros', subtitulo: 'Numeração das fichas do dia' },
  { titulo: 'Equipe', subtitulo: 'Manobristas e custos' },
  { titulo: 'Recebimentos', subtitulo: 'Recebimentos e despesas do dia' },
  { titulo: 'Resumo Final', subtitulo: 'Confira antes de lançar' },
] as const;

const MODALIDADES = Object.entries(MODALIDADES_CUSTO) as [ModalidadeCusto, string][];

interface LinhaEquipe {
  chave: number;
  manobristaId: number | null;
  /** '' (falta escolher), PENDENTE, CONFERIR ou a forma paga no dia. */
  pagamento: string;
  modalidade: ModalidadeCusto;
  diaria: number | null;
  tocada: boolean;
}

interface LinhaDespesa {
  chave: number;
  descricao: string;
  valor: number | null;
}

interface CamposFicha extends Record<string, unknown> {
  unidadeId: number | null;
  data: string;
  turno: Turno;
  fichaInicio: number | null;
  fichaFim: number | null;
  fichasCanceladas: number | null;
  valorDinheiro: number | null;
  valorCartao: number | null;
  valorPix: number | null;
  valorInicialCaixa: number | null;
  valorFinalCaixa: number | null;
  observacoes: string;
  taxaMaquininha: number | null;
}

let proximaChave = 1;
const novaLinha = (emEdicao: boolean, manobristaId: number | null = null, diaria: number | null = 80,
  modalidade: ModalidadeCusto = 'DIARIA_FIXA'): LinhaEquipe =>
  ({ chave: proximaChave++, manobristaId, pagamento: emEdicao ? 'CONFERIR' : '', modalidade, diaria, tocada: false });

/** Opcional, entre zero e 9.999.999.999,99, com até dois decimais (como o Angular com pattern). */
const valorMonetario = (v: number | null) => v === null || (v >= 0 && v <= 9999999999.99 && /^\d+(\.\d{1,2})?$/.test(String(v)));
const naoNegativo = (v: number | null) => v === null || v >= 0;

const linhaEquipeValida = (l: LinhaEquipe) =>
  l.manobristaId !== null && l.diaria !== null && l.diaria >= 0 && !(l.diaria > 0 && !l.pagamento);
const linhaDespesaValida = (d: LinhaDespesa) => !!d.descricao && d.valor !== null && d.valor >= 0;

const VAZIO: CamposFicha = {
  unidadeId: null, data: hojeIso(), turno: 'dia', fichaInicio: null, fichaFim: null, fichasCanceladas: null,
  valorDinheiro: null, valorCartao: null, valorPix: null, valorInicialCaixa: null, valorFinalCaixa: null, observacoes: '', taxaMaquininha: 2,
};

export default function NovaFicha() {
  /** Preenchido pela rota `fichas/:id/editar`. */
  const { id } = useParams();
  const navegar = useNavigate();
  const isMobile = useIsMobile();
  const nivel = useNivel();
  const fichas = useFichas((s) => s.fichas);
  const todasUnidades = useUnidades((s) => s.unidades);
  const manobristasDisponiveis = useManobristas((s) => s.manobristas);
  const socios = useSocios((s) => s.socios);
  const podeConfirmar = nivel === 'Gerente' || nivel === 'Proprietário';
  const podeCadastrarPix = nivel === 'Proprietário';
  const pagina = useRef<HTMLElement>(null);

  const [emEdicao, setEmEdicao] = useState<Ficha | null>(null);
  const [etapa, setEtapa] = useState(0);
  const [novoManobristaAberto, setNovoManobristaAberto] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [rolarParaErro, setRolarParaErro] = useState(0);
  const [equipe, setEquipe] = useState<LinhaEquipe[]>(() => [novaLinha(false)]);
  const [despesas, setDespesas] = useState<LinhaDespesa[]>([]);

  /** A numeração final precisa cobrir a inicial mais as fichas canceladas. */
  const f = useFormulario<CamposFicha>(VAZIO, (v) => ({
    unidadeId: v.unidadeId === null,
    data: !v.data,
    turno: !v.turno,
    fichaInicio: v.fichaInicio === null || v.fichaInicio < 0,
    fichaFim: v.fichaFim === null || v.fichaFim < 0,
    fichasCanceladas: !naoNegativo(v.fichasCanceladas),
    valorDinheiro: !naoNegativo(v.valorDinheiro),
    valorCartao: !naoNegativo(v.valorCartao),
    valorPix: !valorMonetario(v.valorPix),
    valorInicialCaixa: !valorMonetario(v.valorInicialCaixa),
    valorFinalCaixa: !valorMonetario(v.valorFinalCaixa),
    observacoes: v.observacoes.length > 500,
    taxaMaquininha: v.taxaMaquininha === null || v.taxaMaquininha < 0 || v.taxaMaquininha > 100,
    _form: Number(v.fichaFim ?? 0) - Number(v.fichaInicio ?? 0) - Number(v.fichasCanceladas ?? 0) < 0,
  }));
  const v = f.valores;

  // Edição: carrega a ficha (só se ainda estiver em edição).
  useEffect(() => {
    if (!id) return;
    const ficha = fichasServico.porId(Number(id));
    if (!ficha) {
      navegar('/app/fichas', { replace: true });
      return;
    }
    if (ficha.situacao && ficha.situacao !== 'EM_EDICAO') {
      avisos.erro(null, 'A ficha precisa voltar para edição antes de ser alterada.');
      navegar('/app/fichas', { replace: true });
      return;
    }
    setEmEdicao(ficha);
    setEquipe(ficha.manobristas.map((m) => novaLinha(true, m.manobristaId, m.diaria, m.modalidade)));
    setDespesas(ficha.despesasAdicionais.map((d) => ({ chave: proximaChave++, descricao: d.descricao, valor: d.valor })));
    f.resetar({
      unidadeId: ficha.unidadeId, data: ficha.data, turno: ficha.turno,
      fichaInicio: ficha.fichaInicio, fichaFim: ficha.fichaFim, fichasCanceladas: ficha.fichasCanceladas,
      valorDinheiro: ficha.valorDinheiro, valorCartao: ficha.valorCartao, valorPix: ficha.valorPix ?? null,
      valorInicialCaixa: ficha.valorInicialCaixa ?? null, valorFinalCaixa: ficha.valorFinalCaixa ?? null,
      observacoes: ficha.observacoes ?? '', taxaMaquininha: ficha.taxaMaquininha,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const unidades = todasUnidades.filter((u) => u.ativa !== false || u.id === emEdicao?.unidadeId);

  /* ----------------------------------------------------------------- */
  /* Equipe e despesas (listas dinâmicas)                               */
  /* ----------------------------------------------------------------- */

  const alterarLinha = (chave: number, mudanca: Partial<LinhaEquipe>) =>
    setEquipe((lista) => lista.map((l) => (l.chave === chave ? { ...l, ...mudanca } : l)));
  const alterarDespesa = (chave: number, mudanca: Partial<LinhaDespesa>) =>
    setDespesas((lista) => lista.map((d) => (d.chave === chave ? { ...d, ...mudanca } : d)));

  /** Esconde da lista quem já foi escolhido em outra linha. */
  function opcoesManobrista(chave: number) {
    const escolhidos = new Set(equipe.filter((l) => l.chave !== chave).map((l) => l.manobristaId));
    return manobristasDisponiveis.filter((m) => !escolhidos.has(m.id)
      && (m.ativo !== false || emEdicao?.manobristas.some((linha) => linha.manobristaId === m.id)));
  }

  /** O mesmo manobrista não pode aparecer duas vezes na equipe. */
  const idsEscolhidos = equipe.map((l) => l.manobristaId).filter((i) => i != null);
  const manobristaRepetido = new Set(idsEscolhidos).size !== idsEscolhidos.length;

  /* ----------------------------------------------------------------- */
  /* Cálculos                                                           */
  /* ----------------------------------------------------------------- */

  const totalCarros = calcTotalCarros(Number(v.fichaInicio), Number(v.fichaFim), Number(v.fichasCanceladas));
  const taxaDescontada = calcTaxaDescontada(Number(v.valorCartao), Number(v.taxaMaquininha));
  const liquidoCartao = calcLiquidoCartao(Number(v.valorCartao), Number(v.taxaMaquininha));

  function dadosPagamento(opcao: string): { pagaNaFicha?: boolean; formaPagamento?: Forma } {
    if (emEdicao || !opcao || opcao === 'CONFERIR') return {};
    if (opcao === 'PENDENTE') return { pagaNaFicha: false };
    return { pagaNaFicha: true, formaPagamento: opcao as Forma };
  }

  /** Todas as linhas contam no total, mesmo antes de escolher o manobrista. */
  const equipeInformada = equipe.map((m) => ({
    manobristaId: Number(m.manobristaId ?? 0),
    diaria: Number(m.diaria ?? 0),
    modalidade: m.modalidade,
    ...dadosPagamento(m.pagamento),
  }));
  const despesasInformadas = despesas
    .map((d) => ({ descricao: String(d.descricao ?? ''), valor: Number(d.valor ?? 0) }))
    .filter((d) => d.descricao);

  /** Já existe ficha para a mesma data, unidade e turno (avisa enquanto o usuário preenche). */
  const erroDuplicada = useMemo(
    () => !!v.unidadeId && !!v.data
      && fichas.some((x) => x.id !== emEdicao?.id && x.data === v.data && x.unidadeId === Number(v.unidadeId) && x.turno === (v.turno ?? 'dia')),
    [fichas, v.unidadeId, v.data, v.turno, emEdicao],
  );

  const totalDiarias = calcTotalDiarias(equipeInformada);
  const totalDespesas = calcTotalDespesas(despesasInformadas);
  const saldoFinal = calcSaldoFinal({
    valorDinheiro: Number(v.valorDinheiro), valorCartao: Number(v.valorCartao), valorPix: Number(v.valorPix),
    taxaMaquininha: Number(v.taxaMaquininha), manobristas: equipeInformada, despesasAdicionais: despesasInformadas,
  });

  const divisao = useMemo(() => {
    const unidadeId = Number(v.unidadeId ?? 0);
    const unidade = totaisPorUnidade(socios, todasUnidades).find((t) => t.unidadeId === unidadeId);
    return unidade?.valido && v.data?.slice(0, 7) === hojeIso().slice(0, 7)
      ? dividirEntreSocios(saldoFinal, socios, unidade.unidadeId)
      : [];
  }, [v.unidadeId, v.data, socios, todasUnidades, saldoFinal]);

  /* ----------------------------------------------------------------- */
  /* Navegação do stepper                                               */
  /* ----------------------------------------------------------------- */

  const CAMPOS_DA_ETAPA: (keyof CamposFicha)[][] = [
    ['unidadeId', 'data', 'turno'],
    ['fichaInicio', 'fichaFim', 'fichasCanceladas'],
    [],
    ['valorDinheiro', 'valorCartao', 'valorPix', 'valorInicialCaixa', 'valorFinalCaixa', 'observacoes', 'taxaMaquininha'],
  ];

  function etapaValida(indice: number): boolean {
    const camposOk = (CAMPOS_DA_ETAPA[indice] ?? []).every((campo) => !f.erros[campo]);
    if (indice === 1) return camposOk && !f.erros._form; // depende do validador cruzado
    if (indice === 2) return equipe.every(linhaEquipeValida) && !manobristaRepetido;
    if (indice === 3) return camposOk && despesas.every(linhaDespesaValida);
    return camposOk;
  }

  function tocarEtapa(indice: number) {
    (CAMPOS_DA_ETAPA[indice] ?? []).forEach((campo) => f.tocar(campo));
    if (indice === 2) setEquipe((lista) => lista.map((l) => ({ ...l, tocada: true })));
  }

  function avancar() {
    if (!etapaValida(etapa)) {
      tocarEtapa(etapa);
      return;
    }
    setEtapa((atual) => Math.min(atual + 1, ETAPAS.length - 1));
  }
  const voltar = () => setEtapa((atual) => Math.max(atual - 1, 0));
  const irPara = (indice: number) => {
    if (indice <= etapa || etapaValida(etapa)) setEtapa(indice);
  };

  /* ----------------------------------------------------------------- */
  /* Envio                                                              */
  /* ----------------------------------------------------------------- */

  const podeLancar = [0, 1, 2, 3].every(etapaValida);

  // Depois de marcar os erros: rola até o primeiro e foca o campo.
  useEffect(() => {
    if (!rolarParaErro) return;
    const erro = pagina.current?.querySelector('.pf-error');
    const campo = erro?.closest('.pf-field, fieldset, section') ?? erro;
    campo?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    campo?.querySelector<HTMLElement>('input, select')?.focus({ preventScroll: true });
  }, [rolarParaErro]);

  async function lancar(evento: FormEvent) {
    evento.preventDefault();
    setEnviado(true);
    if (!podeLancar || erroDuplicada) {
      f.tocarTodos();
      setEquipe((lista) => lista.map((l) => ({ ...l, tocada: true })));
      // Leva o usuário de volta à primeira etapa com pendência e rola até o erro.
      const pendente = erroDuplicada ? 0 : [0, 1, 2, 3].find((e) => !etapaValida(e));
      if (pendente !== undefined) setEtapa(pendente);
      setRolarParaErro((n) => n + 1);
      return;
    }

    const dados: Omit<Ficha, 'id'> = {
      data: v.data,
      unidadeId: v.unidadeId!,
      turno: v.turno,
      fichaInicio: Number(v.fichaInicio),
      fichaFim: Number(v.fichaFim),
      fichasCanceladas: Number(v.fichasCanceladas),
      totalCarros,
      valorDinheiro: Number(v.valorDinheiro),
      valorCartao: Number(v.valorCartao),
      valorPix: Number(v.valorPix),
      valorInicialCaixa: v.valorInicialCaixa,
      valorFinalCaixa: v.valorFinalCaixa,
      observacoes: v.observacoes,
      taxaMaquininha: Number(v.taxaMaquininha),
      manobristas: equipeInformada,
      despesasAdicionais: despesasInformadas,
      totalBruto: calcTotalBruto(Number(v.valorDinheiro), Number(v.valorCartao), Number(v.valorPix)),
      totalLiquido: saldoFinal,
    };

    setSalvando(true);
    try {
      if (emEdicao) await fichasServico.atualizar({ ...dados, id: emEdicao.id });
      else await fichasServico.adicionar(dados);
    } catch (erro) {
      avisos.erro(erro);
      return;
    } finally {
      setSalvando(false);
    }
    avisos.sucesso(emEdicao ? 'Ficha atualizada.' : 'Ficha lançada.');
    navegar('/app/fichas');
  }

  const invalido = (nome: keyof CamposFicha) => !!f.erros[nome] && (!!f.tocados[nome] || enviado);
  const classe = (nome: keyof CamposFicha, base = 'pf-input') => (invalido(nome) ? `${base} ng-invalid ng-touched` : base);
  const sequenciaInvalida = !!f.erros._form && (!!f.tocados.fichaFim || enviado);
  const pixInvalido = !!f.tocados.valorPix && !!f.erros.valorPix;

  /** Campo numérico ligado ao formulário principal. */
  const numero = (nome: keyof CamposFicha) => ({ ...f.numero(nome), className: classe(nome) });

  /* ----------------------------------------------------------------- */
  /* Cadastro rápido de manobrista                                      */
  /* ----------------------------------------------------------------- */

  const nm = useFormulario({ nome: '', telefone: '', cpf: '', tipoPix: 'CPF' as TipoPix, chavePix: '' }, (x) => ({
    nome: !x.nome, telefone: !telefoneValido(x.telefone), cpf: !cpfValido(x.cpf),
  }));

  async function salvarNovoManobrista(evento: FormEvent) {
    evento.preventDefault();
    if (!nm.valido) {
      nm.tocarTodos();
      return;
    }
    let criadoId: number;
    try {
      const { tipoPix, chavePix, ...cadastro } = nm.valores;
      const criado = await manobristasServico.salvarManobrista({
        ...cadastro, pix: podeCadastrarPix && chavePix.trim() ? { tipo: tipoPix, chave: chavePix.trim() } : undefined,
      });
      criadoId = criado.id;
    } catch (erro) {
      avisos.erro(erro);
      return;
    }
    // Aproveita a primeira linha vazia da equipe, se houver.
    setEquipe((lista) => {
      const vaga = lista.find((l) => l.manobristaId == null);
      return vaga ? lista.map((l) => (l === vaga ? { ...l, manobristaId: criadoId } : l)) : [...lista, novaLinha(!!emEdicao, criadoId)];
    });
    nm.resetar({ nome: '', telefone: '', cpf: '', tipoPix: 'CPF', chavePix: '' });
    setNovoManobristaAberto(false);
  }

  const mostrar = (indice: number) => !isMobile || etapa === indice;

  return (
    <pf-nova-ficha ref={pagina}>
      <form className="pf-page nova" onSubmit={lancar} noValidate>
        {!isMobile ? (
          <CabecalhoPagina titulo={emEdicao ? 'Editar ficha' : 'Nova ficha'}
            subtitulo={emEdicao ? 'Corrija os dados do fechamento' : 'Lance o fechamento do dia'} />
        ) : (
          /* Stepper mobile */
          <div className="stepper">
            <div className="stepper__barra" role="progressbar" aria-valuenow={etapa + 1} aria-valuemin={1} aria-valuemax={ETAPAS.length}>
              {ETAPAS.map((e, i) => <span key={e.titulo} className={`stepper__seg${i <= etapa ? ' stepper__seg--ativo' : ''}`} />)}
            </div>
            <p className="stepper__contador">Etapa {etapa + 1} de {ETAPAS.length}</p>
            <h1 className="stepper__titulo">{ETAPAS[etapa].titulo}</h1>
            <p className="stepper__sub">{ETAPAS[etapa].subtitulo}</p>
          </div>
        )}

        <div className="nova__corpo">
          <div className="nova__principal">

            {/* 1. Identificação */}
            {mostrar(0) && (
              <section className="pf-card secao">
                {!isMobile && <h2 className="secao__titulo">1. Identificação</h2>}
                <div className="grid grid--3">
                  <div className="pf-field">
                    <label className="pf-label" htmlFor="unidade">Unidade</label>
                    <select id="unidade" className={classe('unidadeId', 'pf-select')} value={v.unidadeId ?? ''}
                      onChange={(e) => f.definir('unidadeId', e.target.value === '' ? null : Number(e.target.value))} onBlur={() => f.tocar('unidadeId')}>
                      <option value="" disabled>Selecione a unidade</option>
                      {unidades.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
                    </select>
                    {invalido('unidadeId') && <span className="pf-error">Escolha a unidade.</span>}
                  </div>
                  <div className="pf-field">
                    <label className="pf-label" htmlFor="data">Data</label>
                    <Calendario><input id="data" type="date" {...f.campo('data')} className={classe('data')} /></Calendario>
                    {invalido('data') && <span className="pf-error">Informe a data.</span>}
                  </div>
                  <div className="pf-field">
                    <span className="pf-label">Turno</span>
                    <div className="pf-radio-group">
                      {(['dia', 'noite'] as Turno[]).map((t) => (
                        <label key={t} className={`pf-radio${v.turno === t ? ' pf-radio--checked' : ''}`}>
                          <input type="radio" name="turno" value={t} checked={v.turno === t} onChange={() => f.definir('turno', t)} />
                          {t === 'dia' ? 'Dia' : 'Noite'}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
                {erroDuplicada && <p className="pf-error secao__aviso">Já existe uma ficha desta unidade para esta data e turno.</p>}
              </section>
            )}

            {/* 2. Controle de carros */}
            {mostrar(1) && (
              <section className="pf-card secao">
                {!isMobile && <h2 className="secao__titulo">2. Controle de Carros</h2>}
                <div className="grid grid--4">
                  <div className="pf-field">
                    <label className="pf-label" htmlFor="fichaInicio">Ticket inicial</label>
                    <input id="fichaInicio" min={0} inputMode="numeric" placeholder="0" {...numero('fichaInicio')} />
                    {invalido('fichaInicio') && <span className="pf-error">Informe a ficha inicial.</span>}
                  </div>
                  <div className="pf-field">
                    <label className="pf-label" htmlFor="fichaFim">Ticket final</label>
                    <input id="fichaFim" min={0} inputMode="numeric" placeholder="0" {...numero('fichaFim')} />
                    {invalido('fichaFim') && <span className="pf-error">Informe a ficha final.</span>}
                  </div>
                  <div className="pf-field">
                    <label className="pf-label" htmlFor="canceladas">Fichas canceladas</label>
                    <input id="canceladas" min={0} inputMode="numeric" placeholder="0" {...numero('fichasCanceladas')} />
                  </div>
                  <div className="pf-field">
                    <label className="pf-label" htmlFor="totalCarros">Total real de carros</label>
                    <input id="totalCarros" className="pf-input" type="text" readOnly value={totalCarros} />
                  </div>
                </div>
                {sequenciaInvalida && <p className="pf-error secao__aviso">A ficha final precisa ser maior que a inicial somada às canceladas.</p>}
              </section>
            )}

            {/* 3. Manobristas */}
            {mostrar(2) && (
              <section className="pf-card secao">
                {!isMobile && <h2 className="secao__titulo">3. Manobristas</h2>}
                <p className="secao__vazio equipe__orientacao">Escolha a modalidade e informe o custo em reais.</p>

                {equipe.map((linha) => {
                  const mostrarErros = linha.tocada || enviado;
                  const tocar = () => alterarLinha(linha.chave, { tocada: true });
                  return (
                    <div key={linha.chave} className="linha linha--equipe" onBlur={tocar}>
                      <div className="pf-field linha__principal">
                        <span className="pf-label">Manobrista</span>
                        <select className={`pf-select${mostrarErros && linha.manobristaId === null ? ' ng-invalid ng-touched' : ''}`}
                          value={linha.manobristaId ?? ''} aria-label="Manobrista"
                          onChange={(e) => alterarLinha(linha.chave, { manobristaId: e.target.value === '' ? null : Number(e.target.value) })}>
                          <option value="" disabled>Selecione</option>
                          {opcoesManobrista(linha.chave).map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
                        </select>
                        {mostrarErros && linha.manobristaId === null && <span className="pf-error">Escolha o manobrista.</span>}
                      </div>

                      <label className="pf-field linha__modalidade">
                        <span className="pf-label">Modalidade de custo</span>
                        <select className="pf-select" value={linha.modalidade}
                          onChange={(e) => alterarLinha(linha.chave, { modalidade: e.target.value as ModalidadeCusto })}>
                          {MODALIDADES.map(([valor, rotulo]) => <option key={valor} value={valor}>{rotulo}</option>)}
                        </select>
                      </label>

                      <label className="pf-field linha__valor">
                        <span className="pf-label">Custo informado (R$)</span>
                        <input className="pf-input" type="number" min={0} step={0.01} inputMode="decimal"
                          value={linha.diaria ?? ''} onChange={(e) => alterarLinha(linha.chave, { diaria: e.target.value === '' ? null : Number(e.target.value) })} />
                      </label>

                      {!emEdicao && (linha.diaria ?? 0) > 0 && (
                        <label className="pf-field linha__pagamento">
                          <span className="pf-label">Situação do pagamento</span>
                          <select className="pf-select" value={linha.pagamento} onChange={(e) => alterarLinha(linha.chave, { pagamento: e.target.value })}>
                            <option value="" disabled>Selecione a situação</option>
                            <option value="PENDENTE">Falta pagar</option>
                            {podeConfirmar && (
                              <>
                                <option value="PIX">Pago no dia · Pix</option>
                                <option value="DINHEIRO">Pago no dia · Dinheiro</option>
                                <option value="TRANSFERENCIA">Pago no dia · Transferência</option>
                                <option value="OUTRA">Pago no dia · Outra forma</option>
                              </>
                            )}
                            <option value="CONFERIR">Deixar para conferência</option>
                          </select>
                          {(linha.diaria ?? 0) > 0 && !linha.pagamento && mostrarErros && <span className="pf-error">Informe se o custo foi pago.</span>}
                        </label>
                      )}
                      <button type="button" className="linha__remover linha__remover--equipe" aria-label="Remover manobrista"
                        disabled={equipe.length === 1} onClick={() => setEquipe((lista) => lista.filter((l) => l.chave !== linha.chave))}>
                        <Icone nome="excluir" tamanho={17} />
                      </button>
                    </div>
                  );
                })}

                {manobristaRepetido && <p className="pf-error secao__aviso">O mesmo manobrista foi escolhido mais de uma vez.</p>}

                <div className="secao__links">
                  <button type="button" className="pf-link-btn" onClick={() => setEquipe((l) => [...l, novaLinha(!!emEdicao)])}>+ Adicionar Manobrista</button>
                  <button type="button" className="pf-link-btn" onClick={() => setNovoManobristaAberto(true)}>+ Novo Manobrista</button>
                </div>
                <p className="secao__total">Custo total da equipe: <strong>{moeda(totalDiarias)}</strong></p>
              </section>
            )}

            {/* 4 e 5. Recebimentos + despesas */}
            {mostrar(3) && (
              <>
                <section className="pf-card secao">
                  {!isMobile && <h2 className="secao__titulo">4. Recebimentos</h2>}
                  <div className="grid grid--3">
                    <div className="pf-field">
                      <label className="pf-label" htmlFor="dinheiro">Valor em Dinheiro (R$)</label>
                      <input id="dinheiro" min={0} step={0.01} inputMode="decimal" placeholder="0,00" {...numero('valorDinheiro')} />
                    </div>
                    <div className="pf-field">
                      <label className="pf-label" htmlFor="cartao">Valor em Cartão (R$)</label>
                      <input id="cartao" min={0} step={0.01} inputMode="decimal" placeholder="0,00" {...numero('valorCartao')} />
                    </div>
                    <div className="pf-field">
                      <label className="pf-label" htmlFor="recebimento-pix">Valor em Pix (R$)</label>
                      <input id="recebimento-pix" min={0} step={0.01} inputMode="decimal" placeholder="0,00" {...numero('valorPix')}
                        aria-invalid={pixInvalido} aria-describedby={pixInvalido ? 'recebimento-pix-erro' : undefined} />
                      {pixInvalido && <span id="recebimento-pix-erro" className="pf-error">Informe um valor entre zero e R$ 9.999.999.999,99 com até dois decimais.</span>}
                    </div>
                    <div className="pf-field">
                      <label className="pf-label" htmlFor="taxa">Taxa da maquininha (%)</label>
                      <input id="taxa" min={0} max={100} step={0.01} inputMode="decimal" {...numero('taxaMaquininha')} />
                    </div>
                    <div className="pf-field">
                      <label className="pf-label" htmlFor="taxaDesc">Taxa descontada</label>
                      <input id="taxaDesc" className="pf-input" type="text" readOnly value={moeda(taxaDescontada)} />
                    </div>
                    <div className="pf-field">
                      <label className="pf-label" htmlFor="liqCartao">Valor líquido cartão</label>
                      <input id="liqCartao" className="pf-input" type="text" readOnly value={moeda(liquidoCartao)} />
                    </div>
                  </div>
                </section>

                <section className="pf-card secao">
                  <h2 className="secao__titulo">Conferência de caixa</h2>
                  <div className="grid grid--3">
                    <div className="pf-field">
                      <label className="pf-label" htmlFor="abertura-caixa">Caixa inicial (R$, opcional)</label>
                      <input id="abertura-caixa" min={0} step={0.01} inputMode="decimal" {...numero('valorInicialCaixa')} />
                      {invalido('valorInicialCaixa') && <span className="pf-error">Informe um valor válido com até dois decimais.</span>}
                    </div>
                    <div className="pf-field">
                      <label className="pf-label" htmlFor="fechamento-caixa">Caixa final (R$, opcional)</label>
                      <input id="fechamento-caixa" min={0} step={0.01} inputMode="decimal" {...numero('valorFinalCaixa')} />
                      {invalido('valorFinalCaixa') && <span className="pf-error">Informe um valor válido com até dois decimais.</span>}
                    </div>
                  </div>
                  <p className="secao__vazio">Os valores de caixa servem para conferência. A receita soma dinheiro, cartão e Pix.</p>
                  <div className="pf-field">
                    <label className="pf-label" htmlFor="ficha-observacoes">Observações</label>
                    <textarea id="ficha-observacoes" maxLength={500} rows={3} {...f.campo('observacoes')} />
                  </div>
                </section>

                <section className="pf-card secao">
                  {!isMobile && <h2 className="secao__titulo">5. Despesas Adicionais</h2>}
                  {isMobile && <h2 className="secao__titulo secao__titulo--sub">Despesas adicionais</h2>}
                  {despesas.length === 0 && <p className="secao__vazio">Nenhuma despesa lançada neste dia.</p>}
                  {despesas.map((d, i) => (
                    <div key={d.chave} className="linha">
                      <div className="pf-field linha__principal">
                        {i === 0 && <span className="pf-label">Descrição</span>}
                        <input className="pf-input" type="text" placeholder="Ex.: lavagem da calçada" aria-label="Descrição"
                          value={d.descricao} onChange={(e) => alterarDespesa(d.chave, { descricao: e.target.value })} />
                      </div>
                      <div className="pf-field linha__valor">
                        {i === 0 && <span className="pf-label">Valor (R$)</span>}
                        <input className="pf-input" type="number" min={0} step={0.01} inputMode="decimal" placeholder="0,00" aria-label="Valor"
                          value={d.valor ?? ''} onChange={(e) => alterarDespesa(d.chave, { valor: e.target.value === '' ? null : Number(e.target.value) })} />
                      </div>
                      <button type="button" className={`linha__remover${i === 0 ? ' linha__remover--alinhado' : ''}`} aria-label="Remover despesa"
                        onClick={() => setDespesas((lista) => lista.filter((x) => x.chave !== d.chave))}>
                        <Icone nome="excluir" tamanho={17} />
                      </button>
                    </div>
                  ))}
                  <div className="secao__links">
                    <button type="button" className="pf-link-btn"
                      onClick={() => setDespesas((lista) => [...lista, { chave: proximaChave++, descricao: '', valor: null }])}>+ Adicionar Despesa</button>
                  </div>
                </section>
              </>
            )}

            {/* Etapa 5 (só mobile): resumo */}
            {isMobile && etapa === 4 && (
              <section className="pf-card secao">
                <ul className="checklist">
                  {ETAPAS.slice(0, 4).map((e, i) => (
                    <li key={e.titulo} className={`checklist__item${etapaValida(i) ? '' : ' checklist__item--pendente'}`}>
                      <Icone nome={etapaValida(i) ? 'check' : 'alerta'} tamanho={16} />
                      <span>{e.titulo}</span>
                      <button type="button" className="pf-link-btn" onClick={() => irPara(i)}>Revisar</button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          {/* Resumo: coluna lateral no desktop, etapa 5 no mobile */}
          {mostrar(4) && (
            <aside className={`resumo${isMobile ? ' resumo--mobile' : ''}`}>
              <div className="pf-card resumo__card">
                <h2 className="resumo__titulo">Resumo Final</h2>
                <dl className="resumo__lista">
                  <div><dt>Total Dinheiro</dt><dd>{moeda(v.valorDinheiro ?? 0)}</dd></div>
                  <div><dt>Total Cartão líquido</dt><dd>{moeda(liquidoCartao)}</dd></div>
                  <div><dt>Total Pix</dt><dd>{moeda(v.valorPix ?? 0)}</dd></div>
                  <div className="neg"><dt>(−) Custo da equipe</dt><dd>− {moeda(totalDiarias)}</dd></div>
                  <div className="neg"><dt>(−) Total Despesas</dt><dd>− {moeda(totalDespesas)}</dd></div>
                </dl>
                <div className="resumo__sep" />
                <div className="resumo__saldo">
                  <span>= Saldo final</span>
                  <strong className={saldoFinal < 0 ? 'pf-money--neg' : 'pf-money--pos'}>{moeda(saldoFinal)}</strong>
                </div>

                {divisao.length > 0 && (
                  <>
                    <p className="resumo__subtitulo">Participação no saldo desta ficha</p>
                    <p className="resumo__aviso">Prévia sem despesas fixas; o rateio do mês fica em Divisão de Lucro.</p>
                    <ul className="resumo__socios">
                      {divisao.map((parte) => (
                        <li key={parte.nome}><span>{parte.nome} ({parte.percentual}%)</span><span>{moeda(parte.valor)}</span></li>
                      ))}
                    </ul>
                  </>
                )}

                {!isMobile && (
                  <>
                    <button type="submit" className="pf-btn pf-btn--primary pf-btn--block resumo__acao" disabled={salvando}>
                      {emEdicao ? 'Salvar alterações' : 'Lançar Ficha'}
                    </button>
                    {enviado && (!podeLancar || erroDuplicada) && <p className="pf-error resumo__erro">Revise os campos destacados antes de lançar.</p>}
                  </>
                )}
              </div>
            </aside>
          )}
        </div>

        {/* Navegação do stepper */}
        {isMobile && (
          <div className="nav-etapas">
            {etapa > 0 && (
              <button type="button" className="pf-btn pf-btn--ghost" onClick={voltar}>
                <Icone nome="voltar" tamanho={16} />
                Voltar
              </button>
            )}
            {etapa < ETAPAS.length - 1 ? (
              <button type="button" className="pf-btn pf-btn--primary nav-etapas__principal" onClick={avancar}>
                Continuar
                <Icone nome="avancar" tamanho={16} />
              </button>
            ) : (
              <button type="submit" className="pf-btn pf-btn--primary nav-etapas__principal" disabled={salvando}>
                {emEdicao ? 'Salvar' : 'Lançar ficha'}
                <Icone nome="check" tamanho={16} />
              </button>
            )}
          </div>
        )}
      </form>

      {/* Cadastro rápido de manobrista */}
      {novoManobristaAberto && (
        <Modal titulo="Novo manobrista" aoFechar={() => setNovoManobristaAberto(false)}>
          <form className="modal-form" onSubmit={salvarNovoManobrista} noValidate>
            <div className="pf-field">
              <label className="pf-label" htmlFor="nm-nome">Nome</label>
              <input id="nm-nome" type="text" {...nm.campo('nome')} />
            </div>
            <div className="pf-field">
              <label className="pf-label" htmlFor="nm-telefone">Telefone</label>
              <input id="nm-telefone" type="tel" placeholder="(11) 90000-0000" {...nm.campo('telefone', { mascara: 'telefone' })} />
              {nm.invalido('telefone') && <span className="pf-error">Telefone com DDD (10 ou 11 dígitos).</span>}
            </div>
            <div className="pf-field">
              <label className="pf-label" htmlFor="nm-cpf">CPF</label>
              <input id="nm-cpf" type="text" inputMode="numeric" placeholder="000.000.000-00" {...nm.campo('cpf', { mascara: 'cpf' })} />
              {nm.invalido('cpf') && <span className="pf-error">CPF inválido.</span>}
            </div>
            {podeCadastrarPix && (
              <>
                <label className="pf-field"><span className="pf-label">Tipo de chave Pix</span>
                  <select {...nm.campo('tipoPix')} className="pf-select">
                    <option value="CPF">CPF</option><option value="CNPJ">CNPJ</option><option value="TELEFONE">Telefone</option>
                    <option value="EMAIL">E-mail</option><option value="ALEATORIA">Chave aleatória</option>
                  </select>
                </label>
                <label className="pf-field"><span className="pf-label">Chave Pix (opcional)</span>
                  <input {...nm.campo('chavePix')} maxLength={254} autoComplete="off" spellCheck={false} />
                </label>
              </>
            )}
            <div className="modal-form__acoes">
              <button type="button" className="pf-btn pf-btn--ghost" onClick={() => setNovoManobristaAberto(false)}>Cancelar</button>
              <button type="submit" className="pf-btn pf-btn--primary">Salvar</button>
            </div>
          </form>
        </Modal>
      )}
    </pf-nova-ficha>
  );
}
