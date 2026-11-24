import './cartao-kpi.scss';

interface Props {
  rotulo: string;
  valor: string;
  dica?: string;
  tom?: 'default' | 'success' | 'danger' | 'accent';
}

export function CartaoKpi({ rotulo, valor, dica, tom = 'default' }: Props) {
  return (
    <pf-kpi-card>
      <div className="kpi">
        <p className="kpi__label">{rotulo}</p>
        <p className={`kpi__value kpi__value--${tom}`}>{valor}</p>
        {dica && <p className="kpi__hint">{dica}</p>}
      </div>
    </pf-kpi-card>
  );
}
