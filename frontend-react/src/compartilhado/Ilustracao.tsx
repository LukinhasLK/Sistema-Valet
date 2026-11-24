import { useLayoutEffect, useRef } from 'react';
import { animate } from 'motion';
import { CURVA, flutuar, reduzido } from './movimento';

/**
 * Ilustrações originais do Park Flash (traço azul-marinho, preenchimentos claros),
 * desenhadas à mão em SVG. Leves e sem dependência de ferramentas de geração de imagem.
 */
export type NomeIlustracao = 'fichas' | 'busca' | 'tudo-certo' | 'vaga' | 'calendario' | 'equipe';

const T = { stroke: '#10283F', strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
const AZUL = '#E8F3FA';
const AZUL_FORTE = '#186A9D';

function Desenho({ nome }: { nome: NomeIlustracao }) {
  switch (nome) {
    case 'fichas':
      return (
        <>
          <ellipse cx="80" cy="104" rx="52" ry="5" fill="#EEF2F6" />
          <g className="flutua">
            <path d="M46 30h58a4 4 0 0 1 4 4v10a6 6 0 0 0 0 12v10a4 4 0 0 1-4 4H46a4 4 0 0 1-4-4V56a6 6 0 0 0 0-12V34a4 4 0 0 1 4-4z" {...T} fill="#fff" transform="rotate(-8 75 50)" />
            <path d="M52 42h58a4 4 0 0 1 4 4v10a6 6 0 0 0 0 12v10a4 4 0 0 1-4 4H52a4 4 0 0 1-4-4V68a6 6 0 0 0 0-12V46a4 4 0 0 1 4-4z" {...T} fill="#fff" />
            <path d="M92 44v36" {...T} strokeDasharray="3 3.5" />
            <path d="M58 56h22M58 64h14" {...T} />
            <rect x="98" y="54" width="10" height="16" rx="2" fill={AZUL} />
          </g>
          <g className="brilho">
            <path d="M124 26v8M120 30h8" {...T} stroke={AZUL_FORTE} />
            <circle cx="34" cy="38" r="2" fill={AZUL_FORTE} />
          </g>
        </>
      );
    case 'busca':
      return (
        <>
          <ellipse cx="80" cy="104" rx="50" ry="5" fill="#EEF2F6" />
          <path d="M30 92h100" {...T} strokeDasharray="8 7" stroke="#B8C4D0" />
          <g className="flutua">
            <circle cx="72" cy="52" r="22" {...T} fill="#fff" />
            <circle cx="72" cy="52" r="15" fill={AZUL} />
            <path d="m88 68 16 16" {...T} strokeWidth={4} />
            <path d="M65 46c2-3 6-4 9-3" {...T} stroke={AZUL_FORTE} />
          </g>
          <path d="M118 34l2 4 4 1-4 2-2 4-2-4-4-2 4-1z" fill={AZUL_FORTE} className="brilho" />
        </>
      );
    case 'tudo-certo':
      return (
        <>
          <ellipse cx="80" cy="104" rx="54" ry="5" fill="#EEF2F6" />
          <g className="flutua">
            <path d="M38 80V66l10-18a6 6 0 0 1 5-3h42a6 6 0 0 1 5 3l12 18v14a3 3 0 0 1-3 3H41a3 3 0 0 1-3-3z" {...T} fill="#fff" />
            <path d="M50 64l7-12h34l8 12z" fill={AZUL} stroke="#10283F" strokeWidth={1.4} strokeLinejoin="round" />
            <circle cx="56" cy="83" r="7" {...T} fill="#fff" />
            <circle cx="98" cy="83" r="7" {...T} fill="#fff" />
            <path d="M42 72h8M104 72h8" {...T} />
          </g>
          <g className="brilho">
            <circle cx="122" cy="34" r="12" fill="#23845D" />
            <path d="m116.5 34.5 3.8 3.6 6.8-7" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </g>
        </>
      );
    case 'calendario':
      return (
        <>
          <ellipse cx="80" cy="104" rx="48" ry="5" fill="#EEF2F6" />
          <g className="flutua">
            <rect x="44" y="30" width="72" height="62" rx="8" {...T} fill="#fff" />
            <path d="M44 46h72" {...T} />
            <rect x="45" y="31" width="70" height="14" rx="7" fill={AZUL} />
            <path d="M60 24v12M100 24v12" {...T} />
            <path d="M58 58h8M76 58h8M94 58h8M58 72h8M76 72h8" {...T} stroke="#B8C4D0" />
            <rect x="92" y="67" width="12" height="10" rx="2" fill={AZUL_FORTE} />
          </g>
        </>
      );
    case 'equipe':
      return (
        <>
          <ellipse cx="80" cy="104" rx="50" ry="5" fill="#EEF2F6" />
          <g className="flutua">
            <circle cx="62" cy="48" r="11" {...T} fill="#fff" />
            <path d="M42 90v-8a14 14 0 0 1 14-14h12a14 14 0 0 1 14 14v8" {...T} fill="#fff" />
            <circle cx="100" cy="54" r="9" {...T} fill={AZUL} />
            <path d="M86 90v-5a12 12 0 0 1 12-12h4a12 12 0 0 1 12 12v5" {...T} />
            <path d="M58 76l4 4 4-4" {...T} stroke={AZUL_FORTE} />
          </g>
        </>
      );
    default:
      return (
        <>
          <ellipse cx="80" cy="104" rx="56" ry="5" fill="#EEF2F6" />
          <path d="M34 96V40M126 96V40" {...T} stroke="#B8C4D0" />
          <rect x="50" y="46" width="60" height="44" rx="6" {...T} strokeDasharray="6 5" stroke="#9AA8B6" fill={AZUL} fillOpacity={0.5} />
          <g className="flutua">
            <rect x="68" y="56" width="24" height="24" rx="5" fill={AZUL_FORTE} />
            <path d="M76 74V62h5a4 4 0 0 1 0 8h-5" fill="none" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
          </g>
        </>
      );
  }
}

export function Ilustracao({ nome, tamanho = 160 }: { nome: NomeIlustracao; tamanho?: number }) {
  const ref = useRef<SVGSVGElement>(null);
  useLayoutEffect(() => {
    const svg = ref.current;
    if (!svg) return;
    if (reduzido()) return;
    const chegada = animate(svg, { opacity: [0, 1], scale: [0.96, 1], y: [6, 0] }, { duration: 0.5, ease: CURVA.saida });
    const pararFlutuacao = flutuar([...svg.querySelectorAll('.flutua')]);
    const brilho = animate([...svg.querySelectorAll('.brilho')], { opacity: [0.35, 1] }, { duration: 1.6, ease: 'easeInOut', repeat: Infinity, repeatType: 'reverse', delay: 0.4 });
    return () => { chegada.complete(); pararFlutuacao(); brilho.stop(); };
  }, [nome]);
  return (
    <svg ref={ref} width={tamanho} height={tamanho * 0.72} viewBox="0 0 160 115" aria-hidden="true" focusable="false" className="pf-ilustracao">
      <Desenho nome={nome} />
    </svg>
  );
}
