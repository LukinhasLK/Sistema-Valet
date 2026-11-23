import { Routes } from '@angular/router';
import { authGuard, guestGuard, roleGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'app/dashboard' },

  {
    path: 'login',
    canActivate: [guestGuard],
    title: 'Entrar · Park Flash',
    loadComponent: () => import('./features/auth/login/login.component').then((m) => m.LoginComponent),
  },

  {
    path: 'app',
    canActivate: [authGuard],
    loadComponent: () => import('./layouts/app-layout/app-layout.component').then((m) => m.AppLayoutComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        canActivate: [roleGuard],
        title: 'Dashboard · Park Flash',
        loadComponent: () => import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'fichas',
        canActivate: [roleGuard],
        title: 'Fichas · Park Flash',
        loadComponent: () => import('./features/fichas/fichas-list/fichas-list.component').then((m) => m.FichasListComponent),
      },
      {
        path: 'fichas/nova',
        canActivate: [roleGuard],
        title: 'Nova ficha · Park Flash',
        loadComponent: () => import('./features/fichas/nova-ficha/nova-ficha.component').then((m) => m.NovaFichaComponent),
      },
      {
        path: 'fichas/:id/editar',
        canActivate: [roleGuard],
        title: 'Editar ficha · Park Flash',
        loadComponent: () => import('./features/fichas/nova-ficha/nova-ficha.component').then((m) => m.NovaFichaComponent),
      },
      {
        path: 'relatorios',
        canActivate: [roleGuard],
        title: 'Relatórios · Park Flash',
        loadComponent: () => import('./features/relatorios/relatorios.component').then((m) => m.RelatoriosComponent),
      },
      {
        path: 'manobristas',
        canActivate: [roleGuard],
        title: 'Manobristas · Park Flash',
        loadComponent: () => import('./features/manobristas/manobristas.component').then((m) => m.ManobristasComponent),
      },
      {
        path: 'pagamentos-manobristas',
        canActivate: [roleGuard],
        title: 'Pagamentos de Manobristas · Park Flash',
        loadComponent: () => import('./features/pagamentos-manobristas/pagamentos-manobristas.component')
          .then((m) => m.PagamentosManobristasComponent),
      },
      {
        path: 'divisao-lucro',
        canActivate: [roleGuard],
        title: 'Divisão de Lucro · Park Flash',
        loadComponent: () => import('./features/divisao-lucro/divisao-lucro.component').then((m) => m.DivisaoLucroComponent),
      },
      {
        path: 'despesas',
        canActivate: [roleGuard],
        title: 'Despesas · Park Flash',
        loadComponent: () => import('./features/despesas/despesas.component').then((m) => m.DespesasComponent),
      },
      {
        path: 'carros-por-mes',
        canActivate: [roleGuard],
        title: 'Carros por Mês · Park Flash',
        loadComponent: () => import('./features/carros-por-mes/carros-por-mes.component').then((m) => m.CarrosPorMesComponent),
      },
      {
        path: 'unidades',
        canActivate: [roleGuard],
        title: 'Unidades · Park Flash',
        loadComponent: () => import('./features/unidades/unidades.component').then((m) => m.UnidadesComponent),
      },
      {
        path: 'eventos',
        canActivate: [roleGuard],
        data: { tipo: 'eventos' },
        loadComponent: () => import('./features/agenda/agenda.component').then(m => m.AgendaComponent),
      },
      {
        path: 'escalas',
        canActivate: [roleGuard],
        data: { tipo: 'escalas' },
        loadComponent: () => import('./features/agenda/agenda.component').then(m => m.AgendaComponent),
      },
      {
        path: 'socios',
        canActivate: [roleGuard],
        title: 'Sócios · Park Flash',
        loadComponent: () => import('./features/socios/socios.component').then((m) => m.SociosComponent),
      },
      {
        path: 'usuarios',
        canActivate: [roleGuard],
        title: 'Usuários · Park Flash',
        loadComponent: () => import('./features/usuarios/usuarios.component').then((m) => m.UsuariosComponent),
      },
      {
        path: 'notificacoes',
        canActivate: [roleGuard],
        loadComponent: () => import('./features/notificacoes/notificacoes.component').then(m => m.NotificacoesComponent),
      },
      {
        path: 'perfil',
        canActivate: [roleGuard],
        title: 'Meu perfil · Park Flash',
        loadComponent: () => import('./features/perfil/perfil.component').then((m) => m.PerfilComponent),
      },
    ],
  },

  { path: '**', redirectTo: 'app/dashboard' },
];
