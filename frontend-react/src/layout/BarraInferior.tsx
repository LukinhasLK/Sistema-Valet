import { useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Icone } from '../compartilhado/Icone';
import { usePrenderFoco } from '../compartilhado/usePrenderFoco';
import { authServico, useNivel } from '../nucleo/estado/auth';
import { BOTTOM_NAV_ITEMS, itensPermitidos, NAV_ITEMS, NavItem, PERFIL_ITEM } from './itens-menu';
import './bottom-nav.scss';

function PainelMais({ itens, aoFechar, aoSair }: { itens: NavItem[]; aoFechar: () => void; aoSair: () => void }) {
  const painel = useRef<HTMLDivElement>(null);
  usePrenderFoco(painel);
  return (
    <div className="mais-backdrop" onClick={aoFechar}>
      <div ref={painel} className="mais" role="dialog" aria-modal="true" aria-label="Mais opções" onClick={(e) => e.stopPropagation()}>
        <div className="mais__handle" aria-hidden="true" />
        <p className="mais__title">Mais opções</p>
        <div className="mais__grid">
          {itens.map((item) => (
            <NavLink key={item.rota} className="mais__item" to={item.rota} onClick={aoFechar}>
              <Icone nome={item.icone} tamanho={20} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>
        <button type="button" className="mais__sair" onClick={aoSair}>
          <Icone nome="sair" tamanho={18} />
          <span>Sair da conta</span>
        </button>
      </div>
    </div>
  );
}

export function BarraInferior() {
  const nivel = useNivel();
  const navegar = useNavigate();
  const [maisAberto, setMaisAberto] = useState(false);
  const itens = itensPermitidos(BOTTOM_NAV_ITEMS, nivel);
  const maisItens = [
    ...itensPermitidos(NAV_ITEMS, nivel).filter((item) => item.rota !== '/app/notificacoes' && !itens.some((b) => b.rota === item.rota)),
    PERFIL_ITEM,
  ];

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
      {maisAberto && <PainelMais itens={maisItens} aoFechar={() => setMaisAberto(false)} aoSair={sair} />}
      <nav className="bottom-nav" aria-label="Navegação">
        {itens.map((item) => (
          <NavLink key={item.rota} className={({ isActive }) => `bn-item${isActive ? ' bn-item--active' : ''}`} to={item.rota}
            onClick={() => setMaisAberto(false)}>
            <span className="bn-item__pill"><Icone nome={item.icone} tamanho={19} /></span>
            <span className="bn-item__label">{item.label}</span>
          </NavLink>
        ))}
        <button type="button" className={`bn-item${maisAberto ? ' bn-item--active' : ''}`} onClick={() => setMaisAberto((a) => !a)}>
          <span className="bn-item__pill"><Icone nome="mais" tamanho={19} /></span>
          <span className="bn-item__label">Mais</span>
        </button>
      </nav>
    </pf-bottom-nav>
  );
}
