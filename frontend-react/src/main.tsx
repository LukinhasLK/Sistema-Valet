import { StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { Aviso } from './compartilhado/Aviso';
import { authServico } from './nucleo/estado/auth';
import { rotas } from './rotas';
import './estilos.scss';

// O service worker entrega as notificações push; o sistema funciona sem ele.
if (window.isSecureContext && 'serviceWorker' in navigator) {
  void navigator.serviceWorker.register('/push-worker.js', { updateViaCache: 'none' }).catch(() => undefined);
}

// Como o provideAppInitializer do Angular: confirma a sessão salva antes de abrir as telas.
void authServico.restaurarSessao().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <Suspense fallback={null}>
        <RouterProvider router={rotas} />
      </Suspense>
      <Aviso />
    </StrictMode>,
  );
});
