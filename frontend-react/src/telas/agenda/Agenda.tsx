import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CabecalhoPagina } from '../../compartilhado/CabecalhoPagina';
import { dataHora, moeda } from '../../compartilhado/formatos';
import { Icone } from '../../compartilhado/Icone';
import { Modal } from '../../compartilhado/Modal';
import { useConsulta } from '../../compartilhado/useConsulta';
import { avisos } from '../../nucleo/estado/aviso';
import { nomeManobrista, useManobristas } from '../../nucleo/estado/manobristas';
import { nomeUnidade, useUnidades } from '../../nucleo/estado/unidades';
import {
  agendaServico, AlteracaoEscala, Escala, Evento, SituacaoEscala, SituacaoEvento,
} from '../../nucleo/servicos/agenda';
import { mensagemDeErro } from '../../nucleo/servicos/api';
import { FinanceiroEvento } from './FinanceiroEvento';
import { EstadoVazio } from '../../compartilhado/EstadoVazio';
import './agenda.scss';

const STATUS_EVENTO: SituacaoEvento[] = ['PLANEJADO', 'CONFIRMADO', 'REALIZADO', 'CANCELADO'];
const STATUS_ESCALA: SituacaoEscala[] = ['PLANEJADA', 'CONFIRMADA', 'REALIZADA', 'CANCELADA'];
const ROTULOS: Record<SituacaoEvento | SituacaoEscala, string> = {
  PLANEJADO: 'Planejado', CONFIRMADO: 'Confirmado', REALIZADO: 'Realizado', CANCELADO: 'Cancelado',
  PLANEJADA: 'Planejada', CONFIRMADA: 'Confirmada', REALIZADA: 'Realizada', CANCELADA: 'Cancelada',
};
const TAMANHO_PAGINA = 50;

const quando = (valor: string) => dataHora(valor, 'dd/MM/yyyy HH:mm');
const numeroOuNulo = (texto: string) => (texto === '' ? null : Number(texto));

/** Eventos e escalas usam a mesma tela; `tipo` vem da rota. */
export default function Agenda({ tipo = 'eventos' }: { tipo?: 'eventos' | 'escalas' }) {
  const unidades = useUnidades((s) => s.unidades);
  const manobristas = useManobristas((s) => s.manobristas);
  const [parametros] = useSearchParams();

  const [unidade, setUnidade] = useState<number | null>(null);
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');
  const [pagina, setPagina] = useState(0);
  const [eventoEditado, setEventoEditado] = useState<Evento | null>(null);
  const [escalaEditada, setEscalaEditada] = useState<Escala | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState('');
  const [historico, setHistorico] = useState<AlteracaoEscala[] | null>(null);
  const [carregandoHistorico, setCarregandoHistorico] = useState(false);
  const [erroHistorico, setErroHistorico] = useState('');
  const [eventosDaUnidade, setEventosDaUnidade] = useState<Evento[]>([]);
  const [consultandoEventos, setConsultandoEventos] = useState(false);
  const [erroEventos, setErroEventos] = useState('');
  const escalaAtual = useRef<Escala | null>(null);
  escalaAtual.current = escalaEditada;

  const filtro = useMemo(() => ({
    ...(unidade ? { unidadeId: unidade } : {}), ...(de ? { de } : {}), ...(ate ? { ate } : {}), pagina,
  }), [unidade, de, ate, pagina]);
  const { consulta, tentarNovamente: recarregar } = useConsulta<(Evento | Escala)[]>(
    (sinal) => (tipo === 'eventos' ? agendaServico.eventos(filtro, sinal) : agendaServico.escalas(filtro, sinal)),
    [tipo, filtro],
  );
  const itens = consulta.tipo === 'pronta' ? consulta.dados : [];

  function filtrar(novaUnidade: number | null, novoDe: string, novoAte: string) {
    setUnidade(novaUnidade);
    setDe(novoDe);
    setAte(novoAte);
    setPagina(0);
  }

  function unidadeInicial(): number | null {
    const ativas = unidades.filter((u) => u.ativa !== false);
    return ativas.find((u) => u.id === unidade)?.id ?? (ativas.length === 1 ? ativas[0].id : null);
  }

  function abrirEvento(valor?: Evento) {
    setErroForm('');
    setEventoEditado(valor ? { ...valor, inicio: valor.inicio.slice(0, 16), fim: valor.fim.slice(0, 16) } : {
      unidadeId: unidadeInicial(), inicio: '', fim: '', nome: '', contratante: '', local: '', responsavel: '',
      situacao: 'PLANEJADO', veiculosPrevistos: 0, capacidade: 0, equipePrevista: 0,
      valorContratado: null, despesasPrevistas: null, observacoes: '',
    });
  }

  async function buscarEventos(escala: Escala) {
    const unidadeId = escala.unidadeId;
    setEventosDaUnidade([]);
    setErroEventos('');
    if (!unidadeId) {
      setConsultandoEventos(false);
      return;
    }
    setConsultandoEventos(true);
    const vigente = () => escalaAtual.current?.unidadeId === unidadeId;
    try {
      const eventos = await agendaServico.eventos({ unidadeId });
      if (vigente()) setEventosDaUnidade(eventos.filter((e) => e.id === escala.eventoId || e.situacao !== 'CANCELADO'));
    } catch (e) {
      if (vigente()) setErroEventos(mensagemDeErro(e));
    } finally {
      if (vigente()) setConsultandoEventos(false);
    }
  }

  function abrirEscala(valor?: Escala) {
    setErroForm('');
    setHistorico(null);
    setErroHistorico('');
    const escala: Escala = valor ? { ...valor, inicio: valor.inicio.slice(0, 16), fim: valor.fim.slice(0, 16) } : {
      unidadeId: unidadeInicial(), eventoId: null, inicio: '', fim: '', responsavel: '', situacao: 'PLANEJADA',
      observacoes: '', manobristaIds: [],
    };
    escalaAtual.current = escala;
    setEscalaEditada(escala);
    void buscarEventos(escala);
  }

  function trocarUnidadeDaEscala(unidadeId: number | null) {
    if (!escalaEditada) return;
    const escala = { ...escalaEditada, unidadeId, eventoId: null };
    escalaAtual.current = escala;
    setEscalaEditada(escala);
    void buscarEventos(escala);
  }

  // ?detalhe=ID abre o evento ou a escala (links das notificações).
  const idDetalhe = Number(parametros.get('detalhe'));
  useEffect(() => {
    if (!Number.isSafeInteger(idDetalhe) || idDetalhe <= 0) return;
    let ativo = true;
    const pedido = tipo === 'eventos' ? agendaServico.evento(idDetalhe) : agendaServico.escala(idDetalhe);
    pedido
      .then((item) => {
        if (!ativo) return;
        if ('manobristaIds' in item) abrirEscala(item);
        else abrirEvento(item);
      })
      .catch((e) => { if (ativo) avisos.erro(e); });
    return () => { ativo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idDetalhe, tipo]);

  async function verHistorico(id: number) {
    if (carregandoHistorico) return;
    setCarregandoHistorico(true);
    setErroHistorico('');
    try {
      const registros = await agendaServico.historico(id);
      if (escalaAtual.current?.id === id) setHistorico(registros);
    } catch (e) {
      if (escalaAtual.current?.id === id) setErroHistorico(mensagemDeErro(e));
    } finally {
      setCarregandoHistorico(false);
    }
  }

  async function salvar(evento: FormEvent, valor: Evento | Escala) {
    evento.preventDefault();
    if (salvando) return;
    setErroForm('');
    if (!valor.inicio || !valor.fim || valor.inicio >= valor.fim) {
      setErroForm('Informe um horário de término posterior ao início.');
      return;
    }
    if ('manobristaIds' in valor && !valor.manobristaIds.length) {
      setErroForm('Selecione pelo menos um profissional.');
      return;
    }
    setSalvando(true);
    try {
      if ('manobristaIds' in valor) {
        await agendaServico.salvarEscala(valor);
        setEscalaEditada(null);
        avisos.sucesso('Escala salva.');
      } else {
        await agendaServico.salvarEvento(valor);
        setEventoEditado(null);
        avisos.sucesso('Evento salvo.');
      }
      recarregar();
    } catch (e) {
      setErroForm(mensagemDeErro(e));
    } finally {
      setSalvando(false);
    }
  }

  const ev = eventoEditado;
  const alterarEvento = (mudanca: Partial<Evento>) => setEventoEditado((atual) => (atual ? { ...atual, ...mudanca } : atual));
  const eventoValido = !!ev && !!ev.nome && !!ev.contratante && !!ev.local && ev.unidadeId !== null && !!ev.inicio && !!ev.fim
    && !!ev.responsavel && !!ev.situacao && ev.veiculosPrevistos !== null && ev.veiculosPrevistos >= 0
    && ev.capacidade !== null && ev.capacidade >= 0 && ev.equipePrevista !== null && ev.equipePrevista >= 0
    && (ev.valorContratado === null || ev.valorContratado >= 0) && (ev.despesasPrevistas === null || ev.despesasPrevistas >= 0);

  const es = escalaEditada;
  const alterarEscala = (mudanca: Partial<Escala>) => setEscalaEditada((atual) => {
    const nova = atual ? { ...atual, ...mudanca } : atual;
    escalaAtual.current = nova;
    return nova;
  });
  const escalaValida = !!es && es.unidadeId !== null && !!es.inicio && !!es.fim && !!es.responsavel && !!es.situacao;

  return (
    <pf-agenda>
      <div className="pf-page">
        <CabecalhoPagina titulo={tipo === 'eventos' ? 'Eventos' : 'Escalas'}
          subtitulo={tipo === 'eventos' ? 'Planeje a operação e registre as condições do evento.' : 'Organize turnos e profissionais por unidade ou evento.'}>
          {tipo === 'eventos'
            ? <button type="button" className="pf-btn pf-btn--primary" onClick={() => abrirEvento()}><Icone nome="plus" tamanho={17} /> Novo evento</button>
            : <button type="button" className="pf-btn pf-btn--primary" onClick={() => abrirEscala()}><Icone nome="plus" tamanho={17} /> Nova escala</button>}
        </CabecalhoPagina>

        <div className="pf-filters">
          <label className="pf-field"><span className="pf-label">Unidade</span>
            <select className="pf-select" value={unidade ?? ''} onChange={(e) => filtrar(numeroOuNulo(e.target.value), de, ate)}>
              <option value="">Unidades autorizadas</option>
              {unidades.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </select>
          </label>
          <label className="pf-field"><span className="pf-label">De</span>
            <input className="pf-input" type="date" value={de} onChange={(e) => filtrar(unidade, e.target.value, ate)} />
          </label>
          <label className="pf-field"><span className="pf-label">Até</span>
            <input className="pf-input" type="date" value={ate} onChange={(e) => filtrar(unidade, de, e.target.value)} />
          </label>
        </div>

        {consulta.tipo === 'carregando' ? (
          <p className="pf-card agenda-estado" role="status">Carregando agenda…</p>
        ) : consulta.tipo === 'erro' ? (
          <div className="pf-card agenda-estado">
            <p className="pf-error" role="alert">{consulta.mensagem}</p>
            <button type="button" className="pf-btn pf-btn--ghost" onClick={recarregar}>Tentar novamente</button>
          </div>
        ) : !itens.length ? (
          <EstadoVazio ilustracao="calendario" titulo={tipo === 'eventos' ? 'Nenhum evento neste recorte' : 'Nenhuma escala neste recorte'} texto="Ajuste a unidade e as datas ou inclua um novo registro." />
        ) : (
          <div className="lista-agenda">
            {tipo === 'eventos'
              ? (itens as Evento[]).map((e) => (
                <article key={e.id} className="pf-card agenda-item">
                  <div><span className="pf-badge pf-badge--gray">{ROTULOS[e.situacao]}</span></div>
                  <div><h2>{e.nome}</h2><p>{e.contratante} · {e.local}</p></div>
                  <p>{e.unidadeId === null ? '—' : nomeUnidade(unidades, e.unidadeId)} · {quando(e.inicio)} a {quando(e.fim)}</p>
                  <p>{e.veiculosPrevistos} veículos previstos · {e.equipePrevista} profissionais</p>
                  {e.valorContratado != null && <p>Valor contratado: {moeda(e.valorContratado)}</p>}
                  {e.despesasPrevistas != null && <p>Despesas previstas: {moeda(e.despesasPrevistas)}</p>}
                  {e.valorContratado != null && e.despesasPrevistas != null && <p>Resultado previsto: {moeda(e.valorContratado - e.despesasPrevistas)}</p>}
                  <footer>
                    {e.id && <FinanceiroEvento id={e.id} nome={e.nome} />}
                    <button type="button" className="pf-btn pf-btn--ghost" onClick={() => abrirEvento(e)}>Ver e editar</button>
                  </footer>
                </article>
              ))
              : (itens as Escala[]).map((s) => (
                <article key={s.id} className="pf-card agenda-item">
                  <div><span className="pf-badge pf-badge--gray">{ROTULOS[s.situacao]}</span></div>
                  <div><h2>{s.unidadeId === null ? '—' : nomeUnidade(unidades, s.unidadeId)}</h2><p>Responsável: {s.responsavel}</p></div>
                  <p>{quando(s.inicio)} a {quando(s.fim)}</p>
                  <p>{s.manobristaIds.map((id) => nomeManobrista(manobristas, id)).join(', ')}</p>
                  <footer><button type="button" className="pf-btn pf-btn--ghost" onClick={() => abrirEscala(s)}>Ver e editar</button></footer>
                </article>
              ))}
          </div>
        )}

        {(pagina > 0 || itens.length === TAMANHO_PAGINA) && (
          <footer aria-label="Paginação">
            <button type="button" className="pf-btn pf-btn--ghost" disabled={!pagina || consulta.tipo === 'carregando'} onClick={() => setPagina(pagina - 1)}>Anterior</button>
            <span>Página {pagina + 1}</span>
            <button type="button" className="pf-btn pf-btn--ghost" disabled={itens.length < TAMANHO_PAGINA || consulta.tipo === 'carregando'} onClick={() => setPagina(pagina + 1)}>Próxima</button>
          </footer>
        )}
      </div>

      {ev && (
        <Modal titulo={ev.id ? 'Editar evento' : 'Novo evento'} aoFechar={() => setEventoEditado(null)}>
          <form onSubmit={(e) => (eventoValido ? salvar(e, ev) : e.preventDefault())}>
            <div className="grade">
              <label className="pf-field"><span className="pf-label">Nome</span>
                <input className="pf-input" name="nome" required maxLength={120} value={ev.nome} onChange={(e) => alterarEvento({ nome: e.target.value })} /></label>
              <label className="pf-field"><span className="pf-label">Contratante</span>
                <input className="pf-input" name="contratante" required maxLength={120} value={ev.contratante} onChange={(e) => alterarEvento({ contratante: e.target.value })} /></label>
              <label className="pf-field"><span className="pf-label">Local</span>
                <input className="pf-input" name="local" required maxLength={200} value={ev.local} onChange={(e) => alterarEvento({ local: e.target.value })} /></label>
              <label className="pf-field"><span className="pf-label">Unidade responsável</span>
                <select className="pf-select" name="unidade" required value={ev.unidadeId ?? ''} onChange={(e) => alterarEvento({ unidadeId: numeroOuNulo(e.target.value) })}>
                  <option value="" disabled>Selecione</option>
                  {unidades.map((u) => <option key={u.id} value={u.id} disabled={u.ativa === false && u.id !== ev.unidadeId}>{u.nome}</option>)}
                </select>
              </label>
              <label className="pf-field"><span className="pf-label">Início</span>
                <input className="pf-input" name="inicio" type="datetime-local" required value={ev.inicio} onChange={(e) => alterarEvento({ inicio: e.target.value })} /></label>
              <label className="pf-field"><span className="pf-label">Fim</span>
                <input className="pf-input" name="fim" type="datetime-local" required value={ev.fim} onChange={(e) => alterarEvento({ fim: e.target.value })} /></label>
              <label className="pf-field"><span className="pf-label">Responsável</span>
                <input className="pf-input" name="responsavel" required maxLength={100} value={ev.responsavel} onChange={(e) => alterarEvento({ responsavel: e.target.value })} /></label>
              <label className="pf-field"><span className="pf-label">Situação</span>
                <select className="pf-select" name="situacao" required value={ev.situacao} onChange={(e) => alterarEvento({ situacao: e.target.value as SituacaoEvento })}>
                  {STATUS_EVENTO.map((s) => <option key={s} value={s}>{ROTULOS[s]}</option>)}
                </select>
              </label>
              <label className="pf-field"><span className="pf-label">Veículos previstos</span>
                <input className="pf-input" name="veiculos" type="number" min={0} step={1} required value={ev.veiculosPrevistos ?? ''}
                  onChange={(e) => alterarEvento({ veiculosPrevistos: numeroOuNulo(e.target.value) as number })} /></label>
              <label className="pf-field"><span className="pf-label">Capacidade</span>
                <input className="pf-input" name="capacidade" type="number" min={0} step={1} required value={ev.capacidade ?? ''}
                  onChange={(e) => alterarEvento({ capacidade: numeroOuNulo(e.target.value) as number })} /></label>
              <label className="pf-field"><span className="pf-label">Equipe prevista</span>
                <input className="pf-input" name="equipe" type="number" min={0} step={1} required value={ev.equipePrevista ?? ''}
                  onChange={(e) => alterarEvento({ equipePrevista: numeroOuNulo(e.target.value) as number })} /></label>
              <label className="pf-field"><span className="pf-label">Valor contratado (R$)</span>
                <input className="pf-input" name="valor" type="number" min={0} step={0.01} value={ev.valorContratado ?? ''}
                  onChange={(e) => alterarEvento({ valorContratado: numeroOuNulo(e.target.value) })} /></label>
              <label className="pf-field"><span className="pf-label">Despesas previstas (R$)</span>
                <input className="pf-input" name="despesas" type="number" min={0} step={0.01} value={ev.despesasPrevistas ?? ''}
                  onChange={(e) => alterarEvento({ despesasPrevistas: numeroOuNulo(e.target.value) })} /></label>
            </div>
            <p className="secundario">Use o horário de São Paulo. Valores informados aqui servem ao planejamento do evento.</p>
            <label className="pf-field"><span className="pf-label">Observações</span>
              <textarea className="pf-input" name="observacoes" rows={3} maxLength={1000} value={ev.observacoes} onChange={(e) => alterarEvento({ observacoes: e.target.value })} /></label>
            {erroForm && <p className="pf-error" role="alert">{erroForm}</p>}
            <footer>
              <button type="button" className="pf-btn pf-btn--ghost" onClick={() => setEventoEditado(null)}>Voltar</button>
              <button type="submit" className="pf-btn pf-btn--primary" disabled={!eventoValido || salvando}>{salvando ? 'Salvando…' : 'Salvar evento'}</button>
            </footer>
          </form>
        </Modal>
      )}

      {es && (
        <Modal titulo={es.id ? 'Editar escala' : 'Nova escala'} aoFechar={() => setEscalaEditada(null)}>
          <form onSubmit={(e) => (escalaValida ? salvar(e, es) : e.preventDefault())}>
            <div className="grade">
              <label className="pf-field"><span className="pf-label">Unidade</span>
                <select className="pf-select" name="unidade" required value={es.unidadeId ?? ''} onChange={(e) => trocarUnidadeDaEscala(numeroOuNulo(e.target.value))}>
                  <option value="" disabled>Selecione</option>
                  {unidades.map((u) => <option key={u.id} value={u.id} disabled={u.ativa === false && u.id !== es.unidadeId}>{u.nome}</option>)}
                </select>
              </label>
              <label className="pf-field"><span className="pf-label">Evento (opcional)</span>
                <select className="pf-select" name="evento" value={es.eventoId ?? ''} disabled={consultandoEventos || !es.unidadeId}
                  onChange={(e) => alterarEscala({ eventoId: numeroOuNulo(e.target.value) })}>
                  <option value="">Sem evento vinculado</option>
                  {eventosDaUnidade.map((evento) => <option key={evento.id} value={evento.id}>{evento.nome}</option>)}
                  {es.eventoId && !eventosDaUnidade.length && <option value={es.eventoId}>Evento #{es.eventoId}</option>}
                </select>
              </label>
              <label className="pf-field"><span className="pf-label">Início</span>
                <input className="pf-input" name="inicio" type="datetime-local" required value={es.inicio} onChange={(e) => alterarEscala({ inicio: e.target.value })} /></label>
              <label className="pf-field"><span className="pf-label">Fim</span>
                <input className="pf-input" name="fim" type="datetime-local" required value={es.fim} onChange={(e) => alterarEscala({ fim: e.target.value })} /></label>
              <label className="pf-field"><span className="pf-label">Responsável</span>
                <input className="pf-input" name="responsavel" required maxLength={100} value={es.responsavel} onChange={(e) => alterarEscala({ responsavel: e.target.value })} /></label>
              <label className="pf-field"><span className="pf-label">Situação</span>
                <select className="pf-select" name="situacao" required value={es.situacao} onChange={(e) => alterarEscala({ situacao: e.target.value as SituacaoEscala })}>
                  {STATUS_ESCALA.map((s) => <option key={s} value={s}>{ROTULOS[s]}</option>)}
                </select>
              </label>
            </div>
            {erroEventos && <p className="pf-error" role="alert">{erroEventos}</p>}
            <fieldset className="papeis">
              <legend className="pf-label">Manobristas</legend>
              {manobristas.length ? manobristas.map((m) => (m.ativo !== false || es.manobristaIds.includes(m.id)) && (
                <label key={m.id}>
                  <input type="checkbox" checked={es.manobristaIds.includes(m.id)}
                    onChange={(e) => alterarEscala({ manobristaIds: e.target.checked ? [...es.manobristaIds, m.id] : es.manobristaIds.filter((x) => x !== m.id) })} />
                  {' '}{m.nome}
                </label>
              )) : <p>Cadastre os manobristas antes de montar a escala.</p>}
            </fieldset>
            <label className="pf-field"><span className="pf-label">Observações ou motivo da substituição</span>
              <textarea className="pf-input" name="observacoes" rows={3} maxLength={1000} value={es.observacoes} onChange={(e) => alterarEscala({ observacoes: e.target.value })} /></label>
            {erroForm && <p className="pf-error" role="alert">{erroForm}</p>}
            {es.id && (
              <div className="historico">
                <div>
                  <button type="button" className="pf-btn pf-btn--ghost" disabled={carregandoHistorico} onClick={() => verHistorico(es.id!)}>
                    {carregandoHistorico ? 'Carregando…' : 'Consultar alterações'}
                  </button>
                </div>
                {erroHistorico && <p className="pf-error" role="alert">{erroHistorico}</p>}
                {historico && (
                  <ul>
                    {historico.length ? historico.map((r) => (
                      <li key={r.id}>{dataHora(r.registradoEm, 'dd/MM/yyyy HH:mm', '-0300')} · {r.ator} · {ROTULOS[r.situacao]}</li>
                    )) : <li>Nenhuma mudança registrada.</li>}
                  </ul>
                )}
              </div>
            )}
            <footer>
              <button type="button" className="pf-btn pf-btn--ghost" onClick={() => setEscalaEditada(null)}>Voltar</button>
              <button type="submit" className="pf-btn pf-btn--primary" disabled={!escalaValida || salvando}>{salvando ? 'Salvando…' : 'Salvar escala'}</button>
            </footer>
          </form>
        </Modal>
      )}
    </pf-agenda>
  );
}
