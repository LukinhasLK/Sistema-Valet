import { PointerEvent as EventoPonteiro, useCallback, useEffect, useRef, useState } from 'react';
import { dataBr, moeda, numero } from '../../compartilhado/formatos';
import { Ficha } from '../../nucleo/modelos';
import './ficha-papel.scss';

/** Tamanho em que a assinatura é guardada (o desenho se adapta à largura da tela). */
const LARGURA = 600;
const ALTURA = 170;
const TINTA = '#0e4466';

interface Props {
  ficha: Ficha;
  unidade: string;
  /** Nome de quem está fechando: aparece abaixo da linha e serve para assinar digitando. */
  assinante: string;
  /** Chamado com a imagem PNG (data URL) quando há assinatura, ou null quando é apagada. */
  aoAssinar: (imagem: string | null) => void;
  /** true depois que o servidor confirmou o fechamento: o canhoto rasga e a ficha é carimbada. */
  fechada: boolean;
  desabilitado?: boolean;
}

/**
 * A ficha de caixa do turno desenhada como o papel do bloco: número de série, pautas,
 * linha de assinatura e o canhoto picotado que se destaca quando a ficha é fechada.
 */
export function FichaPapel({ ficha, unidade, assinante, aoAssinar, fechada, desabilitado }: Props) {
  const tela = useRef<HTMLCanvasElement>(null);
  const desenhando = useRef<{ x: number; y: number } | null>(null);
  const [assinada, setAssinada] = useState(false);
  const turno = ficha.turno === 'noite' ? 'Noite' : 'Dia';
  const serie = String(ficha.id).padStart(6, '0');

  const contexto = useCallback(() => {
    const ctx = tela.current?.getContext('2d');
    if (!ctx) return null;
    ctx.strokeStyle = TINTA;
    ctx.fillStyle = TINTA;
    ctx.lineWidth = 3.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    return ctx;
  }, []);

  useEffect(() => { contexto()?.clearRect(0, 0, LARGURA, ALTURA); }, [contexto]);

  const ponto = (e: EventoPonteiro<HTMLCanvasElement>) => {
    const caixa = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - caixa.left) / caixa.width) * LARGURA, y: ((e.clientY - caixa.top) / caixa.height) * ALTURA };
  };

  const concluir = () => {
    if (tela.current) aoAssinar(tela.current.toDataURL('image/png'));
    setAssinada(true);
  };

  function comecar(e: EventoPonteiro<HTMLCanvasElement>) {
    if (desabilitado || fechada) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = ponto(e);
    desenhando.current = p;
    const ctx = contexto();
    ctx?.beginPath();
    ctx?.arc(p.x, p.y, 1.4, 0, Math.PI * 2);
    ctx?.fill();
  }

  function mover(e: EventoPonteiro<HTMLCanvasElement>) {
    const anterior = desenhando.current;
    const ctx = contexto();
    if (!anterior || !ctx) return;
    const p = ponto(e);
    // Curva pelo ponto médio: traço contínuo, sem quinas, como caneta.
    const meio = { x: (anterior.x + p.x) / 2, y: (anterior.y + p.y) / 2 };
    ctx.beginPath();
    ctx.moveTo(anterior.x, anterior.y);
    ctx.quadraticCurveTo(anterior.x, anterior.y, meio.x, meio.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    desenhando.current = p;
  }

  function soltar() {
    if (!desenhando.current) return;
    desenhando.current = null;
    concluir();
  }

  function limpar() {
    contexto()?.clearRect(0, 0, LARGURA, ALTURA);
    setAssinada(false);
    aoAssinar(null);
  }

  /** Alternativa ao desenho (teclado, leitor de tela): escreve o nome na linha. */
  function assinarComNome() {
    const ctx = contexto();
    if (!ctx) return;
    ctx.clearRect(0, 0, LARGURA, ALTURA);
    ctx.font = "italic 600 54px 'Plus Jakarta Sans', 'Inter', system-ui, sans-serif";
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(assinante, 44, ALTURA - 40, LARGURA - 64);
    concluir();
  }

  return (
    <pf-ficha-papel>
      <div className={`papel${fechada ? ' papel--fechada' : ''}`}>
        <div className="papel__corpo">
          <header className="papel__topo">
            <div>
              <p className="papel__tipo">Ficha de caixa</p>
              <p className="papel__onde">{unidade} · {dataBr(ficha.data)} · Turno {turno}</p>
            </div>
            <p className="papel__serie" aria-label={`Ficha número ${ficha.id}`}>Nº {serie}</p>
          </header>

          <dl className="papel__linhas">
            <div><dt>Tickets</dt><dd>#{ficha.fichaInicio} a #{ficha.fichaFim}</dd></div>
            <div><dt>Carros</dt><dd>{numero(ficha.totalCarros)}</dd></div>
            <div><dt>Faturamento</dt><dd>{moeda(ficha.totalBruto)}</dd></div>
            <div className="papel__liquido"><dt>Líquido do turno</dt><dd>{moeda(ficha.totalLiquido)}</dd></div>
          </dl>

          <div className="papel__assinatura">
            <div className="papel__quadro">
            <canvas ref={tela} width={LARGURA} height={ALTURA} className="papel__tela"
              role="img" aria-label={assinada ? `Assinatura de ${assinante}` : 'Espaço para assinar com o dedo ou o mouse'}
              onPointerDown={comecar} onPointerMove={mover} onPointerUp={soltar} onPointerCancel={soltar} />
            <div className="papel__linha-assinar" aria-hidden="true"><span>x</span></div>
            </div>
            <p className="papel__assinante">{assinante} · conferiu e fechou</p>
            {!fechada && (
              <div className="papel__acoes">
                {assinada
                  ? <button type="button" className="pf-btn pf-btn--ghost pf-btn--sm" onClick={limpar} disabled={desabilitado}>Apagar assinatura</button>
                  : <button type="button" className="pf-btn pf-btn--ghost pf-btn--sm" onClick={assinarComNome} disabled={desabilitado}>Assinar com meu nome</button>}
              </div>
            )}
          </div>

          <p className="papel__carimbo" aria-hidden={!fechada}>Fechada</p>
        </div>

        <div className="papel__picote" aria-hidden="true" />

        <div className="papel__canhoto" aria-hidden="true">
          <span className="papel__serie papel__serie--canhoto">Nº {serie}</span>
          <span>{dataBr(ficha.data)} · {turno}</span>
          <strong>{moeda(ficha.totalLiquido)}</strong>
        </div>
      </div>
      {!fechada && !assinada && <p className="papel__instrucao">Assine na linha para liberar o fechamento.</p>}
    </pf-ficha-papel>
  );
}
