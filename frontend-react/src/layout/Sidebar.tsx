import { NavLink, useNavigate } from 'react-router-dom';
import { Icone } from '../compartilhado/Icone';
import { Logo } from '../compartilhado/Logo';
import { authServico, inicialDe, useNivel, useUsuario } from '../nucleo/estado/auth';
import { useTotalNaoLidas } from '../nucleo/servicos/notificacoes';
import { corDoAvatar, itensPermitidos, NAV_ITEMS } from './itens-menu';
import './sidebar.scss';

const classeItem = ({ isActive }: { isActive: boolean }) => `nav-item${isActive ? ' nav-item--active' : ''}`;

export function Sidebar() {
  const usuario = useUsuario();
  const nivel = useNivel();
  const naoLidas = useTotalNaoLidas();
  const navegar = useNavigate();

  function sair() {
    authServico.logout();
    navegar('/login');
  }

  return (
    <pf-sidebar>
      <aside className="sidebar">
        <div className="sidebar__brand"><Logo escuro tamanho={19} /></div>

        <nav className="sidebar__nav" aria-label="Navegação principal">
          {itensPermitidos(NAV_ITEMS, nivel).map((item) => (
            <NavLink key={item.rota} className={classeItem} to={item.rota}>
              <Icone nome={item.icone} tamanho={18} />
              <span>{item.label}</span>
              {item.rota === '/app/notificacoes' && !!naoLidas && (
                <span className="nav-item__contador" aria-label={`${naoLidas} não lidas`}>{naoLidas > 99 ? '99+' : naoLidas}</span>
              )}
            </NavLink>
          ))}
        </nav>

        {usuario && (
          <footer className="sidebar__user">
            <NavLink className="sidebar__user-link" to="/app/perfil" title="Meu perfil">
              <span className="pf-avatar" style={{ background: corDoAvatar(usuario.nome) }}>{inicialDe(usuario)}</span>
              <span className="sidebar__user-info">
                <span className="sidebar__user-name">{usuario.nome}</span>
                <span className="sidebar__user-role">{usuario.nivel}</span>
              </span>
            </NavLink>
            <button type="button" className="sidebar__logout" aria-label="Sair" title="Sair" onClick={sair}>
              <Icone nome="sair" tamanho={17} />
            </button>
          </footer>
        )}
      </aside>
    </pf-sidebar>
  );
}
