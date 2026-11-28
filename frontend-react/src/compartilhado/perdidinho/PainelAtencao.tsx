import { useEffect, useId, useRef, type RefObject } from 'react';
import { Link } from 'react-router-dom';
import { motion, useDragControls, useReducedMotion } from 'motion/react';
import { Icone } from '../Icone';
import { TRANSICAO } from '../movimento';
import { usePrenderFoco } from '../usePrenderFoco';
import type { Fala } from '../../nucleo/servicos/falas-estado';
import type { ItemPendencia, NivelPendencia } from '../../nucleo/servicos/pendencias';
import './painel-atencao.scss';

const GRUPOS: { nivel: NivelPendencia; titulo: string }[] = [
  { nivel: 'URGENTE', titulo: 'Urgente' },
  { nivel: 'ATENCAO', titulo: 'Atenção' },
  { nivel: 'INFO', titulo: 'Para saber' },
];

/** Largura a partir da qual a gaveta empurra o conteúdo (app-layout.scss). */
const LARGA = '(min-width: 1600px)';

export const TEXTO_EM_DIA = 'Tudo em dia por aqui. Bom turno!';

interface Props {
  id: string;
  /** `gaveta`: gaveta fixa à direita do desktop (não modal). `folha`: folha inferior do celular (padrão do "Mais"). */
  variante: 'gaveta' | 'folha';
  itens: ItemPendencia[];
  /** Histórico do dia: o que o Perdidinho disse (ou diria na barra/faixa) e ainda vale hoje. */
  falas?: Fala[];
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

function Conteudo({ itens, falas, tituloId, titulo, silenciado, temTour, comPendencia, aoFechar, aoNavegar, aoSilenciar, aoVoltarAvisar, aoReverTour, comFechar }: {
  itens: ItemPendencia[]; falas: Fala[]; tituloId: string; titulo: RefObject<HTMLHeadingElement>; silenciado: boolean; temTour: boolean; comPendencia: boolean; comFechar: boolean;
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

      <div className="painel__corpo">
      {itens.length === 0 && falas.length === 0 && (
        <p className="painel__vazio">{TEXTO_EM_DIA}</p>
      )}
      {itens.length > 0 && (
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

      {falas.length > 0 && (
        <section className="painel__grupo painel__disse" aria-labelledby={`${tituloId}-disse`}>
          <h3 id={`${tituloId}-disse`} className="painel__grupo-titulo">Hoje o Perdidinho disse</h3>
          <ul className="painel__lista">
            {falas.map((fala) => (
              <li key={fala.id} data-fala={fala.numero}>
                {fala.acao ? (
                  <Link className="painel__item" to={fala.acao.rota} onClick={aoNavegar}>
                    <span className="painel__texto">{fala.texto}<small className="painel__origem">{fala.acao.rotulo}</small></span>
                    <Icone nome="seta" tamanho={15} />
                  </Link>
                ) : (
                  <div className="painel__item painel__item--so-info"><span className="painel__texto">{fala.texto}</span></div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      </div>

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
 * Painel "Precisa da sua atenção". No desktop é uma gaveta NÃO modal à direita (380 px): o foco vai para o título,
 * Esc fecha e devolve o foco ao botão, Tab saindo da gaveta fecha; clicar fora fecha só quando ela sobrepõe o conteúdo
 * (< 1600 px; acima disso o layout a reserva e a pessoa segue trabalhando ao lado). No celular é uma folha inferior
 * no padrão do "Mais" (mesma mola, arrastar para baixo, foco preso). As seções são as mesmas nas duas.
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
      // Em telas largas a gaveta empurra o conteúdo: clicar nele é trabalhar, não dispensar.
      if (window.matchMedia(LARGA).matches) return;
      aoFechar(false);
    };
    // Tab saindo da gaveta (do último elemento para frente, ou do título/primeiro para trás) fecha: o foco segue o caminho natural.
    const aoTab = (e: KeyboardEvent) => {
      const c = caixa.current;
      if (folha || e.key !== 'Tab' || !c || !c.contains(document.activeElement)) return;
      const focaveis = [...c.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')];
      const ativo = document.activeElement as HTMLElement;
      const saiPraFrente = !e.shiftKey && (focaveis.length === 0 || ativo === focaveis[focaveis.length - 1]);
      const saiPraTras = e.shiftKey && (ativo === titulo.current || ativo === focaveis[0]);
      if (saiPraFrente || saiPraTras) aoFechar(false);
    };
    document.addEventListener('keydown', aoTeclar);
    if (!folha) document.addEventListener('keydown', aoTab);
    if (!folha) document.addEventListener('pointerdown', aoClicar);
    return () => {
      document.removeEventListener('keydown', aoTeclar);
      document.removeEventListener('pointerdown', aoClicar);
    };
  }, [aoFechar, botao, folha]);

  const conteudo = (
    <Conteudo itens={props.itens} falas={props.falas ?? []} tituloId={tituloId} titulo={titulo} silenciado={props.silenciado} temTour={props.temTour} comPendencia={props.comPendencia}
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
    <pf-painel-atencao data-variante="gaveta">
      <motion.div ref={caixa} id={id} className="painel painel--gaveta" role="dialog" aria-labelledby={tituloId}
        initial={reduzir ? { opacity: 0 } : { x: '100%' }} animate={reduzir ? { opacity: 1 } : { x: 0 }}
        exit={reduzir ? { opacity: 0, transition: TRANSICAO.saida } : { x: '100%', transition: TRANSICAO.saida }}
        transition={TRANSICAO.base}>
        {conteudo}
      </motion.div>
    </pf-painel-atencao>
  );
}
