import { ReactNode, useLayoutEffect, useRef } from 'react';
import { Icone } from './Icone';
import { contar } from './movimento';
import './cartao-kpi.scss';

interface Props {
  rotulo: string;
  /** Texto final exibido (já formatado). */
  valor: string;
  /** Valor numérico + formatador: o número conta até o valor final ao aparecer e ao mudar. */
  numero?: number;
  formato?: (n: number) => string;
  dica?: ReactNode;
  icone?: string;
  tom?: 'default' | 'success' | 'danger' | 'accent';
}

export function CartaoKpi({ rotulo, valor, numero, formato, dica, icone, tom = 'default' }: Props) {
  const ref = useRef<HTMLParagraphElement>(null);
  const anterior = useRef<number | null>(null);

  useLayoutEffect(() => {
    if (numero === undefined || !formato || !ref.current) return;
    const de = anterior.current ?? 0;
    anterior.current = numero;
    return contar(ref.current, de, numero, formato);
  }, [numero, formato]);

  return (
    <pf-kpi-card>
      <div className={`kpi kpi--${tom}`}>
        <div className="kpi__topo">
          <p className="kpi__label">{rotulo}</p>
          {icone && <span className="kpi__icone"><Icone nome={icone} tamanho={15} /></span>}
        </div>
        <p ref={ref} className={`kpi__value kpi__value--${tom}`} aria-label={valor}>{valor}</p>
        {dica && <p className="kpi__hint">{dica}</p>}
      </div>
    </pf-kpi-card>
  );
}
