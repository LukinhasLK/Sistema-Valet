import { useEffect, useId, useRef, type RefObject } from 'react';
import { Link } from 'react-router-dom';
import { motion, useDragControls, useReducedMotion } from 'motion/react';
import { Icone } from '../Icone';
import { TRANSICAO, DURACAO, CURVA } from '../movimento';
import { usePrenderFoco } from '../usePrenderFoco';
import type { ItemPendencia, NivelPendencia } from '../../nucleo/servicos/pendencias';
import './painel-atencao.scss';

const GRUPOS: { nivel: NivelPendencia; titulo: string }[] = [
  { nivel: 'URGENTE', titulo: 'Urgente' },
  { nivel: 'ATENCAO', titulo: 'Atenção' },
  { nivel: 'INFO', titulo: 'Para saber' },
];

export const TEXTO_EM_DIA = 'Tudo em dia por aqui. Bom turno!';

interface Props {
  id: string;
  /** `desktop`: painel solto acima do companheiro, à direita (não modal). `folha`: folha inferior do celular (padrão do "Mais"). */
  variante: 'desktop' | 'folha';
  itens: ItemPendencia[];
  /** Botão que abre: cliques nele não contam como "fora" e o foco volta para ele no Esc. */
  botao: RefObject<HTMLElement>;
  silenciado: boolean;
  temTour: boolean;
  /** Há pendência de verdade (não só aviso de conexão): só então "Silenciar até amanhã" faz sentido. */
  comPendencia: boolean;
  /** `devolverFoco`: levar o foco de volta ao botão (Esc e botão Fechar). */
  aoFechar: (devolverFoco?: boolean) => void;
  aoSilenciar: () => void;
  aoVoltarAvisar: () => void;
  aoReverTour: () => void;
}

function Conteudo({ itens, tituloId, titulo, silenciado, temTour, comPendencia, aoFechar, aoNavegar, aoSilenciar, aoVoltarAvisar, aoReverTour, comFechar }: {
  itens: ItemPendencia[]; tituloId: string; titulo: RefObject<HTMLHeadingElement>; silenciado: boolean; temTour: boolean; comPendencia: boolean; comFechar: boolean;
  aoFechar: (devolverFoco?: boolean) => void; aoNavegar: () => void; aoSilenciar: () => void; aoVoltarAvisar: () => void; aoReverTour: () => void;
}) {
  return (
    <>
      <header className="painel__cabeca">
        <h2 id={tituloId} ref={titulo} tabIndex={-1} className="painel__titulo">Precisa da sua atenção</h2>
        {comFechar && (
          <button type="button" className="painel__fechar" aria-label="Fechar painel" title="Fechar (Esc)" onClick={() => aoFechar(true)}>
            <Icone nome="fechar" tamanho={16} />
          </button>
        )}
      </header>

      {itens.length === 0 ? (
        <p className="painel__vazio">{TEXTO_EM_DIA}</p>
      ) : (
        GRUPOS.map(({ nivel, titulo: nome }) => {
          const doGrupo = itens.filter((i) => i.nivel === nivel);
          if (!doGrupo.length) return null;
          return (
            <section key={nivel} className="painel__grupo" data-nivel={nivel} aria-labelledby={`${tituloId}-${nivel}`}>
              <h3 id={`${tituloId}-${nivel}`} className="painel__grupo-titulo">
                {nivel === 'URGENTE' && <Icone nome="alerta" tamanho={13} />}
                {nome}
              </h3>
              <ul className="painel__lista">
                {doGrupo.map((item) => (
                  <li key={item.id}>
                    {item.rota ? (
                      <Link className="painel__item" to={item.rota} onClick={aoNavegar}>
                        <span className="painel__texto">{item.texto}{item.grupo && <small className="painel__origem">{item.grupo}</small>}</span>
                        <span className="painel__qtd" aria-hidden="true">{item.quantidade}</span>
                        <Icone nome="seta" tamanho={15} />
                      </Link>
                    ) : (
                      <div className="painel__item painel__item--so-info">
                        <span className="painel__texto">{item.texto}{item.grupo && <small className="painel__origem">{item.grupo}</small>}</span>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}

      <footer className="painel__rodape">
        {(silenciado || comPendencia) && (
          <button type="button" className="pf-btn pf-btn--ghost pf-btn--sm" onClick={silenciado ? aoVoltarAvisar : aoSilenciar}>
            {silenciado ? 'Voltar a avisar' : 'Silenciar até amanhã'}
          </button>
        )}
        {temTour && <button type="button" className="pf-btn pf-btn--ghost pf-btn--sm" onClick={aoReverTour}>Rever tour</button>}
      </footer>
      {silenciado && <p className="painel__nota">Sem acenos até amanhã. O número continua valendo.</p>}
    </>
  );
}

/**
 * Painel "Precisa da sua atenção". No desktop é um painel NÃO modal acima do companheiro, alinhado à direita (360 px, no máximo 70% da altura):
 * o foco vai para o título, Esc fecha e devolve o foco ao botão, clicar fora fecha. No celular é uma folha inferior
 * no padrão do "Mais" (mesma mola, arrastar para baixo, foco preso).
 */
export function PainelAtencao(props: Props) {
  const { id, variante, botao, aoFechar } = props;
  const reduzir = useReducedMotion() ?? false;
  const titulo = useRef<HTMLHeadingElement>(null);
  const caixa = useRef<HTMLDivElement>(null);
  const tituloId = useId();
  const arrastar = useDragControls();
  const semCaixa = useRef<HTMLDivElement>(null);
  const folha = variante === 'folha';

  // Folha: foco preso, começa no título e volta ao botão ao fechar.
  usePrenderFoco(folha ? caixa : semCaixa, titulo);

  useEffect(() => {
    if (!folha) titulo.current?.focus({ preventScroll: true });
  }, [folha]);

  // Esc fecha (a não ser que outro diálogo modal esteja por cima); clicar fora fecha o painel desktop.
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      const modal = document.querySelector('[aria-modal="true"], dialog[open]');
      if (modal && !caixa.current?.contains(modal) && modal !== caixa.current) return;
      aoFechar(!folha);
    };
    const aoClicar = (e: PointerEvent) => {
      const alvo = e.target as Node;
      if (caixa.current?.contains(alvo) || botao.current?.contains(alvo)) return;
      aoFechar(false);
    };
    document.addEventListener('keydown', aoTeclar);
    if (!folha) document.addEventListener('pointerdown', aoClicar);
    return () => {
      document.removeEventListener('keydown', aoTeclar);
      document.removeEventListener('pointerdown', aoClicar);
    };
  }, [aoFechar, botao, folha]);

  const conteudo = (
    <Conteudo itens={props.itens} tituloId={tituloId} titulo={titulo} silenciado={props.silenciado} temTour={props.temTour} comPendencia={props.comPendencia}
      comFechar={!folha} aoFechar={aoFechar} aoNavegar={() => aoFechar(false)}
      aoSilenciar={props.aoSilenciar} aoVoltarAvisar={props.aoVoltarAvisar} aoReverTour={props.aoReverTour} />
  );

  if (folha) {
    return (
      <pf-painel-atencao data-variante="folha">
        <motion.div className="painel-fundo" onClick={() => aoFechar(false)}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: TRANSICAO.saida }} transition={TRANSICAO.rapida}>
          <motion.div ref={caixa} id={id} className="painel painel--folha" role="dialog" aria-modal="true" aria-labelledby={tituloId}
            onClick={(e) => e.stopPropagation()}
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%', transition: TRANSICAO.saida }} transition={TRANSICAO.mola}
            drag="y" dragListener={false} dragControls={arrastar} dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => { if (info.offset.y > 90 || info.velocity.y > 500) aoFechar(false); }}>
            <div className="painel__alca" aria-hidden="true" onPointerDown={(e) => arrastar.start(e)}><span className="painel__handle" /></div>
            {conteudo}
          </motion.div>
        </motion.div>
      </pf-painel-atencao>
    );
  }

  return (
    <pf-painel-atencao data-variante="desktop">
      <motion.div ref={caixa} id={id} className="painel painel--desktop" role="dialog" aria-labelledby={tituloId}
        initial={reduzir ? { opacity: 0 } : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        exit={reduzir ? { opacity: 0, transition: { duration: DURACAO.rapida } } : { opacity: 0, y: 8, transition: { duration: DURACAO.rapida, ease: CURVA.entrada } }}
        transition={TRANSICAO.base}>
        {conteudo}
      </motion.div>
    </pf-painel-atencao>
  );
}
