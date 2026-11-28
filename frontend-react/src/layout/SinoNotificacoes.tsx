import { Link } from 'react-router-dom';
import { Icone } from '../compartilhado/Icone';
import { useNotificacoesDisponiveis, useTotalNaoLidas } from '../nucleo/servicos/notificacoes';

/**
 * Sino de notificações com o contador de não lidas. Mora no topo do celular (entre o Perdidinho e o perfil) e na barra
 * superior do desktop (à direita do Perdidinho). Só aparece para quem pode ver as notificações; o total é buscado aqui.
 */
export function SinoNotificacoes({ className }: { className: string }) {
  const disponivel = useNotificacoesDisponiveis();
  const total = useTotalNaoLidas();
  if (!disponivel) return null;
  return (
    <Link className={className} to="/app/notificacoes" aria-label={`Notificações${total ? `, ${total} não lidas` : ''}`}>
      <Icone nome="sino" tamanho={20} />
      {!!total && <span aria-hidden="true">{total > 99 ? '99+' : total}</span>}
    </Link>
  );
}
