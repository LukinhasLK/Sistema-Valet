import { lazy, ReactNode, Suspense, useState } from 'react';
import { createBrowserRouter, Navigate, useLocation } from 'react-router-dom';
import { LayoutApp } from './layout/LayoutApp';
import { authServico, useAuth } from './nucleo/estado/auth';
import { reduzido } from './compartilhado/movimento';
import { podeAcessar, rotaInicial } from './nucleo/servicos/permissoes';

/** Fora do pacote principal: só baixa se a tela "sem conexão" aparecer (o texto já está na tela enquanto carrega). */
const FRASE_SEM_CONEXAO = 'Seu login continua salvo neste aparelho. Confira a internet ou aguarde um instante e tente de novo.';
/** Sem rede o pedaço pode não carregar: nesse caso fica só o texto, nunca uma tela quebrada. */
const PerdidinhoDiz = lazy(() => import('./compartilhado/perdidinho/PerdidinhoDiz')
  .then((m) => ({ default: m.PerdidinhoDiz }))
  .catch(() => ({ default: () => <p>{FRASE_SEM_CONEXAO}</p> })));

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
const Sociedade = lazy(() => import('./telas/sociedade/Sociedade'));
const Conheca = lazy(() => import('./telas/conheca/Conheca'));
const Planos = lazy(() => import('./telas/conheca/Planos'));
const GoogleCalendar = lazy(() => import('./telas/conheca/GoogleCalendar'));

/** Exige login (antigo authGuard). */
function ComSessao({ children }: { children: ReactNode }) {
  const autenticado = useAuth((s) => s.usuario !== null);
  const semConexao = useAuth((s) => s.semConexao && s.token !== null);
  const local = useLocation();
  // Login salvo, mas o servidor não respondeu: não pede a senha de novo, oferece tentar outra vez.
  if (!autenticado && semConexao) return <SemConexao />;
  if (!autenticado) return <Navigate to={`/login?redirectTo=${encodeURIComponent(local.pathname + local.search)}`} replace />;
  return <>{children}</>;
}

export function SemConexao() {
  const [tentando, setTentando] = useState(false);
  async function tentar() {
    setTentando(true);
    await authServico.restaurarSessao();
    setTentando(false);
  }
  return (
    <main className="sem-conexao" role="alert">
      <h1>Sem conexão com o servidor</h1>
      <div className="sem-conexao__mascote">
        <Suspense fallback={<p>{FRASE_SEM_CONEXAO}</p>}>
          <PerdidinhoDiz humor={tentando ? 'pensando' : 'triste'} tamanho={72} texto={FRASE_SEM_CONEXAO} reduzirMovimento={reduzido()} />
        </Suspense>
      </div>
      <button type="button" className="pf-btn pf-btn--primary" onClick={tentar} disabled={tentando}>
        {tentando ? 'Tentando…' : 'Tentar de novo'}
      </button>
    </main>
  );
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

/** Endereço raiz: a equipe entra pelo login; a apresentação fica em /conheca. */
function Inicio() {
  const nivel = useAuth((s) => s.usuario?.nivel ?? null);
  return <Navigate to={nivel ? rotaInicial(nivel) : '/login'} replace />;
}

const tela = (rota: string, elemento: ReactNode) => ({ path: rota, element: <ComPermissao rota={rota}>{elemento}</ComPermissao> });

export const rotas = createBrowserRouter([
  // Página inicial: apresentação para quem não está logado; quem tem sessão vai direto ao sistema.
  { path: '/', element: <Inicio /> },
  { path: '/login', element: <SemSessao><Login /></SemSessao> },
  // Apresentação pública do produto (não substitui a entrada do sistema).
  { path: '/conheca', element: <Conheca /> },
  { path: '/planos', element: <Planos /> },
  { path: '/google-calendar', element: <GoogleCalendar /> },
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
      tela('sociedade', <Sociedade />),
      tela('perfil', <Perfil />),
    ],
  },
  { path: '*', element: <Navigate to="/app/dashboard" replace /> },
]);
