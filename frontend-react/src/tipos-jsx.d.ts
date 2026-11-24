import 'react';

/**
 * As telas usam elementos com o mesmo nome dos componentes Angular (`<pf-sidebar>`, `<pf-modal>`...)
 * como raiz. Assim o CSS de cada componente continua restrito a ele, como no Angular.
 */
declare module 'react' {
   
  namespace JSX {
    interface IntrinsicElements {
      [tag: `pf-${string}`]: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    }
  }
}
