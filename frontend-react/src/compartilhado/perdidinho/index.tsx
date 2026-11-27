import { lazy, Suspense } from 'react';
import type { PropsPerdidinho } from './Perdidinho';

/**
 * Carrega o Perdidinho (e o GSAP) só quando o tour mostra o mascote: o pacote principal do
 * sistema continua sem GSAP (ver compartilhado/movimento.ts). O Suspense local garante que,
 * enquanto o pedaço carrega, só o espaço do mascote fica vazio (o resto do tour não espera).
 */
const Perdidinho = lazy(() => import('./Perdidinho').then((m) => ({ default: m.Perdidinho })));

/** Aceita também `decorativo` e `tamanho` (usado pelo PerdidinhoDiz); o tour só passa `PropsMascote`. */
export function PerdidinhoTardio(props: PropsPerdidinho) {
  return (
    <Suspense fallback={null}>
      <Perdidinho {...props} />
    </Suspense>
  );
}
