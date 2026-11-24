import { ReactNode, useLayoutEffect, useRef } from 'react';
import { useAnimate, useReducedMotion } from 'motion/react';
import { useIsMobile } from '../nucleo/estado/layout';
import { Icone } from './Icone';
import { TRANSICAO } from './movimento';
import { usePrenderFoco } from './usePrenderFoco';
import './modal.scss';

interface Props {
  titulo: string;
  /** Linha discreta abaixo do título (ex.: unidade e turno da ficha). */
  subtitulo?: ReactNode;
  largo?: boolean;
  /**
   * `centro`: diálogo clássico. `lateral`: painel à direita no desktop (a lista continua visível atrás),
   * folha que sobe de baixo no celular.
   */
  variante?: 'centro' | 'lateral';
  /** Elementos extras no cabeçalho, antes do botão fechar (ex.: navegação anterior/próxima). */
  cabecalho?: ReactNode;
  aoFechar: () => void;
  /** Conteúdo do rodapé fixo (antigo `[pfModalFooter]`). */
  rodape?: ReactNode;
  children?: ReactNode;
}

export function Modal({ titulo, subtitulo, largo = false, variante = 'centro', cabecalho, aoFechar, rodape, children }: Props) {
  const [escopo, animar] = useAnimate<HTMLDivElement>();
  const painel = useRef<HTMLDivElement>(null);
  const fechar = useRef<HTMLButtonElement>(null);
  const fechando = useRef(false);
  const aoFecharAtual = useRef(aoFechar);
  aoFecharAtual.current = aoFechar;
  const reduzir = useReducedMotion();
  const isMobile = useIsMobile();
  const lateral = variante === 'lateral' && !isMobile;

  // Foco inicial no próprio diálogo: o leitor de tela anuncia o título, sem anel de foco no botão fechar.
  usePrenderFoco(painel, painel);

  // Posição "fora da tela" de onde o painel entra e para onde volta ao fechar.
  const fora = lateral ? { x: 28, opacity: 0 } : isMobile ? { y: 40, opacity: 0 } : { y: 10, scale: 0.985, opacity: 0 };

  useLayoutEffect(() => {
    if (reduzir) return;
    void animar(escopo.current, { opacity: [0, 1] }, TRANSICAO.rapida);
    void animar(painel.current!, {
      opacity: [0, 1],
      ...(lateral ? { x: [28, 0] } : isMobile ? { y: [40, 0] } : { y: [10, 0], scale: [0.985, 1] }),
    }, TRANSICAO.mola);
    // Só na abertura: a variante não muda enquanto o painel está aberto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const solicitarFechamento = async (evento?: { stopPropagation(): void }) => {
    evento?.stopPropagation();
    if (fechando.current) return;
    fechando.current = true;
    if (!reduzir && escopo.current && painel.current) {
      await Promise.all([
        animar(escopo.current, { opacity: 0 }, TRANSICAO.saida),
        animar(painel.current, fora, TRANSICAO.saida),
      ]).catch(() => undefined);
    }
    aoFecharAtual.current();
  };

  return (
    <pf-modal>
      <div ref={escopo} className={`backdrop${lateral ? ' backdrop--lateral' : ''}`} onClick={() => solicitarFechamento()}>
        <div
          ref={painel}
          className={`sheet${largo ? ' sheet--wide' : ''}${lateral ? ' sheet--lateral' : ''}`}
          role="dialog"
          aria-modal="true"
          aria-label={titulo}
          tabIndex={-1}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); solicitarFechamento(e); } }}
        >
          <header className="sheet__head">
            <div className="sheet__titulos">
              <h2 className="sheet__title">{titulo}</h2>
              {subtitulo && <p className="sheet__subtitle">{subtitulo}</p>}
            </div>
            <div className="sheet__head-acoes">
              {cabecalho}
              <button ref={fechar} type="button" className="sheet__close" aria-label="Fechar" title="Fechar (Esc)" onClick={() => solicitarFechamento()}>
                <Icone nome="fechar" tamanho={18} />
              </button>
            </div>
          </header>
          <div className="sheet__body">{children}</div>
          <footer className="sheet__footer">{rodape}</footer>
        </div>
      </div>
    </pf-modal>
  );
}
