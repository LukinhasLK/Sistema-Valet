import { Suspense, useLayoutEffect, useRef } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { Icone } from '../compartilhado/Icone';
import { Logo } from '../compartilhado/Logo';
import { entrada } from '../compartilhado/movimento';
import { inicialDe, useUsuario } from '../nucleo/estado/auth';
import { useIsMobile } from '../nucleo/estado/layout';
import { useNotificacoesDisponiveis, useTotalNaoLidas } from '../nucleo/servicos/notificacoes';
import { BarraInferior } from './BarraInferior';
import { corDoAvatar } from './itens-menu';
import { Sidebar } from './Sidebar';
import './app-layout.scss';

/**
 * Ao trocar de tela, título e primeiros indicadores entram suavemente (antigo pfRouteMotion).
 * Fica dentro do mesmo Suspense da tela: só roda depois que a tela carregada aparece.
 */
function MovimentoDeRota({ conteudo }: { conteudo: React.RefObject<HTMLElement> }) {
  const { pathname } = useLocation();
  useLayoutEffect(() => {
    const pagina = conteudo.current;
    if (!pagina) return;
    const cabecalho = pagina.querySelector<HTMLElement>('h1');
    const indicadores = [...pagina.querySelectorAll<HTMLElement>('.pf-grid-kpi:not(.kpis) > pf-kpi-card')].slice(0, 3);
    const alvos = [...(cabecalho ? [cabecalho] : []), ...indicadores];
    if (alvos.length) return entrada(alvos, 6, true);
  }, [pathname, conteudo]);
  return null;
}

function Tela({ conteudo }: { conteudo: React.RefObject<HTMLElement> }) {
  return (
    <Suspense fallback={<p className="pf-carregando" role="status">Carregando…</p>}>
      <Outlet />
      <MovimentoDeRota conteudo={conteudo} />
    </Suspense>
  );
}

export function LayoutApp() {
  const isMobile = useIsMobile();
  const usuario = useUsuario();
  const disponivel = useNotificacoesDisponiveis();
  const total = useTotalNaoLidas();
  const conteudo = useRef<HTMLElement>(null);

  if (isMobile) {
    return (
      <pf-app-layout>
        <div className="shell shell--mobile">
          <header className="topbar">
            <Logo tamanho={17} />
            <div className="topbar__acoes">
              {disponivel && (
                <Link className="topbar__sino" to="/app/notificacoes" aria-label={`Notificações${total ? `, ${total} não lidas` : ''}`}>
                  <Icone nome="sino" tamanho={20} />
                  {!!total && <span aria-hidden="true">{total > 99 ? '99+' : total}</span>}
                </Link>
              )}
              {usuario && (
                <Link className="pf-avatar topbar__avatar" to="/app/perfil" aria-label="Meu perfil" style={{ background: corDoAvatar(usuario.nome) }}>
                  {inicialDe(usuario)}
                </Link>
              )}
            </div>
          </header>
          <main ref={conteudo} className="content content--mobile"><Tela conteudo={conteudo} /></main>
          <BarraInferior />
        </div>
      </pf-app-layout>
    );
  }

  return (
    <pf-app-layout>
      <div className="shell">
        <Sidebar />
        <main ref={conteudo} className="content"><Tela conteudo={conteudo} /></main>
      </div>
    </pf-app-layout>
  );
}
