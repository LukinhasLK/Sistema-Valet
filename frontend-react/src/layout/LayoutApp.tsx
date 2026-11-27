import { Suspense, useLayoutEffect, useRef } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { Esqueleto, EsqueletoKpis } from '../compartilhado/Esqueleto';
import { Icone } from '../compartilhado/Icone';
import { Logo } from '../compartilhado/Logo';
import { AjudantePerdidinho } from '../compartilhado/perdidinho/AjudantePerdidinho';
import { entradaDeTela } from '../compartilhado/movimento';
import { inicialDe, useUsuario } from '../nucleo/estado/auth';
import { useAtualizacaoAutomatica } from '../nucleo/estado/atualizacao';
import { interfaceServico } from '../nucleo/estado/interface';
import { useIsMobile } from '../nucleo/estado/layout';
import { useNotificacoesDisponiveis, useTotalNaoLidas } from '../nucleo/servicos/notificacoes';
import { BarraInferior } from './BarraInferior';
import { corDoAvatar } from './itens-menu';
import { PaletaComandos } from './PaletaComandos';
import { Sidebar } from './Sidebar';
import { TourGuiado } from './TourGuiado';
import './app-layout.scss';

/**
 * Ao trocar de tela, título, filtros, indicadores, cartões e linhas entram em cascata curta.
 * Fica dentro do mesmo Suspense da tela: só roda depois que a tela carregada aparece.
 */
function MovimentoDeRota({ conteudo }: { conteudo: React.RefObject<HTMLElement> }) {
  const { pathname } = useLocation();
  useLayoutEffect(() => {
    const pagina = conteudo.current;
    if (!pagina) return;
    return entradaDeTela(pagina);
  }, [pathname, conteudo]);
  return null;
}

/** Esqueleto da tela enquanto o código dela é baixado. */
function CarregandoTela() {
  return (
    <div className="pf-page" role="status" aria-label="Carregando tela">
      <Esqueleto largura={220} altura={30} style={{ marginBottom: 10 }} />
      <Esqueleto largura={160} altura={13} style={{ marginBottom: 28 }} />
      <EsqueletoKpis />
    </div>
  );
}

function Tela({ conteudo }: { conteudo: React.RefObject<HTMLElement> }) {
  return (
    <Suspense fallback={<CarregandoTela />}>
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
  useAtualizacaoAutomatica();

  if (isMobile) {
    return (
      <pf-app-layout>
        <div className="shell shell--mobile">
          <header className="topbar">
            <Link to="/app/dashboard" className="topbar__logo"><Logo tamanho={17} /></Link>
            <div className="topbar__acoes">
              <button type="button" className="topbar__botao" aria-label="Buscar ou ir para" onClick={interfaceServico.abrirPaleta} data-tour="paleta">
                <Icone nome="busca" tamanho={20} />
              </button>
              {usuario && <AjudantePerdidinho variante="topo" />}
              {disponivel && (
                <Link className="topbar__botao topbar__sino" to="/app/notificacoes" aria-label={`Notificações${total ? `, ${total} não lidas` : ''}`}>
                  <Icone nome="sino" tamanho={20} />
                  {!!total && <span aria-hidden="true">{total > 99 ? '99+' : total}</span>}
                </Link>
              )}
              {usuario && (
                <Link className="pf-avatar topbar__avatar" to="/app/perfil" aria-label="Meu perfil" data-tour="perfil" style={{ background: corDoAvatar(usuario.nome) }}>
                  {inicialDe(usuario)}
                </Link>
              )}
            </div>
          </header>
          <main ref={conteudo} className="content content--mobile"><Tela conteudo={conteudo} /></main>
          <BarraInferior />
        </div>
        <PaletaComandos />
        <TourGuiado />
      </pf-app-layout>
    );
  }

  return (
    <pf-app-layout>
      <div className="shell">
        <Sidebar />
        <main ref={conteudo} className="content"><Tela conteudo={conteudo} /></main>
      </div>
      {usuario && <AjudantePerdidinho variante="lado" />}
      <PaletaComandos />
      <TourGuiado />
    </pf-app-layout>
  );
}
