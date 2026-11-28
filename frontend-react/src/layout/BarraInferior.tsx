import { useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useDragControls } from 'motion/react';
import { Icone } from '../compartilhado/Icone';
import { TRANSICAO } from '../compartilhado/movimento';
import { usePrenderFoco } from '../compartilhado/usePrenderFoco';
import { authServico, useNivel } from '../nucleo/estado/auth';
import { BOTTOM_NAV_ITEMS, gruposPermitidos, itensPermitidos, PERFIL_ITEM } from './itens-menu';
import './bottom-nav.scss';

function PainelMais({ aoFechar, aoSair }: { aoFechar: () => void; aoSair: () => void }) {
  const painel = useRef<HTMLDivElement>(null);
  const nivel = useNivel();
  const arrastar = useDragControls();
  usePrenderFoco(painel);
  const fixos = new Set(itensPermitidos(BOTTOM_NAV_ITEMS, nivel).map((i) => i.rota));
  // Mesmos grupos do menu do desktop; os atalhos já presentes na barra não se repetem.
  const grupos = gruposPermitidos(nivel)
    .map((g) => ({ ...g, itens: g.itens.filter((i) => !fixos.has(i.rota) && i.rota !== '/app/notificacoes') }))
    .filter((g) => g.itens.length);
  return (
    <motion.div className="mais-backdrop" onClick={aoFechar}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: TRANSICAO.saida }} transition={TRANSICAO.rapida}>
      <motion.div ref={painel} className="mais" role="dialog" aria-modal="true" aria-label="Mais opções" onClick={(e) => e.stopPropagation()}
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%', transition: TRANSICAO.saida }} transition={TRANSICAO.mola}
        drag="y" dragListener={false} dragControls={arrastar} dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 0.6 }}
        onDragEnd={(_, info) => { if (info.offset.y > 90 || info.velocity.y > 500) aoFechar(); }}>
        <div className="mais__alca" aria-hidden="true" onPointerDown={(e) => arrastar.start(e)}><span className="mais__handle" /></div>
        {grupos.map((g) => (
          <section key={g.id} className="mais__grupo" aria-label={g.titulo}>
            <p className="mais__title">{g.titulo}</p>
            <div className="mais__grid">
              {g.itens.map((item) => (
                <NavLink key={item.rota} className="mais__item" to={item.rota} onClick={aoFechar}>
                  <span className="mais__icone"><Icone nome={item.icone} tamanho={19} /></span>
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
          </section>
        ))}
        <section className="mais__grupo" aria-label="Conta">
          <p className="mais__title">Conta</p>
          <div className="mais__grid">
            <NavLink className="mais__item" to={PERFIL_ITEM.rota} onClick={aoFechar}>
              <span className="mais__icone"><Icone nome={PERFIL_ITEM.icone} tamanho={19} /></span>
              <span>{PERFIL_ITEM.label}</span>
            </NavLink>
          </div>
        </section>
        <button type="button" className="mais__sair" onClick={aoSair}>
          <Icone nome="sair" tamanho={18} />
          <span>Sair da conta</span>
        </button>
      </motion.div>
    </motion.div>
  );
}

export function BarraInferior() {
  const nivel = useNivel();
  const navegar = useNavigate();
  const [maisAberto, setMaisAberto] = useState(false);
  const itens = itensPermitidos(BOTTOM_NAV_ITEMS, nivel);

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => { if (e.key === 'Escape') setMaisAberto(false); };
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, []);

  function sair() {
    setMaisAberto(false);
    authServico.logout();
    navegar('/login');
  }

  return (
    <pf-bottom-nav>
      <AnimatePresence>
        {maisAberto && <PainelMais key="mais" aoFechar={() => setMaisAberto(false)} aoSair={sair} />}
      </AnimatePresence>
      <nav className="bottom-nav" aria-label="Navegação" data-tour="menu">
        {itens.map((item) => (
          <NavLink key={item.rota} className={({ isActive }) => `bn-item${isActive ? ' bn-item--active' : ''}`} to={item.rota}
            onClick={() => setMaisAberto(false)}>
            {({ isActive }) => (
              <>
                <span className="bn-item__pill">
                  {isActive && !maisAberto && <motion.span layoutId="bn-ativo" className="bn-item__fundo" transition={TRANSICAO.mola} />}
                  <Icone nome={item.icone} tamanho={19} />
                </span>
                <span className="bn-item__label">{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
        <button type="button" className={`bn-item${maisAberto ? ' bn-item--active' : ''}`} aria-expanded={maisAberto} onClick={() => setMaisAberto((a) => !a)}>
          <span className="bn-item__pill">
            {maisAberto && <motion.span layoutId="bn-ativo" className="bn-item__fundo" transition={TRANSICAO.mola} />}
            <Icone nome="mais" tamanho={19} />
          </span>
          <span className="bn-item__label">Mais</span>
        </button>
      </nav>
    </pf-bottom-nav>
  );
}
