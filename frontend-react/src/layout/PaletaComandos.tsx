import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { dataBr, moeda } from '../compartilhado/formatos';
import { Icone } from '../compartilhado/Icone';
import { TRANSICAO } from '../compartilhado/movimento';
import { rotuloSituacao } from '../compartilhado/Situacao';
import { usePrenderFoco } from '../compartilhado/usePrenderFoco';
import { authServico, useNivel, useUsuario } from '../nucleo/estado/auth';
import { useFichas } from '../nucleo/estado/fichas';
import { interfaceServico, teclaComando, useInterface, useMenuRecolhido } from '../nucleo/estado/interface';
import { onboardingServico } from '../nucleo/onboarding/estado';
import { nomeUnidade, useUnidades } from '../nucleo/estado/unidades';
import { formatarData } from '../nucleo/servicos/periodo';
import { podeAcessar } from '../nucleo/servicos/permissoes';
import { gruposPermitidos, PERFIL_ITEM } from './itens-menu';
import './paleta-comandos.scss';

interface Comando {
  id: string;
  grupo: string;
  rotulo: string;
  detalhe?: string;
  icone: string;
  termos: string;
  atalho?: string;
  executar: () => void;
}

/** Normaliza para busca sem acentos e sem diferenciar maiúsculas. */
export const normalizar = (texto: string) => texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Todas as palavras digitadas precisam aparecer no rótulo ou nos termos. */
export function combina(consulta: string, alvo: string): boolean {
  const palavras = normalizar(consulta).split(/\s+/).filter(Boolean);
  const texto = normalizar(alvo);
  return palavras.every((p) => texto.includes(p));
}

/** Abre e fecha com ⌘K (Mac) ou Ctrl+K (Windows/Linux) em qualquer tela do sistema. */
export function useAtalhoPaleta(): void {
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        interfaceServico.alternarPaleta();
      }
    };
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, []);
}

function Paleta({ aoFechar }: { aoFechar: () => void }) {
  const navegar = useNavigate();
  const { pathname } = useLocation();
  const nivel = useNivel();
  const usuario = useUsuario();
  const fichas = useFichas((s) => s.fichas);
  const unidades = useUnidades((s) => s.unidades);
  const recolhido = useMenuRecolhido();
  const [consulta, setConsulta] = useState('');
  const [ativo, setAtivo] = useState(0);
  const painel = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLInputElement>(null);
  const lista = useRef<HTMLUListElement>(null);
  const idLista = useId();
  usePrenderFoco(painel, campo);

  const ir = (rota: string) => () => navegar(rota);

  const comandos = useMemo<Comando[]>(() => {
    const navegacao = gruposPermitidos(nivel).flatMap((g) => g.itens.map((item) => ({
      id: `ir:${item.rota}`,
      grupo: 'Ir para',
      rotulo: item.label,
      detalhe: g.titulo,
      icone: item.icone,
      termos: `${item.label} ${g.titulo} ${item.termos ?? ''}`,
      executar: ir(item.rota),
    })));
    const acoes: Comando[] = [];
    if (podeAcessar(nivel, 'fichas/nova')) {
      acoes.push({ id: 'nova-ficha', grupo: 'Ações', rotulo: 'Nova ficha', detalhe: 'Lançar o caixa de um turno', icone: 'plus', termos: 'nova ficha lançar caixa fechamento turno criar', executar: ir('/app/fichas/nova') });
    }
    if (podeAcessar(nivel, 'fichas/:id/editar')) {
      acoes.push({ id: 'conferir', grupo: 'Ações', rotulo: 'Fichas prontas para conferência', detalhe: 'Fichas enviadas aguardando a gestão', icone: 'fichas', termos: 'conferir conferência prontas pendentes fechar', executar: ir('/app/fichas?situacao=PRONTA&mes=0') });
    }
    if (podeAcessar(nivel, 'pagamentos-manobristas')) {
      acoes.push({ id: 'pagar', grupo: 'Ações', rotulo: 'Pagamentos pendentes', detalhe: 'Diárias a pagar por Pix', icone: 'pagamentos', termos: 'pagar diárias pix pendentes manobristas', executar: ir('/app/pagamentos-manobristas') });
    }
    acoes.push(
      { id: 'perfil', grupo: 'Conta', rotulo: PERFIL_ITEM.label, icone: PERFIL_ITEM.icone, termos: `${PERFIL_ITEM.label} ${PERFIL_ITEM.termos}`, executar: ir(PERFIL_ITEM.rota) },
      { id: 'tour', grupo: 'Conta', rotulo: 'Rever o tour guiado', detalhe: 'Passo a passo do sistema', icone: 'tour', termos: 'tutorial ajuda tour onboarding aprender guia', executar: () => onboardingServico.iniciar(usuario?.id, nivel) },
      { id: 'menu', grupo: 'Conta', rotulo: recolhido ? 'Expandir o menu lateral' : 'Recolher o menu lateral', icone: recolhido ? 'expandir' : 'recolher', atalho: '[', termos: 'menu lateral recolher expandir sidebar', executar: () => interfaceServico.alternarMenu(recolhido) },
      { id: 'sair', grupo: 'Conta', rotulo: 'Sair da conta', icone: 'sair', termos: 'sair logout desconectar', executar: () => { authServico.logout(); navegar('/login'); } },
    );
    return [...navegacao, ...acoes];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nivel, recolhido, usuario?.id]);

  const resultados = useMemo(() => {
    const filtrados = consulta.trim() ? comandos.filter((c) => combina(consulta, `${c.rotulo} ${c.termos}`)) : comandos;
    // Fichas: busca por data ("24/11") ou unidade, a partir de 2 caracteres.
    const fichasAchadas: Comando[] = consulta.trim().length >= 2 && podeAcessar(nivel, 'fichas')
      ? fichas
        .filter((f) => combina(consulta, `${formatarData(f.data)} ${f.data} ${nomeUnidade(unidades, f.unidadeId)} ${rotuloSituacao(f.situacao)}`))
        .sort((a, b) => b.data.localeCompare(a.data) || b.id - a.id)
        .slice(0, 6)
        .map((f) => ({
          id: `ficha:${f.id}`,
          grupo: 'Fichas',
          rotulo: `Ficha de ${dataBr(f.data)} · ${nomeUnidade(unidades, f.unidadeId)}`,
          detalhe: `${rotuloSituacao(f.situacao)} · ${moeda(f.totalLiquido)}`,
          icone: 'fichas',
          termos: '',
          executar: ir(`/app/fichas?detalhe=${f.id}&mes=0`),
        }))
      : [];
    return [...filtrados, ...fichasAchadas];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consulta, comandos, fichas, unidades, nivel]);

  useEffect(() => setAtivo(0), [consulta]);
  useEffect(() => {
    lista.current?.querySelector<HTMLElement>(`[data-indice="${ativo}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [ativo]);

  function executar(c: Comando | undefined) {
    if (!c) return;
    aoFechar();
    c.executar();
  }

  function aoTeclar(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setAtivo((a) => Math.min(a + 1, resultados.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setAtivo((a) => Math.max(a - 1, 0)); }
    if (e.key === 'Home') { e.preventDefault(); setAtivo(0); }
    if (e.key === 'End') { e.preventDefault(); setAtivo(resultados.length - 1); }
    if (e.key === 'Enter') { e.preventDefault(); executar(resultados[ativo]); }
    if (e.key === 'Escape') { e.preventDefault(); aoFechar(); }
  }

  let grupoAnterior = '';
  return (
    <motion.div className="paleta__fundo" onClick={aoFechar}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: TRANSICAO.saida }} transition={TRANSICAO.rapida}>
      <motion.div ref={painel} className="paleta" role="dialog" aria-modal="true" aria-label="Paleta de comandos"
        onClick={(e) => e.stopPropagation()} onKeyDown={aoTeclar}
        initial={{ opacity: 0, y: -8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -4, scale: 0.99, transition: TRANSICAO.saida }} transition={TRANSICAO.mola}>
        <div className="paleta__busca">
          <Icone nome="busca" tamanho={18} />
          <input ref={campo} type="text" role="combobox" aria-expanded="true" aria-controls={idLista} aria-autocomplete="list"
            aria-activedescendant={resultados[ativo] ? `${idLista}-${ativo}` : undefined}
            placeholder="Buscar telas, ações ou fichas (ex.: 24/11)…" value={consulta} onChange={(e) => setConsulta(e.target.value)} />
          <kbd>Esc</kbd>
        </div>
        <ul ref={lista} id={idLista} className="paleta__lista" role="listbox" aria-label="Resultados">
          {resultados.map((c, i) => {
            const cabecalho = c.grupo !== grupoAnterior ? c.grupo : '';
            grupoAnterior = c.grupo;
            const atual = c.id === `ir:${pathname}`;
            return (
              <li key={c.id} role="presentation">
                {cabecalho && <p className="paleta__grupo" role="presentation">{cabecalho}</p>}
                <div id={`${idLista}-${i}`} role="option" aria-selected={i === ativo} data-indice={i}
                  className={`paleta__item${i === ativo ? ' paleta__item--ativo' : ''}`}
                  onPointerMove={() => setAtivo(i)} onClick={() => executar(c)}>
                  <span className="paleta__icone"><Icone nome={c.icone} tamanho={16} /></span>
                  <span className="paleta__textos">
                    <span className="paleta__rotulo">{c.rotulo}</span>
                    {c.detalhe && <span className="paleta__detalhe">{c.detalhe}</span>}
                  </span>
                  {atual && <span className="paleta__aqui">Você está aqui</span>}
                  {c.atalho && <kbd>{c.atalho}</kbd>}
                  {i === ativo && <Icone nome="enter" tamanho={14} className="paleta__enter" />}
                </div>
              </li>
            );
          })}
          {!resultados.length && (
            <li className="paleta__vazio" role="presentation">
              Nada encontrado para “{consulta}”. Tente o nome de uma tela ou uma data (ex.: 24/11).
            </li>
          )}
        </ul>
        <footer className="paleta__rodape" aria-hidden="true">
          <span><kbd>↑</kbd><kbd>↓</kbd> navegar</span>
          <span><kbd>↵</kbd> abrir</span>
          <span><kbd>{teclaComando}</kbd><kbd>K</kbd> abrir/fechar</span>
        </footer>
      </motion.div>
    </motion.div>
  );
}

/** Paleta de comandos global (Linear/IA Faz): só mostra o que o nível do usuário pode acessar. */
export function PaletaComandos() {
  const aberta = useInterface((s) => s.paletaAberta);
  useAtalhoPaleta();
  return createPortal(
    <pf-paleta>
      <AnimatePresence>{aberta && <Paleta key="paleta" aoFechar={interfaceServico.fecharPaleta} />}</AnimatePresence>
    </pf-paleta>,
    document.body,
  );
}
