import { ReactNode } from 'react';
import './cabecalho-pagina.scss';

export function CabecalhoPagina({ titulo, subtitulo, children }: { titulo: string; subtitulo?: string; children?: ReactNode }) {
  return (
    <pf-page-header>
      <header className="head">
        <div className="head__text">
          <h1 className="head__title">{titulo}</h1>
          {subtitulo && <p className="head__subtitle">{subtitulo}</p>}
        </div>
        <div className="head__actions">{children}</div>
      </header>
    </pf-page-header>
  );
}
