import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { dataHora } from '../../compartilhado/formatos';
import { Icone } from '../../compartilhado/Icone';
import { TRANSICAO } from '../../compartilhado/movimento';
import { useIsMobile } from '../../nucleo/estado/layout';
import { nomeUnidade, useUnidades } from '../../nucleo/estado/unidades';
import { agendaServico, Escala, Evento } from '../../nucleo/servicos/agenda';
import { mensagemDeErro } from '../../nucleo/servicos/api';
import { MESES } from '../../nucleo/servicos/periodo';
import { gradeDoMes, hoje, itensPorDia } from './calendario-agenda';
import './calendario-agenda.scss';

type Item = Evento | Escala;
const SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const TAMANHO_PAGINA = 50;
const hora = (valor: string) => valor.slice(11, 16);

interface Props {
  tipo: 'eventos' | 'escalas';
  unidade: number | null;
  /** Muda depois de salvar um registro, para recarregar o mês. */
  versao: number;
  rotuloSituacao: (item: Item) => string;
  tituloDe: (item: Item) => string;
  aoAbrir: (item: Item) => void;
  aoCriarNoDia: (diaIso: string) => void;
}

/** Calendário mensal com a quantidade de eventos (ou escalas) marcados em cada dia. */
export function CalendarioAgenda({ tipo, unidade, versao, rotuloSituacao, tituloDe, aoAbrir, aoCriarNoDia }: Props) {
  const isMobile = useIsMobile();
  const unidades = useUnidades((s) => s.unidades);
  const [mes, setMes] = useState(() => { const d = new Date(); return { ano: d.getFullYear(), mes: d.getMonth() + 1 }; });
  const [itens, setItens] = useState<Item[]>([]);
  const [estado, setEstado] = useState<'carregando' | 'pronto' | { erro: string }>('carregando');
  const [diaEscolhido, setDiaEscolhido] = useState(hoje());
  const [tentativa, setTentativa] = useState(0);

  const grade = useMemo(() => gradeDoMes(mes.ano, mes.mes), [mes]);
  const porDia = useMemo(() => itensPorDia(itens), [itens]);
  const prefixoMes = `${mes.ano}-${String(mes.mes).padStart(2, '0')}`;
  const totalNoMes = useMemo(() => itens.filter((i) => grade.some((d) => d.startsWith(prefixoMes) && porDia.get(d)?.includes(i))).length, [itens, grade, porDia, prefixoMes]);

  // Busca o mês visível inteiro (todas as páginas da API).
  useEffect(() => {
    const controle = new AbortController();
    setEstado('carregando');
    (async () => {
      const todos: Item[] = [];
      const filtro = { ...(unidade ? { unidadeId: unidade } : {}), de: grade[0], ate: grade[41] };
      for (let pagina = 0; pagina < 20; pagina++) {
        const lote: Item[] = tipo === 'eventos'
          ? await agendaServico.eventos({ ...filtro, pagina }, controle.signal)
          : await agendaServico.escalas({ ...filtro, pagina }, controle.signal);
        todos.push(...lote);
        if (lote.length < TAMANHO_PAGINA) break;
      }
      setItens(todos);
      setEstado('pronto');
    })().catch((e) => { if (!controle.signal.aborted) setEstado({ erro: mensagemDeErro(e) }); });
    return () => controle.abort();
  }, [tipo, unidade, grade, versao, tentativa]);

  function mudarMes(delta: number) {
    setMes((m) => {
      const d = new Date(m.ano, m.mes - 1 + delta, 1);
      return { ano: d.getFullYear(), mes: d.getMonth() + 1 };
    });
  }

  function irParaHoje() {
    const d = new Date();
    setMes({ ano: d.getFullYear(), mes: d.getMonth() + 1 });
    setDiaEscolhido(hoje());
  }

  // Setas do teclado movem o dia escolhido (troca de mês ao passar da borda).
  function aoTeclar(e: React.KeyboardEvent, dia: string) {
    const passos: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (!(e.key in passos)) return;
    e.preventDefault();
    const d = new Date(`${dia}T12:00:00`);
    d.setDate(d.getDate() + passos[e.key]);
    const novo = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    setDiaEscolhido(novo);
    if (!novo.startsWith(prefixoMes)) setMes({ ano: d.getFullYear(), mes: d.getMonth() + 1 });
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-dia="${novo}"]`)?.focus());
  }

  const doDia = porDia.get(diaEscolhido) ?? [];
  const nome = tipo === 'eventos' ? ['evento', 'eventos'] : ['escala', 'escalas'];
  const rotuloDia = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${diaEscolhido}T12:00:00`));

  return (
    <pf-calendario-agenda>
      <div className="cal">
        <section className="pf-card cal__mes" aria-label={`Calendário de ${MESES[mes.mes - 1]} de ${mes.ano}`}>
          <header className="cal__topo">
            <div>
              <h2 className="cal__titulo" aria-live="polite">{MESES[mes.mes - 1]} <span>{mes.ano}</span></h2>
              <p className="cal__resumo">{estado === 'carregando' ? 'Carregando…' : `${totalNoMes} ${totalNoMes === 1 ? nome[0] : nome[1]} no mês`}</p>
            </div>
            <div className="cal__nav">
              <button type="button" className="pf-btn pf-btn--ghost pf-btn--sm" onClick={irParaHoje}>Hoje</button>
              <button type="button" className="pf-btn pf-btn--ghost pf-btn--icon" aria-label="Mês anterior" onClick={() => mudarMes(-1)}><Icone nome="voltar" tamanho={17} /></button>
              <button type="button" className="pf-btn pf-btn--ghost pf-btn--icon" aria-label="Próximo mês" onClick={() => mudarMes(1)}><Icone nome="avancar" tamanho={17} /></button>
            </div>
          </header>

          {typeof estado === 'object' && (
            <p className="pf-error cal__erro" role="alert">{estado.erro} <button type="button" className="pf-link-btn" onClick={() => setTentativa((t) => t + 1)}>Tentar novamente</button></p>
          )}

          <div className="cal__semana" aria-hidden="true">{SEMANA.map((d) => <span key={d}>{d}</span>)}</div>
          <div className={`cal__grade${estado === 'carregando' ? ' cal__grade--carregando' : ''}`} role="grid" aria-label="Dias do mês">
            {Array.from({ length: 6 }, (_, semana) => (
              <div key={semana} role="row" className="cal__linha">
                {grade.slice(semana * 7, semana * 7 + 7).map((dia) => {
                  const lista = porDia.get(dia) ?? [];
                  const foraDoMes = !dia.startsWith(prefixoMes);
                  const qtd = lista.length;
                  return (
                    <div key={dia} role="gridcell" aria-selected={dia === diaEscolhido}>
                      <button type="button" data-dia={dia} tabIndex={dia === diaEscolhido ? 0 : -1}
                        className={`dia${foraDoMes ? ' dia--fora' : ''}${dia === hoje() ? ' dia--hoje' : ''}${dia === diaEscolhido ? ' dia--escolhido' : ''}${qtd ? ' dia--com' : ''}`}
                        aria-label={`${new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long' }).format(new Date(`${dia}T12:00:00`))}: ${qtd ? `${qtd} ${qtd === 1 ? nome[0] : nome[1]}` : `nenhum ${nome[0] === 'evento' ? 'evento' : 'registro'}`}`}
                        onClick={() => { setDiaEscolhido(dia); if (foraDoMes) setMes({ ano: +dia.slice(0, 4), mes: +dia.slice(5, 7) }); }}
                        onKeyDown={(e) => aoTeclar(e, dia)}>
                        <span className="dia__topo">
                          <span className="dia__numero">{+dia.slice(8)}</span>
                          {qtd > 0 && <span className="dia__contador" aria-hidden="true">{qtd}</span>}
                        </span>
                        {!isMobile && (
                          <span className="dia__itens" aria-hidden="true">
                            {lista.slice(0, 2).map((item) => (
                              <span key={`${item.id}`} className={`dia__item dia__item--${item.situacao.toLowerCase()}`}>{tituloDe(item)}</span>
                            ))}
                            {qtd > 2 && <span className="dia__mais">+{qtd - 2} mais</span>}
                          </span>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </section>

        <aside className="pf-card cal__dia" aria-live="polite" aria-label={`Agenda de ${rotuloDia}`}>
          <header className="cal__dia-topo">
            <div>
              <p className="cal__dia-rotulo">{rotuloDia.charAt(0).toUpperCase() + rotuloDia.slice(1)}</p>
              <p className="cal__resumo">{doDia.length ? `${doDia.length} ${doDia.length === 1 ? nome[0] : nome[1]}` : `Nada marcado`}</p>
            </div>
            <button type="button" className="pf-btn pf-btn--primary pf-btn--sm" onClick={() => aoCriarNoDia(diaEscolhido)}>
              <Icone nome="plus" tamanho={15} />{tipo === 'eventos' ? 'Evento' : 'Escala'} neste dia
            </button>
          </header>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.ul key={diaEscolhido} className="cal__lista" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={TRANSICAO.base}>
              {doDia.map((item) => (
                <li key={item.id}>
                  <button type="button" className={`cal__item cal__item--${item.situacao.toLowerCase()}`} onClick={() => aoAbrir(item)}>
                    <span className="cal__item-hora">{item.inicio.slice(0, 10) === diaEscolhido ? hora(item.inicio) : 'contínuo'}</span>
                    <span className="cal__item-textos">
                      <strong>{tituloDe(item)}</strong>
                      <span>{item.unidadeId === null ? '—' : nomeUnidade(unidades, item.unidadeId)} · {rotuloSituacao(item)}</span>
                      <span className="cal__item-periodo">{dataHora(item.inicio, 'dd/MM HH:mm')} → {dataHora(item.fim, 'dd/MM HH:mm')}</span>
                    </span>
                    <Icone nome="avancar" tamanho={16} />
                  </button>
                </li>
              ))}
              {!doDia.length && estado === 'pronto' && (
                <li className="cal__vazio">Nenhum{tipo === 'eventos' ? ' evento' : 'a escala'} neste dia.</li>
              )}
            </motion.ul>
          </AnimatePresence>
        </aside>
      </div>
    </pf-calendario-agenda>
  );
}
