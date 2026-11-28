import { useCallback, useEffect, useRef, useState } from 'react';
import { Icone } from '../Icone';
import { DURACAO, reduzido } from '../movimento';
import './balao-companheiro.scss';

/**
 * BalaoCompanheiro: o recado curto do Perdidinho (fato + ação), sem mascote, sem som.
 *
 * - `barra` (desktop): pílula de uma linha DENTRO da barra superior, à esquerda do botão do Perdidinho, com um
 *   indicador apontando para ele. Texto com reticências (o completo fica no histórico), ação e X. Nada flutua.
 * - `faixa` (celular): bloco no fluxo, logo abaixo do cabeçalho. Empurra o conteúdo (nada flutua).
 *
 * Acessibilidade:
 * - Faixa: o texto fica numa região `role="status"` (`aria-live="polite"`), preenchida depois da montagem
 *   para ser anunciada uma vez. Barra: a região viva é única e mora no AjudantePerdidinho (fala + contagem, sem
 *   anúncio duplo), então aqui o texto é só visual. O componente nunca toma o foco.
 * - Fecha pelo X ("Fechar mensagem"), por Esc (exceto com outro diálogo modal aberto), pelo tempo
 *   ou depois da ação. O tempo pausa com o ponteiro em cima, com foco dentro e com a aba oculta
 *   (WCAG 2.2.1); ao voltar, sobra pelo menos `FOLGA_MS` para terminar de ler.
 * - `aoFechar(motivo)` é chamado depois da saída. Se quem chama desmontar o balão durante a saída
 *   (ex.: a ação navegou), o aviso sai na desmontagem, sem se perder.
 *
 * Movimento (só transform/opacity no balão; altura só na faixa, uma vez e curta):
 * - Entrada: DURACAO.base + CURVA.saida (barra: opacidade + x 8→0, 190 ms). Saída: 140 ms + CURVA.entrada.
 * - Reduzir movimento (sistema ou `reduzirMovimento`): só opacidade, 120 ms.
 */
export interface PropsBalaoCompanheiro {
  /** 'barra' = desktop, dentro da barra superior; 'faixa' = celular, presa ao topo abaixo do cabeçalho, empurra o conteúdo. */
  variante: 'barra' | 'faixa';
  texto: string;
  /** Ação opcional (link/botão). */
  acao?: { rotulo: string; aoClicar: () => void };
  /** Chamado ao fechar (X, Esc, tempo esgotado ou depois da ação). motivo para telemetria/histórico. */
  aoFechar: (motivo: 'fechar' | 'tempo' | 'acao') => void;
  /** Tempo de vida em ms (padrão 8000; 10000 na barra); pausa enquanto houver hover ou foco dentro. 0 = sem tempo. */
  duracaoMs?: number;
  reduzirMovimento?: boolean;
}

type Motivo = Parameters<PropsBalaoCompanheiro['aoFechar']>[0];

/** Saída normal (igual a `balc-sai`/`balc-recolhe` no SCSS). */
export const SAIDA_BALAO_MS = Math.round(DURACAO.rapida * 1000);
/** Saída com reduzir movimento: só opacidade. */
export const SAIDA_BALAO_REDUZIDA_MS = 120;
/** Depois de uma pausa, o recado fica pelo menos este tempo antes de sumir sozinho. */
export const FOLGA_MS = 1500;

export function BalaoCompanheiro({
  variante, texto, acao, aoFechar, duracaoMs = variante === 'barra' ? 10_000 : 8000, reduzirMovimento = false,
}: PropsBalaoCompanheiro): JSX.Element {
  const raiz = useRef<HTMLElement>(null);
  const [pronto, setPronto] = useState(false);
  const [saindo, setSaindo] = useState(false);
  const [fechado, setFechado] = useState(false);
  const [emCima, setEmCima] = useState(false);
  const [focoDentro, setFocoDentro] = useState(false);
  const [abaOculta, setAbaOculta] = useState(() => typeof document !== 'undefined' && document.hidden);
  const parado = reduzirMovimento || reduzido();

  const aoFecharAtual = useRef(aoFechar);
  const pendente = useRef<Motivo | null>(null);
  const espera = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const restante = useRef(duracaoMs);
  const pausou = useRef(false);

  useEffect(() => { aoFecharAtual.current = aoFechar; }, [aoFechar]);

  // Região viva montada vazia e preenchida em seguida: o leitor de tela anuncia o texto uma vez.
  useEffect(() => { setPronto(true); }, []);

  // Desmontagem no meio da saída: avisa o motivo mesmo assim.
  useEffect(() => () => {
    clearTimeout(espera.current);
    if (pendente.current) {
      const motivo = pendente.current;
      pendente.current = null;
      aoFecharAtual.current(motivo);
    }
  }, []);

  const fechar = useCallback((motivo: Motivo) => {
    if (pendente.current || fechado) return;
    pendente.current = motivo;
    setSaindo(true);
    espera.current = setTimeout(() => {
      pendente.current = null;
      setFechado(true);
      aoFecharAtual.current(motivo);
    }, parado ? SAIDA_BALAO_REDUZIDA_MS : SAIDA_BALAO_MS);
  }, [fechado, parado]);

  // Aba em segundo plano também pausa: ninguém perde o recado por trocar de aba.
  useEffect(() => {
    const aoMudar = () => setAbaOculta(document.hidden);
    document.addEventListener('visibilitychange', aoMudar);
    return () => document.removeEventListener('visibilitychange', aoMudar);
  }, []);

  // Tempo de vida: corre só sem pausa; a limpeza desconta o que já passou.
  useEffect(() => { restante.current = duracaoMs; pausou.current = false; }, [duracaoMs]);
  const pausado = emCima || focoDentro || abaOculta;
  useEffect(() => {
    if (!duracaoMs || saindo || fechado) return;
    if (pausado) { pausou.current = true; return; }
    const prazo = pausou.current ? Math.min(duracaoMs, Math.max(restante.current, FOLGA_MS)) : restante.current;
    const inicio = Date.now();
    const relogio = setTimeout(() => fechar('tempo'), prazo);
    return () => {
      clearTimeout(relogio);
      restante.current = Math.max(0, prazo - (Date.now() - inicio));
    };
  }, [duracaoMs, pausado, saindo, fechado, fechar]);

  // Esc fecha, a não ser que um diálogo modal (que não seja este) esteja aberto.
  useEffect(() => {
    if (fechado) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      const modal = document.querySelector('[aria-modal="true"], dialog[open]');
      if (modal && !modal.contains(raiz.current)) return;
      fechar('fechar');
    };
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [fechado, fechar]);

  const aoAgir = () => {
    acao?.aoClicar();
    fechar('acao');
  };

  if (fechado) return <></>;

  const faixa = variante === 'faixa';
  const barra = variante === 'barra';

  // Estado em data-* (no React 18, `className` em elemento customizado vira o atributo "classname").
  return (
    <pf-balao-companheiro ref={raiz} data-variante={variante} data-pronto={pronto || undefined}
      data-parado={parado || undefined} data-saindo={saindo || undefined} data-pausado={pausado || undefined}
      onMouseEnter={() => setEmCima(true)} onMouseLeave={() => setEmCima(false)}
      onFocus={() => setFocoDentro(true)}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocoDentro(false); }}>
      <div className="balc__dobra">
        <div className="balc__cartao">
          {faixa && <span className="balc__icone" aria-hidden="true"><Icone nome="dica" tamanho={16} /></span>}
          {barra ? (
            <div className="balc__texto">{texto}</div>
          ) : (
            <div className="balc__texto" role="status" aria-live="polite" aria-atomic="true">
              {pronto ? texto : null}
            </div>
          )}
          {acao && (
            <button type="button" className="balc__acao" onClick={aoAgir}>
              {acao.rotulo}
            </button>
          )}
          <button type="button" className="balc__fechar" onClick={() => fechar('fechar')} aria-label="Fechar mensagem" title="Fechar (Esc)">
            <Icone nome="fechar" tamanho={16} />
          </button>
        </div>
      </div>
    </pf-balao-companheiro>
  );
}
