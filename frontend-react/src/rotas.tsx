import { lazy, ReactNode } from 'react';
import { createBrowserRouter, Navigate, useLocation } from 'react-router-dom';
import { LayoutApp } from './layout/LayoutApp';
import { useAuth } from './nucleo/estado/auth';
import { podeAcessar, rotaInicial } from './nucleo/servicos/permissoes';

const Login = lazy(() => import('./telas/login/Login'));
const Dashboard = lazy(() => import('./telas/dashboard/Dashboard'));
const ListaFichas = lazy(() => import('./telas/fichas/ListaFichas'));
const NovaFicha = lazy(() => import('./telas/fichas/NovaFicha'));
const Relatorios = lazy(() => import('./telas/relatorios/Relatorios'));
const Manobristas = lazy(() => import('./telas/manobristas/Manobristas'));
const PagamentosManobristas = lazy(() => import('./telas/pagamentos-manobristas/PagamentosManobristas'));
const DivisaoLucro = lazy(() => import('./telas/divisao-lucro/DivisaoLucro'));
const Despesas = lazy(() => import('./telas/despesas/Despesas'));
const CarrosPorMes = lazy(() => import('./telas/carros-por-mes/CarrosPorMes'));
const Unidades = lazy(() => import('./telas/unidades/Unidades'));
const Agenda = lazy(() => import('./telas/agenda/Agenda'));
const Socios = lazy(() => import('./telas/socios/Socios'));
const Usuarios = lazy(() => import('./telas/usuarios/Usuarios'));
const Notificacoes = lazy(() => import('./telas/notificacoes/Notificacoes'));
const Perfil = lazy(() => import('./telas/perfil/Perfil'));
const Conheca = lazy(() => import('./telas/conheca/Conheca'));
const Planos = lazy(() => import('./telas/conheca/Planos'));

/** Exige login (antigo authGuard). */
function ComSessao({ children }: { children: ReactNode }) {
  const autenticado = useAuth((s) => s.usuario !== null);
  const local = useLocation();
  if (!autenticado) return <Navigate to={`/login?redirectTo=${encodeURIComponent(local.pathname + local.search)}`} replace />;
  return <>{children}</>;
}

/** Impede que um usuário já logado volte para a tela de login (antigo guestGuard). */
function SemSessao({ children }: { children: ReactNode }) {
  const nivel = useAuth((s) => s.usuario?.nivel ?? null);
  if (nivel) return <Navigate to={rotaInicial(nivel)} replace />;
  return <>{children}</>;
}

/** Bloqueia telas que o nível do usuário não pode ver (antigo roleGuard; ver PERMISSOES). */
function ComPermissao({ rota, children }: { rota: string; children: ReactNode }) {
  const nivel = useAuth((s) => s.usuario?.nivel ?? null);
  if (!podeAcessar(nivel, rota)) return <Navigate to={rotaInicial(nivel)} replace />;
  return <>{children}</>;
}

function Inicio() {
  const nivel = useAuth((s) => s.usuario?.nivel ?? null);
  if (nivel) return <Navigate to={rotaInicial(nivel)} replace />;
  return <Conheca />;
}

const tela = (rota: string, elemento: ReactNode) => ({ path: rota, element: <ComPermissao rota={rota}>{elemento}</ComPermissao> });

export const rotas = createBrowserRouter([
  // Página inicial: apresentação para quem não está logado; quem tem sessão vai direto ao sistema.
  { path: '/', element: <Inicio /> },
  { path: '/login', element: <SemSessao><Login /></SemSessao> },
  // Apresentação pública do produto (não substitui a entrada do sistema).
  { path: '/conheca', element: <Conheca /> },
  { path: '/planos', element: <Planos /> },
  {
    path: '/app',
    element: <ComSessao><LayoutApp /></ComSessao>,
    children: [
      { index: true, element: <Navigate to="dashboard" replace /> },
      tela('dashboard', <Dashboard />),
      tela('fichas', <ListaFichas />),
      tela('fichas/nova', <NovaFicha />),
      tela('fichas/:id/editar', <NovaFicha />),
      tela('relatorios', <Relatorios />),
      tela('manobristas', <Manobristas />),
      tela('pagamentos-manobristas', <PagamentosManobristas />),
      tela('divisao-lucro', <DivisaoLucro />),
      tela('despesas', <Despesas />),
      tela('carros-por-mes', <CarrosPorMes />),
      tela('unidades', <Unidades />),
      tela('eventos', <Agenda key="eventos" tipo="eventos" />),
      tela('escalas', <Agenda key="escalas" tipo="escalas" />),
      tela('socios', <Socios />),
      tela('usuarios', <Usuarios />),
      tela('notificacoes', <Notificacoes />),
      tela('perfil', <Perfil />),
    ],
  },
  { path: '*', element: <Navigate to="/app/dashboard" replace /> },
]);
