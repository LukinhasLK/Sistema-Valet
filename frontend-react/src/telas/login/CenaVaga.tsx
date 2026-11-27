import type { ReactNode } from 'react';
import './cena-vaga.scss';

/**
 * "O manobrista discreto": uma vaga vista de leve em perspectiva, a placa "P" à esquerda e, no
 * chão à direita, a ficha do manobrista presa na argola de uma chave. Sem moldura nem fundo:
 * pousa sobre o painel azul-escuro do login. Só SVG estático (nada se move aqui); o único
 * movimento da cena é o do mascote, passado em `children` e posicionado no centro da vaga.
 *
 * Decorativa: `aria-hidden` e sem eventos de ponteiro. O slot do mascote tem 132x132 reservados,
 * então nada pula quando o mascote (carregado depois) aparece.
 */
export function CenaVaga({ children }: { children?: ReactNode }) {
  return (
    <div className="cena-vaga" aria-hidden="true">
      <svg className="cena-vaga__desenho" viewBox="0 0 320 180" focusable="false" preserveAspectRatio="xMidYMid meet">
        {/* Chão: faixas da vaga convergindo para um ponto acima da cena (perspectiva leve). */}
        <g className="cena-vaga__faixas" fill="none" strokeLinecap="round">
          <path className="cena-vaga__faixa" d="M106 170 L128 116 M246 170 L224 116 M128 116 H224" strokeWidth="2.6" />
          <path className="cena-vaga__faixa cena-vaga__faixa--vizinha" d="M38 170 L81 116 M314 170 L271 116" strokeWidth="2.2" />
          <path className="cena-vaga__faixa cena-vaga__faixa--horizonte" d="M18 116 H302" strokeWidth="1.4" />
        </g>
        {/* Batente no fundo da vaga. */}
        <rect className="cena-vaga__batente" x="156" y="120" width="40" height="5" rx="2.5" />

        {/* Placa "P" no poste. */}
        <ellipse className="cena-vaga__sombra" cx="48" cy="151" rx="11" ry="2.4" />
        <rect className="cena-vaga__poste" x="46.5" y="68" width="3" height="83" rx="1.5" />
        <rect className="cena-vaga__placa" x="30" y="34" width="36" height="36" rx="7" />
        <rect className="cena-vaga__placa-borda" x="32.5" y="36.5" width="31" height="31" rx="5" fill="none" strokeWidth="1" />
        <path className="cena-vaga__letra" d="M41.5 62 V42 H48.5 A6 6 0 0 1 48.5 54 H41.5" fill="none" strokeWidth="4.4" strokeLinecap="round" strokeLinejoin="round" />

        {/* Ficha com picote, presa por uma argola a uma chave, largada no chão. */}
        <g className="cena-vaga__ficha" transform="translate(272 148) rotate(-14)">
          <ellipse className="cena-vaga__sombra" cx="1" cy="17" rx="15" ry="2.2" />
          <rect className="cena-vaga__papel" x="-12" y="-16" width="24" height="32" rx="2" />
          <circle className="cena-vaga__furo" cx="0" cy="-11.5" r="1.6" />
          <path className="cena-vaga__picote" d="M-10.5 -5 H10.5" strokeWidth="1" strokeDasharray="1.6 2" />
          <path className="cena-vaga__linhas" d="M-7 1.5 H7 M-7 6 H3 M-7 10.5 H5" strokeWidth="1.6" strokeLinecap="round" />
          <circle className="cena-vaga__argola" cx="2" cy="-16" r="5.5" fill="none" strokeWidth="1.6" />
          <g transform="translate(6 -20) rotate(-28)">
            <circle className="cena-vaga__metal" cx="5" cy="0" r="4.6" />
            <circle className="cena-vaga__furo" cx="5" cy="0" r="1.5" />
            <path className="cena-vaga__metal" d="M9 -1.3 H24 A1.3 1.3 0 0 1 24 1.3 H22.5 V4 H20.6 V1.3 H19 V3.2 H17.2 V1.3 H9 Z" />
          </g>
        </g>
      </svg>
      <div className="cena-vaga__mascote">{children}</div>
    </div>
  );
}
