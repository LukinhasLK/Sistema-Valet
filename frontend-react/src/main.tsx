import { StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { MotionConfig } from 'motion/react';
import { TRANSICAO } from './compartilhado/movimento';
import { Aviso } from './compartilhado/Aviso';
import { authServico } from './nucleo/estado/auth';
import { registrarMascote } from './nucleo/onboarding/mascote';
import { PerdidinhoTardio } from './compartilhado/perdidinho';
import { rotas } from './rotas';
// Fontes servidas pelo próprio site (sem chamadas ao Google Fonts).
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-700.css';
import '@fontsource/plus-jakarta-sans/latin-600.css';
import '@fontsource/plus-jakarta-sans/latin-700.css';
import '@fontsource/plus-jakarta-sans/latin-800.css';
import './estilos.scss';

// Perdidinho, o guia do tour (carregado só quando o tour aparece).
registrarMascote(PerdidinhoTardio);

// O service worker entrega as notificações push; o sistema funciona sem ele.
if (window.isSecureContext && 'serviceWorker' in navigator) {
  void navigator.serviceWorker.register('/push-worker.js', { updateViaCache: 'none' }).catch(() => undefined);
}

// Como o provideAppInitializer do Angular: confirma a sessão salva antes de abrir as telas.
void authServico.restaurarSessao().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      {/* reducedMotion="user": com "reduzir movimento" ligado, o Motion não anima deslocamentos. */}
      <MotionConfig reducedMotion="user" transition={TRANSICAO.base}>
        <Suspense fallback={null}>
          <RouterProvider router={rotas} />
        </Suspense>
        <Aviso />
      </MotionConfig>
    </StrictMode>,
  );
});
