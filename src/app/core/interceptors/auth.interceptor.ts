import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { API_URL } from '../services/api';
import { AuthService } from '../services/auth.service';

/** Envia o JWT nas chamadas à API e encerra a sessão se o servidor responder 401. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(API_URL)) return next(req);

  const auth = inject(AuthService);
  const router = inject(Router);
  const token = auth.token();
  const pedido = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(pedido).pipe(
    catchError((erro: unknown) => {
      const ehLogin = req.url.endsWith('/auth/login');
      if (erro instanceof HttpErrorResponse && erro.status === 401 && !ehLogin && auth.autenticado()) {
        auth.logout();
        void router.navigateByUrl('/login');
      }
      return throwError(() => erro);
    })
  );
};
