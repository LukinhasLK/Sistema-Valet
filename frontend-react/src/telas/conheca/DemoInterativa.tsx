import { useEffect, useReducer, useRef, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { Icone } from '../../compartilhado/Icone';
import { moeda, numero } from '../../compartilhado/formatos';
import { PerdidinhoDiz } from '../../compartilhado/perdidinho/PerdidinhoDiz';
import { useMovimentoReduzido } from '../../nucleo/estado/layout';
import { Ficha } from '../../nucleo/modelos';
import type { HumorMascote } from '../../nucleo/onboarding/mascote';
import { calcSaldoFinal, calcTotalCarros } from '../../nucleo/servicos/calc';
import { FichaPapel } from '../fichas/FichaPapel';
import './demo-interativa.scss';

/**
 * Demo interativa do "Como funciona": o turno inteiro com dados fictícios, só no navegador.
 * Nada é enviado (sem rede, sem localStorage); o cálculo é o mesmo do sistema (nucleo/servicos/calc).
 * Estado visual em data-* (ver demo-interativa.scss).
 */

const ETAPAS = [
  { icone: 'fichas', titulo: 'Lance o turno', texto: 'O operador digita o ticket final e a conta sai sozinha.' },
  { icone: 'enviar', titulo: 'Confira como gestor', texto: 'A gestão confere e, se algo não bate, devolve com o motivo.' },
  { icone: 'sucesso', titulo: 'Feche o caixa', texto: 'A ficha fica bloqueada e o histórico permanece registrado.' },
  { icone: 'pagamentos', titulo: 'Pague a equipe', texto: 'Diárias com a chave Pix; você paga pelo banco e confirma aqui.' },
] as const;

const UNIDADE = 'Unidade Exemplo';
const TICKET_INICIAL = 1200;
const CANCELADOS = 2;
const EXEMPLO = 1342;
const DINHEIRO = 1500;
const CARTAO = 900;
const PIX = 600;
const EQUIPE = [
  { id: 1, nome: 'Ana', pix: 'a•••@exemplo.com', diaria: 150 },
  { id: 2, nome: 'Bruno', pix: 'b•••@exemplo.com', diaria: 150 },
];
const HISTORICO = ['Lançada e enviada pelo operador', 'Conferida pela gestão', 'Fechada pela gestão'];
const MOTIVO_DEVOLUCAO = 'Devolvida: ticket final não confere';
const ESPERA_ANUNCIO_MS = 500;

interface Estado {
  passo: 1 | 2 | 3 | 4;
  final: string;
  devolvida: boolean;
  fechada: boolean;
  pagos: boolean[];
  interagiu: boolean;
  /** Muda a cada recomeço: devolve o foco ao título mesmo se já estava no passo 1. */
  rodada: number;
}

type Acao =
  | { tipo: 'digitar'; valor: string }
  | { tipo: 'enviar' | 'conferir' | 'devolver' | 'fechar' | 'seguir' | 'recomecar' }
  | { tipo: 'pagar'; indice: number };

const INICIAL: Estado = { passo: 1, final: '', devolvida: false, fechada: false, pagos: EQUIPE.map(() => false), interagiu: false, rodada: 0 };

/** Um turno tem no máximo alguns milhares de tickets: acima disso é erro de digitação. */
const MAXIMO_NO_TURNO = 5000;
const valida = (final: string) => Number(final) > TICKET_INICIAL && Number(final) - TICKET_INICIAL <= MAXIMO_NO_TURNO;

function reduzir(e: Estado, a: Acao): Estado {
  switch (a.tipo) {
    case 'digitar': return { ...e, final: a.valor.replace(/\D/g, '').slice(0, 6), devolvida: false, interagiu: true };
    case 'enviar': return valida(e.final) ? { ...e, passo: 2, devolvida: false, interagiu: true } : e;
    case 'devolver': return e.passo === 2 ? { ...e, passo: 1, devolvida: true, interagiu: true } : e;
    case 'conferir': return e.passo === 2 ? { ...e, passo: 3, interagiu: true } : e;
    case 'fechar': return e.passo === 3 ? { ...e, fechada: true } : e;
    case 'seguir': return e.passo === 3 && e.fechada ? { ...e, passo: 4 } : e;
    case 'pagar': return e.passo === 4 ? { ...e, pagos: e.pagos.map((p, i) => (i === a.indice ? true : p)) } : e;
    case 'recomecar': return { ...INICIAL, interagiu: true, rodada: e.rodada + 1 };
  }
}

function guiaDe(e: Estado): { estado: string; humor: HumorMascote; texto: string } {
  const n = calcTotalCarros(TICKET_INICIAL, Number(e.final), CANCELADOS);
  switch (e.passo) {
    case 1:
      if (e.devolvida) return { estado: 'devolvida', humor: 'triste', texto: 'Devolvida com o motivo. O operador corrige e envia de novo.' };
      if (!e.final) return { estado: 'inicio', humor: 'acenando', texto: 'Você é o operador. Digite o número do último ticket do turno.' };
      if (!valida(e.final)) return Number(e.final) > TICKET_INICIAL
        ? { estado: 'invalido', humor: 'surpreso', texto: 'Esse número parece alto demais para um turno. Confira.' }
        : { estado: 'invalido', humor: 'surpreso', texto: 'O ticket final precisa ser maior que o inicial.' };
      return { estado: 'valido', humor: 'explicando', texto: `${numero(n)} carros: final menos inicial menos cancelados. O saldo já está calculado.` };
    case 2:
      return { estado: 'conferencia', humor: 'apontando', texto: 'Agora você é a gestão. Confira tickets, recebimentos e equipe.' };
    case 3:
      return e.fechada
        ? { estado: 'fechada', humor: 'comemorando', texto: 'Carimbado. Quem lançou, conferiu e fechou fica no histórico.' }
        : { estado: 'aberta', humor: 'apontando', texto: 'Fechar o caixa trava a ficha. Depois, ninguém altera os números.' };
    default:
      if (e.pagos.every(Boolean)) return { estado: 'fim', humor: 'feliz', texto: 'Tudo registrado, do turno ao pagamento. Quer usar no seu estacionamento?' };
      if (e.pagos.some(Boolean)) {
        const falta = e.pagos.filter((p) => !p).length;
        return { estado: 'pagando', humor: 'feliz', texto: falta === 1 ? 'Pago. Falta 1 diária.' : `Pago. Faltam ${falta} diárias.` };
      }
      return { estado: 'pagando', humor: 'explicando', texto: 'As diárias aparecem com a chave Pix. Você paga pelo seu banco e confirma aqui.' };
  }
}

export default function DemoInterativa() {
  const [e, enviar] = useReducer(reduzir, INICIAL);
  const reduzirMovimento = useMovimentoReduzido();
  const titulo = useRef<HTMLHeadingElement>(null);
  const palco = useRef<HTMLDivElement>(null);
  const seguir = useRef<HTMLButtonElement>(null);
  const chaveFoco = useRef(`${e.passo}-${e.rodada}`);
  const fechadaAntes = useRef(e.fechada);

  const final = Number(e.final);
  const ok = valida(e.final);
  const carros = ok ? calcTotalCarros(TICKET_INICIAL, final, CANCELADOS) : 0;
  const saldo = calcSaldoFinal({
    valorDinheiro: DINHEIRO, valorCartao: CARTAO, valorPix: PIX, taxaMaquininha: 0,
    manobristas: EQUIPE.map((m) => ({ manobristaId: m.id, diaria: m.diaria })), despesasAdicionais: [],
  });
  const guia = guiaDe(e);
  // O balão é a única fonte de anúncio do progresso dos pagamentos e do motivo da devolução, então fica vivo
  // nas trocas de passo. Só se cala enquanto se digita o ticket (passo 1): ali o texto muda a cada tecla e o
  // total já é anunciado, com espera, pelo status abaixo (evita anúncio duplo e rajada).
  const digitando = e.passo === 1 && !e.devolvida && !!e.final;
  const anunciarBalao = e.interagiu && !digitando;
  const etapa = ETAPAS[e.passo - 1];
  const recebimentos = DINHEIRO + CARTAO + PIX;
  const fim = e.passo === 4 && e.pagos.every(Boolean);

  // Ao trocar de passo (ou recomeçar), o foco vai para o título do passo. Comparar com a chave anterior
  // (e não "pular o primeiro efeito") mantém a montagem dupla do StrictMode sem roubar o foco.
  useEffect(() => {
    const chave = `${e.passo}-${e.rodada}`;
    if (chave === chaveFoco.current) return;
    chaveFoco.current = chave;
    titulo.current?.focus({ preventScroll: true });
    // Se o topo do palco (balão + título) ficou fora da vista ou sob o cabeçalho fixo, traz de volta.
    const el = palco.current;
    if (el && e.interagiu && el.getBoundingClientRect().top < 72) {
      el.scrollIntoView({ block: 'start', behavior: reduzirMovimento ? 'auto' : 'smooth' });
    }
  }, [e.passo, e.rodada]);

  // Ao fechar o caixa, o botão "Fechar caixa" some: o foco segue para a ação seguinte.
  useEffect(() => {
    if (e.fechada && !fechadaAntes.current) seguir.current?.focus({ preventScroll: true });
    fechadaAntes.current = e.fechada;
  }, [e.fechada]);

  // Total anunciado ao leitor de tela só depois de 500 ms sem digitar (o visual troca na hora).
  const [anuncio, setAnuncio] = useState('');
  // O Perdidinho olha para o conteúdo enquanto um controle da etapa tem foco.
  const [olhandoConteudo, setOlhandoConteudo] = useState(false);
  useEffect(() => {
    if (!e.interagiu || e.passo !== 1) { setAnuncio(''); return; }
    if (!ok) { setAnuncio(''); return; }
    const espera = setTimeout(() => setAnuncio(`Total: ${numero(carros)} carros`), ESPERA_ANUNCIO_MS);
    return () => clearTimeout(espera);
  }, [e.interagiu, e.passo, ok, carros]);

  const [estreita, setEstreita] = useState(() => window.matchMedia('(max-width: 640px)').matches);
  useEffect(() => {
    const m = window.matchMedia('(max-width: 640px)');
    const aoMudar = () => setEstreita(m.matches);
    aoMudar();
    m.addEventListener('change', aoMudar);
    return () => m.removeEventListener('change', aoMudar);
  }, []);

  const ficha = {
    id: 1, data: '2026-03-14', unidadeId: 1, turno: 'dia', fichaInicio: TICKET_INICIAL, fichaFim: ok ? final : TICKET_INICIAL,
    fichasCanceladas: CANCELADOS, totalCarros: carros, valorDinheiro: DINHEIRO, valorCartao: CARTAO, valorPix: PIX,
    taxaMaquininha: 0, manobristas: EQUIPE.map((m) => ({ manobristaId: m.id, diaria: m.diaria })), despesasAdicionais: [],
    totalBruto: DINHEIRO + CARTAO + PIX, totalLiquido: saldo,
  } as Ficha;

  const invalido = !!e.final && !ok;

  return (
    <div className="demo" data-passo={e.passo}>
      <div className="demo__cabeca">
        <span className="demo__janela" aria-hidden="true"><span /><span /><span /></span>
        <p className="demo__unidade">Park Flash · {UNIDADE}</p>
        <span className="demo__selo">Demonstração · dados fictícios</span>
        {e.interagiu && !fim && (
          <button type="button" className="pf-btn pf-btn--ghost pf-btn--sm demo__recomecar" onClick={() => enviar({ tipo: 'recomecar' })}>Recomeçar</button>
        )}
      </div>

      <div className="demo__barra" aria-hidden="true">Etapa {e.passo} de {ETAPAS.length}</div>

      <ol className="demo__passos" aria-label="Passos da demonstração" style={{ '--demo-progresso': (e.passo - 1) / (ETAPAS.length - 1) } as CSSProperties}>
        {ETAPAS.map((p, i) => (
          <li key={p.titulo} className="demo__passo" aria-current={i + 1 === e.passo ? 'step' : undefined}
            data-estado={i + 1 < e.passo ? 'feito' : i + 1 === e.passo ? 'atual' : 'futuro'}>
            <span className="demo__passo-icone" aria-hidden="true"><Icone nome={p.icone} tamanho={18} /></span>
            <div><p className="demo__passo-titulo">{p.titulo}</p><p className="demo__passo-texto">{p.texto}</p></div>
          </li>
        ))}
      </ol>

      <div ref={palco} className="demo__palco" data-passo={e.passo} data-estado={guia.estado}>
        <div className="demo__guia">
          <PerdidinhoDiz humor={guia.humor} texto={guia.texto} lado="esquerda" tamanho={estreita ? 40 : 56}
            anunciar={anunciarBalao} reduzirMovimento={reduzirMovimento}
            olhar={olhandoConteudo ? { x: 0.2, y: 1 } : undefined} />
        </div>

        <div className="demo__conteudo" key={`${e.passo}-${e.rodada}`}
          onFocus={(ev) => setOlhandoConteudo(ev.target !== titulo.current)}
          onBlur={(ev) => { if (!ev.currentTarget.contains(ev.relatedTarget as Node | null)) setOlhandoConteudo(false); }}>
          <h3 ref={titulo} tabIndex={-1} className="demo__titulo">
            <span className="pf-sr-only">Etapa {e.passo} de {ETAPAS.length} · </span>{etapa.titulo}
          </h3>

          {e.passo === 1 && (
            <>
              {e.devolvida && <p className="demo__faixa-devolvida"><Icone nome="alerta" tamanho={16} />{MOTIVO_DEVOLUCAO}</p>}
              <p className="demo__dado">Ticket inicial <strong>{numero(TICKET_INICIAL)}</strong> · Cancelados <strong>{CANCELADOS}</strong></p>
              <div className="demo__campo">
                <label htmlFor="demo-ticket-final">Ticket final</label>
                <input id="demo-ticket-final" type="text" inputMode="numeric" autoComplete="off" value={e.final}
                  aria-invalid={invalido ? true : undefined}
                  aria-describedby={invalido ? 'demo-dica demo-erro' : 'demo-dica'}
                  onChange={(ev) => enviar({ tipo: 'digitar', valor: ev.target.value })} />
                <p id="demo-dica" className="demo__dica">Número do último ticket entregue no turno.</p>
              </div>
              {invalido && <p id="demo-erro" className="demo__erro">O ticket final precisa ser maior que o inicial.</p>}
              <button type="button" className="pf-btn pf-btn--ghost pf-btn--sm demo__exemplo"
                onClick={() => enviar({ tipo: 'digitar', valor: String(EXEMPLO) })}>Preencher para mim</button>
              <div className="demo__total" data-valido={ok || undefined}>
                <span id="demo-total-rotulo">Total de carros</span>
                <output aria-labelledby="demo-total-rotulo" aria-live="off">{ok ? numero(carros) : '—'}</output>
                <span className="demo__saldo">Saldo do turno <strong>{ok ? moeda(saldo) : '—'}</strong></span>
              </div>
              <span className="pf-sr-only" role="status">{anuncio}</span>
              <button type="button" className="pf-btn pf-btn--primary demo__acao" disabled={!ok}
                onClick={() => enviar({ tipo: 'enviar' })}>Enviar para conferência</button>
            </>
          )}

          {e.passo === 2 && (
            <>
              <dl className="demo__resumo">
                <div><dt>Tickets</dt><dd>#{numero(TICKET_INICIAL)} a #{numero(final)}</dd></div>
                <div><dt>Carros</dt><dd>{numero(carros)}</dd></div>
                <div><dt>Dinheiro</dt><dd>{moeda(DINHEIRO)}</dd></div>
                <div><dt>Cartão</dt><dd>{moeda(CARTAO)}</dd></div>
                <div><dt>Pix</dt><dd>{moeda(PIX)}</dd></div>
                <div><dt>Equipe</dt><dd>{EQUIPE.map((m) => m.nome).join(' e ')}</dd></div>
                <div className="demo__resumo-saldo"><dt>Saldo final</dt><dd>{moeda(saldo)}</dd></div>
              </dl>
              <p className="demo__resumo-nota">
                {moeda(recebimentos)} de recebimentos menos {moeda(recebimentos - saldo)} de diárias e despesas.
              </p>
              <div className="demo__acoes">
                <button type="button" className="pf-btn pf-btn--primary demo__acao" onClick={() => enviar({ tipo: 'conferir' })}>Conferir</button>
                <button type="button" className="pf-btn pf-btn--ghost demo__acao" onClick={() => enviar({ tipo: 'devolver' })}>Devolver ao operador</button>
              </div>
              <p className="demo__nota">Se algo não bate, a ficha volta ao operador com o motivo escrito.</p>
            </>
          )}

          {e.passo === 3 && (
            <>
              <FichaPapel ficha={ficha} unidade={UNIDADE} fechada={e.fechada} mascote={false} />
              {e.fechada && (
                <ol className="demo__historico" aria-label="Histórico da ficha">
                  {HISTORICO.map((linha) => <li key={linha}>{linha}</li>)}
                </ol>
              )}
              <div className="demo__acoes">
                {e.fechada
                  ? <button ref={seguir} type="button" className="pf-btn pf-btn--primary demo__acao" onClick={() => enviar({ tipo: 'seguir' })}>Ir para o pagamento</button>
                  : <button type="button" className="pf-btn pf-btn--primary demo__acao" onClick={() => enviar({ tipo: 'fechar' })}>Fechar caixa</button>}
              </div>
            </>
          )}

          {e.passo === 4 && (
            <>
              <ul className="demo__equipe">
                {EQUIPE.map((m, i) => (
                  <li key={m.id} data-pago={e.pagos[i] || undefined}>
                    <div>
                      <p className="demo__equipe-nome">{m.nome} · {moeda(m.diaria)}</p>
                      <p className="demo__equipe-pix">Chave Pix: {m.pix}</p>
                    </div>
                    <button type="button" className="pf-btn pf-btn--ghost demo__acao"
                      aria-label={e.pagos[i] ? `Diária de ${m.nome} paga` : `Marcar diária de ${m.nome} como paga`}
                      aria-disabled={e.pagos[i] || undefined}
                      onClick={() => { if (!e.pagos[i]) enviar({ tipo: 'pagar', indice: i }); }}>
                      {e.pagos[i] ? <><Icone nome="check" tamanho={16} />Pago</> : 'Marcar como pago'}
                    </button>
                  </li>
                ))}
              </ul>
              {fim && (
                <div className="demo__fim">
                  <Link className="pf-btn pf-btn--primary demo__acao" to="/planos">Ver planos<Icone nome="seta" tamanho={16} /></Link>
                  <button type="button" className="pf-btn pf-btn--ghost demo__acao demo__recomecar" onClick={() => enviar({ tipo: 'recomecar' })}>Recomeçar</button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
