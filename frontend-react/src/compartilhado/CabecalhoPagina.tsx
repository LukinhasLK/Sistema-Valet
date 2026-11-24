import { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { grupoDaRota } from '../layout/itens-menu';
import './cabecalho-pagina.scss';

interface Props {
  titulo: string;
  subtitulo?: ReactNode;
  /** Pequeno rótulo acima do título; padrão: o grupo do menu da rota atual. */
  sobretitulo?: string;
  children?: ReactNode;
}

export function CabecalhoPagina({ titulo, subtitulo, sobretitulo, children }: Props) {
  const { pathname } = useLocation();
  // Sem sobretítulo explícito, mostra o grupo do menu da tela (Operação, Financeiro…).
  const grupo = sobretitulo ?? (pathname === '/app/dashboard' ? undefined : grupoDaRota(pathname)?.titulo);
  return (
    <pf-page-header>
      <header className="head">
        <div className="head__text">
          {grupo && <p className="head__eyebrow">{grupo}</p>}
          <h1 className="head__title">{titulo}</h1>
          {subtitulo && <p className="head__subtitle">{subtitulo}</p>}
        </div>
        {children && <div className="head__actions">{children}</div>}
      </header>
    </pf-page-header>
  );
}
