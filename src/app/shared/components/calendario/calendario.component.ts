import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, ViewChild, computed, inject, signal } from '@angular/core';
import { hojeIso, MESES } from '../../../core/services/periodo';

@Component({
  selector: 'pf-calendario',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-content />
    <button #gatilho type="button" class="gatilho" [attr.aria-label]="'Abrir calendário de ' + rotulo"
      aria-haspopup="dialog" [attr.aria-expanded]="aberto()" (click)="alternar()">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true">
        <rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v5m10-5v5M3 11h18"/>
      </svg>
    </button>
    <div #painel popover="auto" class="painel" role="dialog" [attr.aria-label]="'Calendário de ' + rotulo"
      (toggle)="sincronizar()" (keydown.escape)="escapar($event)">
      <div class="cabecalho">
        <button type="button" aria-label="Mês anterior" [disabled]="!permiteMes(-1)" (click)="mudarMes(-1)">‹</button>
        <span aria-live="polite">{{ meses[mes().getMonth()] }} de {{ mes().getFullYear() }}</span>
        <button type="button" aria-label="Próximo mês" [disabled]="!permiteMes(1)" (click)="mudarMes(1)">›</button>
      </div>
      <div class="grade">
        @for (dia of semana; track dia) { <span class="semana" aria-hidden="true">{{ dia }}</span> }
        @for (vazio of espacos(); track vazio) { <span></span> }
        @for (dia of dias(); track dia) {
          <button type="button" [attr.data-dia]="dia" [attr.aria-label]="descrever(dia)"
            [attr.aria-pressed]="iso(dia) === selecionada()" [attr.aria-current]="iso(dia) === hoje() ? 'date' : null"
            [attr.tabindex]="dia === foco() ? 0 : -1" [disabled]="!permitida(iso(dia))"
            (keydown)="navegar($event, dia)" (click)="escolher(iso(dia))">{{ dia }}</button>
        }
      </div>
      <div class="rodape">
        @if (!campo.required) { <button type="button" (click)="escolher('')">Limpar</button> }
        <button type="button" [disabled]="!permitida(hoje())" (click)="escolher(hoje())">Hoje</button>
      </div>
    </div>
  `,
  host: { '(window:resize)': 'reposicionar()', '(document:scroll)': 'reposicionar()' },
  styles: [`
    :host { display:block; position:relative; min-width:0; }
    button { cursor:pointer; font:inherit; color:var(--pf-text); background:transparent; border:0; border-radius:7px; }
    button:disabled { opacity:.35; cursor:default; }
    button:focus-visible { outline:2px solid var(--pf-accent-dark); outline-offset:-2px; }
    .gatilho { position:absolute; top:50%; right:4px; transform:translateY(-50%); display:grid; place-items:center; width:36px; height:36px; color:var(--pf-text-muted); }
    .painel { position:fixed; inset:auto; margin:0; width:min(290px, calc(100vw - 16px)); max-height:calc(100dvh - 16px); overflow:auto; padding:12px; background:var(--pf-surface); color:var(--pf-text); border:1px solid var(--pf-border-strong); border-radius:var(--pf-radius); box-shadow:var(--pf-shadow-lg); font:inherit; }
    .cabecalho,.rodape { display:flex; justify-content:space-between; align-items:center; font-weight:600; }
    .cabecalho button { width:34px; height:34px; font-size:22px; }
    .grade { display:grid; grid-template-columns:repeat(7,minmax(0,1fr)); gap:2px; margin:8px 0; text-align:center; }
    .semana { padding:5px 0; font-size:12px; color:var(--pf-text-muted); }
    .grade button { min-height:34px; font-size:14px; font-variant-numeric:tabular-nums; }
    button:hover:not(:disabled) { background:var(--pf-surface-alt); }
    .grade button[aria-current=date] { box-shadow:inset 0 0 0 1px var(--pf-accent-dark); }
    .grade button[aria-pressed=true] { background:var(--pf-accent-soft); font-weight:700; }
    .rodape { border-top:1px solid var(--pf-border); padding-top:6px; }
    .rodape button { padding:6px 8px; }
    .rodape button:last-child { margin-left:auto; }
  `],
})
export class CalendarioComponent {
  private readonly detector = inject(ChangeDetectorRef);
  private readonly host = inject(ElementRef<HTMLElement>);
  @ViewChild('painel', { static: true }) private painel!: ElementRef<HTMLElement>;
  @ViewChild('gatilho', { static: true }) private gatilho!: ElementRef<HTMLButtonElement>;
  readonly meses = MESES;
  readonly semana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  readonly aberto = signal(false);
  readonly selecionada = signal('');
  readonly hoje = signal(hojeIso());
  readonly mes = signal(new Date());
  readonly foco = signal(1);
  readonly espacos = computed(() => Array.from({length: this.data(1).getDay()}, (_, i) => i));
  readonly dias = computed(() => Array.from({length: this.data(0, 1).getDate()}, (_, i) => i + 1));
  private readonly formato = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full' });

  get campo(): HTMLInputElement { return this.host.nativeElement.querySelector('input')!; }
  get rotulo(): string { return this.campo?.labels?.[0]?.textContent?.trim() || 'data'; }

  private data(dia: number, deslocamento = 0): Date {
    return new Date(this.mes().getFullYear(), this.mes().getMonth() + deslocamento, dia, 12);
  }

  iso(dia: number): string { return hojeIso(this.data(dia)); }
  descrever(dia: number): string { return this.formato.format(this.data(dia)); }
  permitida(iso: string): boolean {
    return (!this.campo.min || iso >= this.campo.min) && (!this.campo.max || iso <= this.campo.max);
  }
  private limitar(iso: string): string {
    if (this.campo.min && iso < this.campo.min) return this.campo.min;
    if (this.campo.max && iso > this.campo.max) return this.campo.max;
    return iso;
  }
  alternar(): void {
    const campo = this.campo;
    if (campo.matches(':disabled')) return;
    if (this.painel.nativeElement.matches(':popover-open')) { this.fechar(); return; }
    this.hoje.set(hojeIso());
    this.selecionada.set(campo.value);
    this.painel.nativeElement.showPopover();
    this.aberto.set(true);
    this.ir(this.limitar(campo.value || this.hoje()));
  }
  sincronizar(): void { this.aberto.set(this.painel.nativeElement.matches(':popover-open')); }
  reposicionar(): void {
    if (!this.aberto()) return;
    const painel = this.painel.nativeElement;
    const caixa = this.campo.getBoundingClientRect();
    painel.style.left = Math.max(8, Math.min(caixa.left, innerWidth - painel.offsetWidth - 8)) + 'px';
    const abaixo = caixa.bottom + 4;
    painel.style.top = Math.max(8, abaixo + painel.offsetHeight <= innerHeight - 8 ? abaixo : caixa.top - painel.offsetHeight - 4) + 'px';
  }
  permiteMes(delta: number): boolean {
    return delta < 0 ? !this.campo.min || hojeIso(this.data(0)) >= this.campo.min
      : !this.campo.max || hojeIso(this.data(1, 1)) <= this.campo.max;
  }
  mudarMes(delta: number): void { this.ir(this.limitar(hojeIso(this.data(1, delta)))); }
  private ir(iso: string): void {
    const data = new Date(iso + 'T12:00:00');
    this.mes.set(data);
    this.foco.set(data.getDate());
    this.detector.detectChanges();
    this.reposicionar();
    this.painel.nativeElement.querySelector<HTMLButtonElement>('[data-dia="' + this.foco() + '"]')?.focus({ preventScroll: true });
  }
  navegar(evento: KeyboardEvent, dia: number): void {
    const movimentos: Record<string, number> = { ArrowLeft:-1, ArrowRight:1, ArrowUp:-7, ArrowDown:7 };
    if (evento.key in movimentos) {
      evento.preventDefault();
      this.ir(this.limitar(this.iso(dia + movimentos[evento.key])));
    }
  }
  escapar(evento: Event): void { evento.preventDefault(); evento.stopPropagation(); this.fechar(); }
  escolher(iso: string): void {
    if (this.campo.matches(':disabled') || (iso && !this.permitida(iso))) return;
    this.campo.value = iso;
    this.campo.dispatchEvent(new Event('input', { bubbles:true }));
    this.campo.dispatchEvent(new Event('change', { bubbles:true }));
    this.campo.dispatchEvent(new Event('blur'));
    this.fechar();
  }
  private fechar(): void {
    this.painel.nativeElement.hidePopover();
    this.aberto.set(false);
    this.gatilho.nativeElement.focus();
  }
}
