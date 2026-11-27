import { useEffect, useRef, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Icone } from '../../compartilhado/Icone';
import { Logo } from '../../compartilhado/Logo';
import { TRANSICAO } from '../../compartilhado/movimento';
import { useAuth } from '../../nucleo/estado/auth';
import { rotaInicial } from '../../nucleo/servicos/permissoes';

/** Seções da apresentação. Ela mora em /conheca: a raiz do site leva ao login. */
const LINKS = [
  { rotulo: 'Como funciona', para: '/conheca#como-funciona' },
  { rotulo: 'Recursos', para: '/conheca#recursos' },
  { rotulo: 'No celular', para: '/conheca#celular' },
  { rotulo: 'Segurança', para: '/conheca#seguranca' },
];

/** Barra superior das páginas públicas (apresentação e planos), com menu no celular. */
export function TopoPublico() {
  const nivel = useAuth((s) => s.usuario?.nivel ?? null);
  const [aberto, setAberto] = useState(false);
  const botaoMenu = useRef<HTMLButtonElement>(null);
  const destino = nivel ? rotaInicial(nivel) : '/login';

  // Esc fecha o menu móvel e devolve o foco ao botão que o abriu.
  useEffect(() => {
    if (!aberto) return;
    const aoTecla = (ev: KeyboardEvent) => {
      if (ev.key !== 'Escape') return;
      setAberto(false);
      botaoMenu.current?.focus();
    };
    document.addEventListener('keydown', aoTecla);
    return () => document.removeEventListener('keydown', aoTecla);
  }, [aberto]);

  return (
    <>
    <a className="pular-conteudo" href="#conteudo">Pular para o conteúdo</a>
    <header className="topo">
      <Link to="/conheca" onClick={() => setAberto(false)}><Logo tamanho={19} /></Link>
      <nav className="topo__nav" aria-label="Seções">
        {LINKS.map((l) => <Link key={l.para} to={l.para}>{l.rotulo}</Link>)}
        <NavLink to="/google-calendar" className={({ isActive }) => (isActive ? 'ativo' : undefined)}>Google Calendar</NavLink>
        <NavLink to="/planos" className={({ isActive }) => (isActive ? 'ativo' : undefined)}>Planos</NavLink>
      </nav>
      <div className="topo__acoes">
        <Link className="pf-btn pf-btn--primary pf-btn--sm" to={destino}>{nivel ? 'Abrir o sistema' : 'Entrar'}</Link>
        <button ref={botaoMenu} type="button" className="topo__menu" aria-label="Menu" aria-expanded={aberto} onClick={() => setAberto((a) => !a)}>
          <Icone nome={aberto ? 'fechar' : 'mais'} tamanho={20} />
        </button>
      </div>
      <AnimatePresence>
        {aberto && (
          <motion.nav className="topo__gaveta" aria-label="Seções e páginas" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={TRANSICAO.rapida}>
            {LINKS.map((l) => <Link key={l.para} to={l.para} onClick={() => setAberto(false)}>{l.rotulo}</Link>)}
            <Link to="/google-calendar" onClick={() => setAberto(false)}>Google Calendar</Link>
            <Link to="/planos" onClick={() => setAberto(false)}>Planos</Link>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
    </>
  );
}
