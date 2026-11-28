import { useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Dica } from '../compartilhado/Dica';
import { Icone } from '../compartilhado/Icone';
import { Logo } from '../compartilhado/Logo';
import { TRANSICAO } from '../compartilhado/movimento';
import { authServico, inicialDe, useNivel, useUsuario } from '../nucleo/estado/auth';
import { interfaceServico, teclaComando, useMenuRecolhido } from '../nucleo/estado/interface';
import { corDoAvatar, gruposPermitidos } from './itens-menu';
import './sidebar.scss';

const ROTA_NOTIFICACOES = '/app/notificacoes';

export function Sidebar() {
  const usuario = useUsuario();
  const nivel = useNivel();
  const navegar = useNavigate();
  const recolhido = useMenuRecolhido();
  // As notificações moram dentro do Perdidinho (seção Avisos); a tela completa continua neste menu e na paleta.
  const grupos = gruposPermitidos(nivel)
    .map((g) => ({ ...g, itens: g.itens.filter((i) => i.rota !== ROTA_NOTIFICACOES) }))
    .filter((g) => g.itens.length > 0);

  // "[" recolhe/expande o menu (fora de campos de texto).
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement;
      if (e.key !== '[' || e.metaKey || e.ctrlKey || e.altKey || alvo.closest('input, textarea, select, [contenteditable], [role=dialog]')) return;
      e.preventDefault();
      interfaceServico.alternarMenu(recolhido);
    };
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [recolhido]);

  function sair() {
    authServico.logout();
    navegar('/login');
  }

  return (
    <pf-sidebar data-recolhido={recolhido ? '' : undefined}>
      <aside className="sidebar" aria-label="Menu lateral">
        <div className="sidebar__brand">
          <NavLink to="/app/dashboard" className="sidebar__logo">
            {recolhido ? <img src="/favicon.svg" alt="Park Flash" width={28} height={28} /> : <Logo tamanho={18} />}
          </NavLink>
          <Dica texto={recolhido ? 'Expandir menu' : 'Recolher menu'} atalho="[" lado="right">
            <button type="button" className="sidebar__recolher" aria-label={recolhido ? 'Expandir menu' : 'Recolher menu'}
              aria-expanded={!recolhido} onClick={() => interfaceServico.alternarMenu(recolhido)}>
              <Icone nome={recolhido ? 'expandir' : 'recolher'} tamanho={17} />
            </button>
          </Dica>
        </div>

        <Dica texto="Buscar ou ir para…" atalho={`${teclaComando}K`} lado="right" desligada={!recolhido}>
          <button type="button" className="sidebar__busca" onClick={interfaceServico.abrirPaleta} data-tour="paleta"
            aria-label={recolhido ? 'Buscar ou ir para' : undefined} aria-keyshortcuts="Meta+K Control+K">
            <Icone nome="busca" tamanho={16} />
            <span className="sidebar__busca-texto">Buscar ou ir para…</span>
            <kbd className="sidebar__busca-atalho">{teclaComando}K</kbd>
          </button>
        </Dica>

        <nav className="sidebar__nav" aria-label="Navegação principal" data-tour="menu">
          {grupos.map((grupo) => (
            <div key={grupo.id} className="grupo" role="group" aria-labelledby={`grupo-${grupo.id}`}>
              <p id={`grupo-${grupo.id}`} className="grupo__titulo">{grupo.titulo}</p>
              {grupo.itens.map((item) => {
                return (
                  <Dica key={item.rota} texto={item.label} lado="right" desligada={!recolhido}>
                    <NavLink className={({ isActive }) => `nav-item${isActive ? ' nav-item--active' : ''}`} to={item.rota}
                      aria-label={recolhido ? item.label : undefined}>
                      {({ isActive }) => (
                        <>
                          {isActive && <motion.span layoutId="nav-ativo" className="nav-item__fundo" transition={TRANSICAO.mola} />}
                          <Icone nome={item.icone} tamanho={17} />
                          <span className="nav-item__rotulo">{item.label}</span>
                        </>
                      )}
                    </NavLink>
                  </Dica>
                );
              })}
            </div>
          ))}
        </nav>

        {usuario && (
          <footer className="sidebar__user">
            <Dica texto="Meu perfil" lado="right" desligada={!recolhido}>
              <NavLink className="sidebar__user-link" to="/app/perfil" aria-label={recolhido ? 'Meu perfil' : undefined} data-tour="perfil">
                <span className="pf-avatar" style={{ background: corDoAvatar(usuario.nome) }}>{inicialDe(usuario)}</span>
                <span className="sidebar__user-info">
                  <span className="sidebar__user-name">{usuario.nome}</span>
                  <span className="sidebar__user-role">{usuario.nivel}</span>
                </span>
              </NavLink>
            </Dica>
            <Dica texto="Sair da conta" lado={recolhido ? 'right' : 'top'}>
              <button type="button" className="sidebar__logout" aria-label="Sair" onClick={sair}>
                <Icone nome="sair" tamanho={16} />
              </button>
            </Dica>
          </footer>
        )}
      </aside>
    </pf-sidebar>
  );
}
