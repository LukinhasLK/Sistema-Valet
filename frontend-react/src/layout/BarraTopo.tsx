import { AjudantePerdidinho } from '../compartilhado/perdidinho/AjudantePerdidinho';
import { useUsuario } from '../nucleo/estado/auth';
import './barra-topo.scss';

interface Props {
  /** A gaveta do Perdidinho abriu ou fechou (o layout reserva espaço em telas largas). */
  aoMudarGaveta: (aberta: boolean) => void;
}

/**
 * Barra superior fina do desktop (48 px), só na coluna de conteúdo, antes do `<main>` (ordem natural de foco).
 * À direita: a fala do Perdidinho (quando há), o botão do Perdidinho (as notificações moram dentro dele).
 */
export function BarraTopo({ aoMudarGaveta }: Props) {
  const usuario = useUsuario();
  return (
    <header className="barra-topo" aria-label="Barra do topo">
      <div className="barra-topo__direita">
        {usuario && <AjudantePerdidinho variante="barra" aoMudarGaveta={aoMudarGaveta} />}
      </div>
    </header>
  );
}
