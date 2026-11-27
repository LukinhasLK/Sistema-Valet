import { Link } from 'react-router-dom';
import { Logo } from '../../compartilhado/Logo';
import './rodape-publico.scss';

const LINKS = [
  { rotulo: 'Apresentação', para: '/conheca' },
  { rotulo: 'Google Calendar', para: '/google-calendar' },
  { rotulo: 'Planos', para: '/planos' },
  { rotulo: 'Entrar', para: '/login' },
] as const;

interface Props {
  /** Caminho da página atual: marca o link com aria-current="page". */
  atual: (typeof LINKS)[number]['para'];
  /** Nota legal da página. */
  nota: string;
}

/** Rodapé único das páginas públicas. Estilo em rodape-publico.scss (data-atual marca a página). */
export function RodapePublico({ atual, nota }: Props) {
  return (
    <footer className="rodape-publico">
      <Logo tamanho={15} />
      <nav aria-label="Rodapé">
        {LINKS.map((l) => (
          <Link key={l.para} to={l.para} aria-current={l.para === atual ? 'page' : undefined}>{l.rotulo}</Link>
        ))}
      </nav>
      <p>{nota}</p>
    </footer>
  );
}
