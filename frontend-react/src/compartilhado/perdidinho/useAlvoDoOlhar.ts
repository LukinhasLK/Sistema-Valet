import { useEffect, useRef, useState, type RefObject } from 'react';
import type { Direcao } from './Perdidinho';

/** Depois deste tempo sem foco/clique novo, o olhar volta a ser livre. */
export const SOLTA_OLHAR_MS = 3000;
/** Distância (px) a partir da qual o olhar já aponta para o limite da órbita. */
const ALCANCE = 320;
/** Amplitude máxima (raio, 0..1): os olhos nunca encostam na borda da órbita (não fica vesgo). */
export const AMPLITUDE_MAX = 0.78;
/** Para cima/baixo a órbita é mais curta: achata o eixo y (o companheiro fica embaixo, quase tudo está acima). */
const ACHATA_Y = 0.85;
/** Mudança mínima (distância em -1..1) para mover os olhos: cliques repetidos no mesmo lugar não tremem. */
export const LIMIAR_OLHAR = 0.12;
/** A partir desta distância é outra região da tela: os olhos dão uma "olhadela" (salto rápido). */
export const LIMIAR_REGIAO = 0.45;

const SENHA = 'input[type="password"]';

/**
 * Como os olhos estão indo para o alvo (o componente traduz em duração/atraso da transição CSS):
 * - `salto`: alvo novo, em outra região (olhadela rápida);
 * - `ajuste`: o alvo andou um pouco (acompanha com calma);
 * - `livre`: sem ação recente, volta a seguir o cursor (retorno suave).
 */
export type ModoOlhar = 'salto' | 'ajuste' | 'livre';

export interface AlvoDoOlhar {
  olhar: Direcao | undefined;
  senha: boolean;
  modo: ModoOlhar;
  /** Conta as olhadelas (muda a cada salto de região): gatilho para um gesto curto do corpo. */
  saltos: number;
}

/** Direção normalizada de `de` até `para`, com amplitude limitada e y achatado. */
export function direcaoAte(dx: number, dy: number): Direcao {
  const dist = Math.hypot(dx, dy) || 1;
  const forca = Math.min(1, dist / ALCANCE) * AMPLITUDE_MAX;
  return { x: (dx / dist) * forca, y: (dy / dist) * forca * ACHATA_Y };
}

const distancia = (a: Direcao, b: Direcao) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * Para onde o mascote deve olhar: o centro do último elemento focado ou clicado, em direção normalizada (-1..1).
 * Devolve `olhar` indefinido quando não há ação recente (o Perdidinho segue o cursor sozinho) e `senha`
 * verdadeiro enquanto o foco está num campo de senha (os olhos se fecham: discrição; o olhar não persegue).
 *
 * Um único par de ouvintes passivos no documento (focusin/pointerdown); a medida roda em rAF e só há
 * re-render quando o alvo muda além do limiar (nada por mousemove). Desligado (`ativo` falso) não escuta nada.
 */
export function useAlvoDoOlhar(mascote: RefObject<HTMLElement>, ativo = true): AlvoDoOlhar {
  const [estado, setEstado] = useState<{ olhar: Direcao | undefined; modo: ModoOlhar; saltos: number }>(
    { olhar: undefined, modo: 'livre', saltos: 0 },
  );
  const [senha, setSenha] = useState(false);
  const ultimo = useRef<Direcao | undefined>(undefined);

  useEffect(() => {
    if (!ativo) return;
    let quadro = 0;
    let solta: ReturnType<typeof setTimeout> | undefined;
    let emSenha = !!document.activeElement?.matches(SENHA);

    const soltar = () => {
      if (!ultimo.current) return;
      ultimo.current = undefined;
      setEstado((s) => ({ ...s, olhar: undefined, modo: 'livre' }));
    };
    const agendarSolta = () => {
      clearTimeout(solta);
      solta = setTimeout(soltar, SOLTA_OLHAR_MS);
    };

    const aplicar = (proximo: Direcao) => {
      const a = ultimo.current;
      // Mesmo lugar (ou quase): não mexe os olhos, só renova a atenção.
      if (a && distancia(a, proximo) < LIMIAR_OLHAR) { agendarSolta(); return; }
      const salto = !a || distancia(a, proximo) >= LIMIAR_REGIAO;
      ultimo.current = proximo;
      setEstado((s) => ({ olhar: proximo, modo: salto ? 'salto' : 'ajuste', saltos: salto ? s.saltos + 1 : s.saltos }));
      agendarSolta();
    };

    const aoAgir = (e: Event) => {
      const alvo = e.target instanceof Element ? e.target : null;
      const base = mascote.current;
      if (!alvo || !base) return;
      if (e.type === 'focusin') {
        emSenha = alvo.matches(SENHA);
        setSenha(emSenha);
      }
      // Digitando senha: olhos fechados e parados (não "espia" o teclado).
      if (emSenha) return;
      // Agir no próprio companheiro (ou em seu painel) não é "olhar para outro lugar".
      if (base.closest('pf-ajudante-perdidinho')?.contains(alvo) || alvo.closest('pf-painel-atencao')) return;
      cancelAnimationFrame(quadro);
      quadro = requestAnimationFrame(() => {
        const r = alvo.getBoundingClientRect();
        const m = base.getBoundingClientRect();
        if (!r.width && !r.height) return;
        aplicar(direcaoAte(r.left + r.width / 2 - (m.left + m.width / 2), r.top + r.height / 2 - (m.top + m.height / 2)));
      });
    };
    // Indo de um campo de senha direto para outro (senha e confirmação), os olhos continuam fechados.
    const aoSair = (e: FocusEvent) => {
      const proximo = e.relatedTarget instanceof Element ? e.relatedTarget : null;
      if (proximo?.matches(SENHA)) return;
      emSenha = false;
      setSenha(false);
    };

    document.addEventListener('focusin', aoAgir, { passive: true });
    document.addEventListener('pointerdown', aoAgir, { passive: true });
    document.addEventListener('focusout', aoSair, { passive: true });
    setSenha(emSenha);
    return () => {
      cancelAnimationFrame(quadro);
      clearTimeout(solta);
      document.removeEventListener('focusin', aoAgir);
      document.removeEventListener('pointerdown', aoAgir);
      document.removeEventListener('focusout', aoSair);
      ultimo.current = undefined;
      setEstado((s) => (s.olhar || s.modo !== 'livre' ? { ...s, olhar: undefined, modo: 'livre' } : s));
      setSenha(false);
    };
  }, [ativo, mascote]);

  return ativo ? { ...estado, senha } : { olhar: undefined, senha: false, modo: 'livre', saltos: estado.saltos };
}
