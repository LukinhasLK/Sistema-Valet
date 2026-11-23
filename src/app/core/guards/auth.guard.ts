import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { podeAcessar, rotaInicial } from '../services/permissoes';

export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.autenticado()) return true;

  return router.createUrlTree(['/login'], { queryParams: { redirectTo: state.url } });
};

/** Impede que um usuário já logado volte para a tela de login. */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.autenticado() ? router.parseUrl(rotaInicial(auth.nivel())) : true;
};

/** Bloqueia rotas que o nível do usuário não pode ver (ver PERMISSOES). */
export const roleGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const rota = route.routeConfig?.path ?? '';

  return podeAcessar(auth.nivel(), rota) ? true : router.parseUrl(rotaInicial(auth.nivel()));
};
