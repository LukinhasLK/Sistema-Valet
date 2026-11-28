import { ReactNode, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Dica } from './Dica';
import { Icone } from './Icone';
import { TRANSICAO } from './movimento';
import { Seletor } from './Seletor';
import './barra-filtros.scss';

export interface OpcaoFiltro<V extends string | number> {
  valor: V;
  rotulo: string;
}

interface PropsPilula<V extends string | number> {
  rotulo: string;
  icone?: string;
  valor: V;
  padrao: V;
  opcoes: OpcaoFiltro<V>[];
  aoMudar: (valor: V) => void;
}

/**
 * Etiqueta de filtro: mostra "Rótulo · Valor" e abre a lista de seleção do Park Flash
 * (mesma aparência em qualquer sistema; folha na parte de baixo no celular). Quando difere do padrão,
 * fica destacada e ganha um "×" para voltar ao padrão.
 */
export function FiltroPilula<V extends string | number>({ rotulo, icone, valor, padrao, opcoes, aoMudar }: PropsPilula<V>) {
  const ativa = valor !== padrao;
  const atual = opcoes.find((o) => o.valor === valor)?.rotulo ?? String(valor);
  return (
    <motion.span layout="position" transition={TRANSICAO.mola} className={`pilula${ativa ? ' pilula--ativa' : ''}`}>
      <Seletor rotulo={rotulo} valor={valor} opcoes={opcoes} aoMudar={aoMudar} className="pilula__corpo">
        {icone && <Icone nome={icone} tamanho={14} />}
        <span className="pilula__rotulo">{rotulo}</span>{' '}
        <span className="pilula__valor">{atual}</span>
        <Icone nome="abrir" tamanho={13} className="pilula__seta" />
      </Seletor>
      <AnimatePresence initial={false}>
        {ativa && (
          <motion.button key="limpar" type="button" className="pilula__limpar" aria-label={`Remover filtro ${rotulo}`}
            initial={{ width: 0, opacity: 0 }} animate={{ width: 26, opacity: 1 }} exit={{ width: 0, opacity: 0 }} transition={TRANSICAO.rapida}
            onClick={() => aoMudar(padrao)}>
            <Icone nome="fechar" tamanho={13} />
          </motion.button>
        )}
      </AnimatePresence>
    </motion.span>
  );
}

interface PropsBarra {
  busca?: string;
  aoBuscar?: (texto: string) => void;
  placeholder?: string;
  /** Quantos filtros estão ativos (para mostrar "Limpar"). */
  ativos?: number;
  aoLimpar?: () => void;
  /** Etiquetas de filtro. */
  children?: ReactNode;
  /** Controles à direita (ex.: agrupar). */
  extra?: ReactNode;
  /** Texto do resultado, anunciado a leitores de tela (ex.: "12 fichas"). */
  resultado?: string;
}

/** Barra de filtros: busca (atalho "/"), etiquetas e "Limpar". */
export function BarraFiltros({ busca, aoBuscar, placeholder = 'Buscar…', ativos = 0, aoLimpar, children, extra, resultado }: PropsBarra) {
  const campo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!aoBuscar) return;
    const aoTeclar = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement;
      if (e.key !== '/' || e.metaKey || e.ctrlKey || alvo.closest('input, textarea, select, [contenteditable], [role=dialog]')) return;
      e.preventDefault();
      campo.current?.focus();
    };
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [aoBuscar]);

  return (
    <pf-barra-filtros>
      <div className="barra" role="search">
        {aoBuscar && (
          <label className="barra__busca">
            <Icone nome="busca" tamanho={16} />
            <input ref={campo} type="search" placeholder={placeholder} value={busca ?? ''} aria-label={placeholder.replace('…', '')}
              onChange={(e) => aoBuscar(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape' && busca) { e.stopPropagation(); aoBuscar(''); } }} />
            {!busca && <kbd aria-hidden="true">/</kbd>}
          </label>
        )}
        <div className="barra__filtros">
          {children}
          <AnimatePresence initial={false}>
            {ativos > 0 && aoLimpar && (
              <motion.span key="limpar" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={TRANSICAO.rapida}>
                <Dica texto="Voltar todos os filtros ao padrão">
                  <button type="button" className="barra__limpar" onClick={aoLimpar}>
                    <Icone nome="reabrir" tamanho={13} />
                    Limpar{ativos > 1 ? ` (${ativos})` : ''}
                  </button>
                </Dica>
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        {extra && <div className="barra__extra">{extra}</div>}
        {resultado && <span className="pf-sr-only" aria-live="polite">{resultado}</span>}
      </div>
    </pf-barra-filtros>
  );
}
