import { ReactNode } from 'react';
import { Ilustracao, NomeIlustracao } from './Ilustracao';
import './estado-vazio.scss';

interface Props {
  titulo: string;
  texto?: ReactNode;
  ilustracao?: NomeIlustracao;
  /** Botões de ação (ex.: "Limpar filtros", "Nova ficha"). */
  children?: ReactNode;
  /** Sem cartão em volta (para usar dentro de outro cartão). */
  solto?: boolean;
  compacto?: boolean;
}

/** Estado vazio: explica por que não há nada e oferece o próximo passo. */
export function EstadoVazio({ titulo, texto, ilustracao = 'vaga', children, solto = false, compacto = false }: Props) {
  return (
    <pf-estado-vazio>
      <div className={`vazio${solto ? '' : ' pf-card'}${compacto ? ' vazio--compacto' : ''}`} role="status">
        <Ilustracao nome={ilustracao} tamanho={compacto ? 112 : 150} />
        <p className="vazio__titulo">{titulo}</p>
        {texto && <p className="vazio__texto">{texto}</p>}
        {children && <div className="vazio__acoes">{children}</div>}
      </div>
    </pf-estado-vazio>
  );
}
