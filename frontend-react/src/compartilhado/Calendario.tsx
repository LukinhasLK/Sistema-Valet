import { ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { hojeIso, MESES } from '../nucleo/servicos/periodo';
import './calendario.scss';

const SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const FORMATO = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full' });

/** Troca o valor de um input controlado pelo React e dispara os eventos que ele escuta. */
function definirValor(campo: HTMLInputElement, valor: string): void {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(campo, valor);
  campo.dispatchEvent(new Event('input', { bubbles: true }));
  campo.dispatchEvent(new Event('change', { bubbles: true }));
  campo.dispatchEvent(new FocusEvent('blur'));
}

/** Calendário acessível ao lado de um `<input type="date">` (passado como filho). */
export function Calendario({ children }: { children: ReactNode }) {
  const host = useRef<HTMLElement>(null);
  const painel = useRef<HTMLDivElement>(null);
  const gatilho = useRef<HTMLButtonElement>(null);
  const [aberto, setAberto] = useState(false);
  const [selecionada, setSelecionada] = useState('');
  const [hoje, setHoje] = useState(hojeIso());
  const [mes, setMes] = useState(() => new Date());
  const [foco, setFoco] = useState(1);
  const [rotulo, setRotulo] = useState('data');
  const focarDepois = useRef(false);

  const campo = () => host.current!.querySelector('input')!;
  const data = (dia: number, deslocamento = 0) => new Date(mes.getFullYear(), mes.getMonth() + deslocamento, dia, 12);
  const iso = (dia: number) => hojeIso(data(dia));
  const permitida = (valor: string) => {
    const c = campo();
    return (!c.min || valor >= c.min) && (!c.max || valor <= c.max);
  };
  const limitar = (valor: string) => {
    const c = campo();
    if (c.min && valor < c.min) return c.min;
    if (c.max && valor > c.max) return c.max;
    return valor;
  };

  // Sem dependências de propósito: o rótulo do campo pode mudar; valores iguais não re-renderizam.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    setRotulo(campo()?.labels?.[0]?.textContent?.trim() || 'data');
  });

  const reposicionar = useCallback(() => {
    const p = painel.current;
    const c = host.current?.querySelector('input');
    if (!p || !c || !p.matches(':popover-open')) return;
    const caixa = c.getBoundingClientRect();
    p.style.left = Math.max(8, Math.min(caixa.left, innerWidth - p.offsetWidth - 8)) + 'px';
    const abaixo = caixa.bottom + 4;
    p.style.top = Math.max(8, abaixo + p.offsetHeight <= innerHeight - 8 ? abaixo : caixa.top - p.offsetHeight - 4) + 'px';
  }, []);

  useEffect(() => {
    const p = painel.current!;
    const sincronizar = () => setAberto(p.matches(':popover-open'));
    p.addEventListener('toggle', sincronizar);
    window.addEventListener('resize', reposicionar);
    document.addEventListener('scroll', reposicionar, true);
    return () => {
      p.removeEventListener('toggle', sincronizar);
      window.removeEventListener('resize', reposicionar);
      document.removeEventListener('scroll', reposicionar, true);
    };
  }, [reposicionar]);

  // Depois de mudar o mês/dia em foco: reposiciona e foca o dia.
  useLayoutEffect(() => {
    if (!focarDepois.current) return;
    focarDepois.current = false;
    reposicionar();
    painel.current?.querySelector<HTMLButtonElement>(`[data-dia="${foco}"]`)?.focus({ preventScroll: true });
  }, [mes, foco, reposicionar]);

  function ir(valor: string) {
    const d = new Date(valor + 'T12:00:00');
    focarDepois.current = true;
    setMes(d);
    setFoco(d.getDate());
  }

  function fechar() {
    painel.current?.hidePopover();
    setAberto(false);
    gatilho.current?.focus();
  }

  function alternar() {
    const c = campo();
    if (c.matches(':disabled')) return;
    if (painel.current!.matches(':popover-open')) {
      fechar();
      return;
    }
    const agora = hojeIso();
    setHoje(agora);
    setSelecionada(c.value);
    painel.current!.showPopover();
    setAberto(true);
    ir(limitar(c.value || agora));
  }

  const permiteMes = (delta: number) => {
    const c = host.current?.querySelector('input');
    if (!c) return true;
    return delta < 0 ? !c.min || hojeIso(data(0)) >= c.min : !c.max || hojeIso(data(1, 1)) <= c.max;
  };

  function navegar(evento: React.KeyboardEvent, dia: number) {
    const movimentos: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (evento.key in movimentos) {
      evento.preventDefault();
      ir(limitar(iso(dia + movimentos[evento.key])));
    }
  }

  function escolher(valor: string) {
    const c = campo();
    if (c.matches(':disabled') || (valor && !permitida(valor))) return;
    definirValor(c, valor);
    fechar();
  }

  const espacos = Array.from({ length: data(1).getDay() }, (_, i) => i);
  const dias = Array.from({ length: data(0, 1).getDate() }, (_, i) => i + 1);
  const obrigatorio = host.current?.querySelector('input')?.required ?? false;

  return (
    <pf-calendario ref={host}>
      {children}
      <button ref={gatilho} type="button" className="gatilho" aria-label={`Abrir calendário de ${rotulo}`}
        aria-haspopup="dialog" aria-expanded={aberto} onClick={alternar}>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
          <rect x="3" y="5" width="18" height="16" rx="3" /><path d="M7 3v5m10-5v5M3 11h18" />
        </svg>
      </button>
      <div ref={painel} {...{ popover: 'auto' }} className="painel" role="dialog" aria-label={`Calendário de ${rotulo}`}
        onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); fechar(); } }}>
        <div className="cabecalho">
          <button type="button" aria-label="Mês anterior" disabled={!permiteMes(-1)} onClick={() => ir(limitar(hojeIso(data(1, -1))))}>‹</button>
          <span aria-live="polite">{MESES[mes.getMonth()]} de {mes.getFullYear()}</span>
          <button type="button" aria-label="Próximo mês" disabled={!permiteMes(1)} onClick={() => ir(limitar(hojeIso(data(1, 1))))}>›</button>
        </div>
        <div className="grade">
          {SEMANA.map((dia) => <span key={dia} className="semana" aria-hidden="true">{dia}</span>)}
          {espacos.map((vazio) => <span key={`v${vazio}`} />)}
          {aberto && dias.map((dia) => (
            <button key={dia} type="button" data-dia={dia} aria-label={FORMATO.format(data(dia))}
              aria-pressed={iso(dia) === selecionada} aria-current={iso(dia) === hoje ? 'date' : undefined}
              tabIndex={dia === foco ? 0 : -1} disabled={!permitida(iso(dia))}
              onKeyDown={(e) => navegar(e, dia)} onClick={() => escolher(iso(dia))}>{dia}</button>
          ))}
        </div>
        <div className="rodape">
          {!obrigatorio && <button type="button" onClick={() => escolher('')}>Limpar</button>}
          <button type="button" disabled={aberto && !permitida(hoje)} onClick={() => escolher(hoje)}>Hoje</button>
        </div>
      </div>
    </pf-calendario>
  );
}
