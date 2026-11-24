import { ReactNode, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { useIsMobile } from '../nucleo/estado/layout';
import { Icone } from './Icone';
import { TRANSICAO } from './movimento';
import './seletor.scss';

export interface OpcaoSeletor<V extends string | number> {
  valor: V;
  rotulo: string;
  /** Texto menor ao lado (ex.: "inativa"). */
  detalhe?: string;
}

interface Props<V extends string | number> {
  /** Nome acessível da lista (ex.: "Unidade"). */
  rotulo: string;
  valor: V;
  opcoes: OpcaoSeletor<V>[];
  aoMudar: (valor: V) => void;
  /** Conteúdo do botão que abre a lista (a etiqueta de filtro, por exemplo). */
  children: ReactNode;
  className?: string;
  /** Mostra a busca a partir de quantas opções (padrão: 9). */
  buscaAPartirDe?: number;
  /** Chamado quando o foco sai do botão (validação de formulários). */
  aoSair?: () => void;
  /** Destaque de campo inválido (aria-invalid). */
  invalido?: boolean;
  /** Nome acessível do botão quando o texto visível é outro (ex.: placeholder "Selecione…"). */
  nomeAcessivel?: string;
}

const normalizar = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Lista de seleção do Park Flash (substitui o menu nativo, que muda de aparência em cada sistema).
 * Padrão "listbox" acessível: setas, Home/End, Enter/Espaço, Esc, Tab e digitação da inicial.
 * No celular abre como folha na parte de baixo da tela.
 */
export function Seletor<V extends string | number>({ rotulo, valor, opcoes, aoMudar, children, className, buscaAPartirDe = 9, aoSair, invalido, nomeAcessivel }: Props<V>) {
  const id = useId();
  const isMobile = useIsMobile();
  const botao = useRef<HTMLButtonElement>(null);
  const lista = useRef<HTMLUListElement>(null);
  const campoBusca = useRef<HTMLInputElement>(null);
  const [aberto, setAberto] = useState(false);
  const [ativo, setAtivo] = useState(0);
  const [busca, setBusca] = useState('');
  const [posicao, setPosicao] = useState<{ left: number; top: number; minWidth: number; acima: boolean } | null>(null);
  const digitado = useRef({ texto: '', tempo: 0 });
  const comBusca = opcoes.length >= buscaAPartirDe;

  const visiveis = useMemo(
    () => (busca ? opcoes.filter((o) => normalizar(o.rotulo).includes(normalizar(busca))) : opcoes),
    [opcoes, busca],
  );

  const fechar = useCallback((devolverFoco = true) => {
    setAberto(false);
    setBusca('');
    if (devolverFoco) botao.current?.focus();
  }, []);

  function abrir() {
    setAtivo(Math.max(0, opcoes.findIndex((o) => o.valor === valor)));
    setAberto(true);
  }

  function escolher(opcao: OpcaoSeletor<V> | undefined) {
    if (!opcao) return;
    if (opcao.valor !== valor) aoMudar(opcao.valor);
    fechar();
  }

  // Posição junto ao botão (desktop); abre para cima se faltar espaço embaixo.
  useLayoutEffect(() => {
    if (!aberto || isMobile || !botao.current) return;
    const r = botao.current.getBoundingClientRect();
    const alturaEstimada = Math.min(340, 48 + opcoes.length * 36);
    const acima = r.bottom + alturaEstimada > innerHeight - 8 && r.top > alturaEstimada;
    setPosicao({
      left: Math.max(8, Math.min(r.left, innerWidth - Math.max(r.width, 220) - 8)),
      top: acima ? r.top - 6 : r.bottom + 6,
      minWidth: Math.max(r.width, 220),
      acima,
    });
  }, [aberto, isMobile, opcoes.length]);

  // Foco: na busca (se houver) ou na lista; rolagem até o item ativo.
  useEffect(() => {
    if (!aberto) return;
    requestAnimationFrame(() => (comBusca && !isMobile ? campoBusca.current : lista.current)?.focus({ preventScroll: true }));
  }, [aberto, comBusca, isMobile]);
  useEffect(() => {
    if (aberto) lista.current?.querySelector<HTMLElement>(`[data-indice="${ativo}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [ativo, aberto]);
  useEffect(() => setAtivo(0), [busca]);

  // Fecha ao clicar fora, rolar a página ou redimensionar.
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: PointerEvent) => {
      const alvo = e.target as Node;
      if (!botao.current?.contains(alvo) && !document.getElementById(`${id}-painel`)?.contains(alvo)) fechar(false);
    };
    const rolar = (e: Event) => { if (!isMobile && !document.getElementById(`${id}-painel`)?.contains(e.target as Node)) fechar(false); };
    document.addEventListener('pointerdown', fora, true);
    window.addEventListener('scroll', rolar, true);
    window.addEventListener('resize', () => fechar(false), { once: true });
    return () => {
      document.removeEventListener('pointerdown', fora, true);
      window.removeEventListener('scroll', rolar, true);
    };
  }, [aberto, fechar, id, isMobile]);

  function aoTeclarBotao(e: React.KeyboardEvent) {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
      e.preventDefault();
      abrir();
    }
  }

  function aoTeclarLista(e: React.KeyboardEvent) {
    const ultimo = visiveis.length - 1;
    if (e.key === 'ArrowDown') { e.preventDefault(); setAtivo((a) => Math.min(a + 1, ultimo)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setAtivo((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Home') { e.preventDefault(); setAtivo(0); }
    else if (e.key === 'End') { e.preventDefault(); setAtivo(ultimo); }
    else if (e.key === 'Enter' || (e.key === ' ' && e.target === lista.current)) { e.preventDefault(); escolher(visiveis[ativo]); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); fechar(); }
    else if (e.key === 'Tab') { fechar(false); }
    else if (e.key.length === 1 && e.target === lista.current && !e.metaKey && !e.ctrlKey) {
      // Digitar a inicial leva à opção (como no menu nativo).
      const agora = Date.now();
      const texto = (agora - digitado.current.tempo < 700 ? digitado.current.texto : '') + normalizar(e.key);
      digitado.current = { texto, tempo: agora };
      const achado = visiveis.findIndex((o) => normalizar(o.rotulo).startsWith(texto));
      if (achado >= 0) setAtivo(achado);
    }
  }

  const painel = (
    <AnimatePresence>
      {aberto && (
        <motion.div
          key="painel"
          id={`${id}-painel`}
          className={`pf-seletor__painel${isMobile ? ' pf-seletor__painel--folha' : ''}${posicao?.acima ? ' pf-seletor__painel--acima' : ''}`}
          style={!isMobile && posicao ? { left: posicao.left, top: posicao.top, minWidth: posicao.minWidth } : undefined}
          initial={isMobile ? { y: '100%' } : { opacity: 0, y: posicao?.acima ? 4 : -4, scale: 0.98 }}
          animate={isMobile ? { y: 0 } : { opacity: 1, y: 0, scale: 1 }}
          exit={isMobile ? { y: '100%', transition: TRANSICAO.saida } : { opacity: 0, scale: 0.98, transition: TRANSICAO.saida }}
          transition={isMobile ? TRANSICAO.mola : TRANSICAO.rapida}
          onKeyDown={aoTeclarLista}
        >
          {isMobile && <p className="pf-seletor__titulo">{rotulo}</p>}
          {comBusca && (
            <label className="pf-seletor__busca">
              <Icone nome="busca" tamanho={15} />
              <input ref={campoBusca} type="text" placeholder="Buscar…" value={busca} aria-label={`Buscar em ${rotulo}`}
                aria-controls={`${id}-lista`} aria-activedescendant={visiveis[ativo] ? `${id}-op-${ativo}` : undefined}
                onChange={(e) => setBusca(e.target.value)} />
            </label>
          )}
          <ul ref={lista} id={`${id}-lista`} role="listbox" aria-label={rotulo} tabIndex={-1} className="pf-seletor__lista"
            aria-activedescendant={visiveis[ativo] ? `${id}-op-${ativo}` : undefined}>
            {visiveis.map((o, i) => {
              const selecionado = o.valor === valor;
              return (
                <li key={String(o.valor)} id={`${id}-op-${i}`} role="option" aria-selected={selecionado} data-indice={i}
                  className={`pf-seletor__opcao${i === ativo ? ' pf-seletor__opcao--ativa' : ''}${selecionado ? ' pf-seletor__opcao--selecionada' : ''}`}
                  onPointerMove={() => setAtivo(i)} onClick={() => escolher(o)}>
                  <span className="pf-seletor__marca">{selecionado && <Icone nome="check" tamanho={15} espessura={2.2} />}</span>
                  <span className="pf-seletor__rotulo">{o.rotulo}</span>
                  {o.detalhe && <span className="pf-seletor__detalhe">{o.detalhe}</span>}
                </li>
              );
            })}
            {!visiveis.length && <li className="pf-seletor__vazio" role="presentation">Nada encontrado.</li>}
          </ul>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <>
      <button ref={botao} type="button" className={className} aria-haspopup="listbox" aria-expanded={aberto}
        aria-controls={aberto ? `${id}-lista` : undefined} aria-label={nomeAcessivel ?? `${rotulo} ${opcoes.find((o) => o.valor === valor)?.rotulo ?? ''}`.trim()}
        aria-invalid={invalido || undefined}
        onClick={() => (aberto ? fechar() : abrir())} onKeyDown={aoTeclarBotao} onBlur={() => { if (!aberto) aoSair?.(); }}>
        {children}
      </button>
      {createPortal(
        <pf-seletor>
          {isMobile && <AnimatePresence>{aberto && <motion.div key="veu" className="pf-seletor__veu" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => fechar()} />}</AnimatePresence>}
          {painel}
        </pf-seletor>,
        document.body,
      )}
    </>
  );
}
