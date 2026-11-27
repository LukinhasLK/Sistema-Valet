import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { HumorMascote } from '../../nucleo/onboarding/mascote';
import { Icone } from '../Icone';
import { reduzido } from '../movimento';
import { useOnboarding } from '../../nucleo/onboarding/estado';
import { PerdidinhoTardio } from './index';
import './perdidinho-diz.scss';

/**
 * PerdidinhoDiz: o Perdidinho com um balão de fala, para recados curtos nas telas
 * (estado vazio, erro, sem conexão, novidade, dica).
 *
 * Uso:
 *
 *   import { PerdidinhoDiz } from '../../compartilhado/perdidinho/PerdidinhoDiz';
 *
 *   // Estado vazio, com ação:
 *   <PerdidinhoDiz
 *     humor="dormindo"
 *     titulo="Nenhuma ficha aberta"
 *     texto="Quando um carro entrar, a ficha aparece aqui."
 *     acao={{ rotulo: 'Abrir ficha', aoClicar: () => navegar('/fichas/nova') }}
 *   />
 *
 *   // Erro fechável (quem chama decide quando desmontar):
 *   {semConexao && (
 *     <PerdidinhoDiz humor="triste" texto="Sem conexão. O que você digitar fica salvo no aparelho."
 *       aoFechar={() => setSemConexao(false)} />
 *   )}
 *
 * Humores: os do tour ('acenando', 'explicando', 'apontando', 'comemorando', 'pensando') e
 * 'triste' (erro), 'surpreso' (novidade) e 'dormindo' (vazio/ocioso).
 *
 * Comportamento:
 * - O texto fica numa região `aria-live="polite"`: é anunciado ao aparecer e quando `texto` muda.
 *   Com `anunciar={false}` (balão decorativo, texto fixo), a região não é viva: o texto é lido
 *   só na ordem normal da página.
 * - O foco nunca é roubado. Com `aoFechar`, aparece o botão "Fechar" e Esc também fecha
 *   (Esc é ignorado quando há um diálogo modal aberto, que tem prioridade).
 *   Ao fechar, o componente some sozinho e chama `aoFechar` (após a saída de 140 ms; imediato
 *   com reduzir movimento). Se o foco estava no balão, quem chama deve devolvê-lo a um lugar útil.
 * - O Perdidinho é decorativo aqui (o conteúdo é o texto) e carrega sob demanda, com o espaço
 *   reservado, para a tela não pular. O GSAP não entra no pacote da tela.
 * - `lado`: onde o Perdidinho fica em relação ao balão. Em espaços estreitos (< 320 px) o balão
 *   vai para cima do mascote, sem sobrepor nada (o componente ocupa o próprio espaço no fluxo).
 * - Reduzir movimento (sistema ou `reduzirMovimento`): o balão aparece sem "pop" e o Perdidinho
 *   só muda de expressão.
 */
export interface PropsPerdidinhoDiz {
  humor: HumorMascote;
  texto: ReactNode;
  titulo?: string;
  /** Lado do Perdidinho em relação ao balão. Padrão: 'esquerda'. */
  lado?: 'esquerda' | 'direita';
  /** Tamanho do Perdidinho em px. Padrão: 56. */
  tamanho?: number;
  acao?: { rotulo: string; aoClicar: () => void };
  aoFechar?: () => void;
  reduzirMovimento?: boolean;
  /** Anuncia o texto ao leitor de tela (região viva). Padrão: true. Use false em balões decorativos. */
  anunciar?: boolean;
}

/** Duração da saída (igual à animação `pdiz-sai` do SCSS). */
export const SAIDA_MS = 140;

export function PerdidinhoDiz({
  humor, texto, titulo, lado = 'esquerda', tamanho = 56, acao, aoFechar, reduzirMovimento = false, anunciar = true,
}: PropsPerdidinhoDiz) {
  const raiz = useRef<HTMLElement>(null);
  const [pronto, setPronto] = useState(false);
  const [saindo, setSaindo] = useState(false);
  const [fechado, setFechado] = useState(false);
  const tourAberto = useOnboarding((s) => s.ativo !== null);
  const aoFecharAtual = useRef(aoFechar);
  const espera = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const parado = reduzirMovimento || reduzido();
  const fechavel = !!aoFechar;

  useEffect(() => { aoFecharAtual.current = aoFechar; }, [aoFechar]);

  // O conteúdo fica visível depois da montagem, para a região viva anunciar a primeira frase.
  // O espaço já está reservado (visibility), então nada pula.
  useEffect(() => { setPronto(true); }, []);
  useEffect(() => () => clearTimeout(espera.current), []);

  const fechar = useCallback(() => {
    if (saindo || fechado) return;
    const concluir = () => { setFechado(true); aoFecharAtual.current?.(); };
    if (parado) { concluir(); return; }
    setSaindo(true);
    espera.current = setTimeout(concluir, SAIDA_MS);
  }, [saindo, fechado, parado]);

  // Esc fecha, a não ser que um diálogo modal (que não seja este) esteja aberto.
  useEffect(() => {
    if (!fechavel || fechado) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      const modal = document.querySelector('[aria-modal="true"], dialog[open]');
      if (modal && !modal.contains(raiz.current)) return;
      fechar();
    };
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [fechavel, fechado, fechar]);

  if (fechado) return null;

  // Estado em data-* (no React 18, `className` em elemento customizado vira o atributo "classname").
  return (
    <pf-perdidinho-diz ref={raiz} data-lado={lado} data-humor={humor} data-pronto={pronto || undefined}
      data-parado={parado || undefined} data-saindo={saindo || undefined}
      style={{ '--pdiz-tamanho': `${tamanho}px` } as CSSProperties}>
      <div className="pdiz__linha">
        <div className="pdiz__mascote" aria-hidden="true">
          {/* Com o tour aberto, só o Perdidinho do tour aparece: o espaço fica reservado, sem pular. */}
          {!tourAberto && <PerdidinhoTardio decorativo tamanho={tamanho} humor={humor} falando
            passo={typeof texto === 'string' ? texto : humor} lado={lado === 'esquerda' ? 'left' : 'right'}
            reduzirMovimento={parado} />}
        </div>
        <div className={`pdiz__balao${fechavel ? ' pdiz__balao--fechavel' : ''}`}>
          <div className="pdiz__conteudo" {...(anunciar ? { 'aria-live': 'polite', 'aria-atomic': true } : {})}>
            {titulo && <p className="pdiz__titulo">{titulo}</p>}
            <p className="pdiz__texto">{texto}</p>
          </div>
          {acao && (
            <button type="button" className="pf-btn pf-btn--ghost pf-btn--sm pdiz__acao" onClick={acao.aoClicar}>{acao.rotulo}</button>
          )}
          {fechavel && (
            <button type="button" className="pdiz__fechar" onClick={fechar} aria-label="Fechar mensagem" title="Fechar (Esc)">
              <Icone nome="fechar" tamanho={16} />
            </button>
          )}
        </div>
      </div>
    </pf-perdidinho-diz>
  );
}
