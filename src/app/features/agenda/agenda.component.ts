import { DatePipe } from '@angular/common';
import { FinanceiroEventoComponent } from './financeiro-evento.component';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { EMPTY, Observable, catchError, distinctUntilChanged, firstValueFrom, map, of, startWith, switchMap } from 'rxjs';
import { AgendaService, AlteracaoEscala, Escala, Evento, FiltroAgenda, SituacaoEscala, SituacaoEvento } from '../../core/services/agenda.service';
import { AvisoService } from '../../core/services/aviso.service';
import { mensagemDeErro } from '../../core/services/api';
import { ManobristasService } from '../../core/services/manobristas.service';
import { UnidadesService } from '../../core/services/unidades.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { ModalComponent } from '../../shared/components/modal/modal.component';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { CurrencyBrPipe } from '../../shared/pipes/currency-br.pipe';

type Lista<T> = { carregando: boolean; itens: T[]; erro: string };
const carregando = { carregando: true, itens: [], erro: '' };

@Component({
  selector: 'pf-agenda',
  imports: [FinanceiroEventoComponent, DatePipe, FormsModule, PageHeaderComponent, ModalComponent, IconComponent, CurrencyBrPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './agenda.component.html',
  styles: [`
    .lista-agenda { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(290px, 100%), 1fr)); gap: 14px; }
    .agenda-item, .agenda-estado { padding: 16px; }
    .agenda-item { display: grid; gap: 12px; align-content: start; overflow-wrap: anywhere; }
    .agenda-item p { color: var(--pf-text-muted); }
    .papeis { display: grid; gap: 6px; padding: 10px; border: 1px solid var(--pf-border); border-radius: 8px; min-width: 0; }
    .papeis label { display: flex; align-items: center; gap: 8px; min-height: 32px; }
    .grade { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(195px, 100%), 1fr)); gap: 12px; }
    form, .historico { display: grid; gap: 14px; }
    footer { display: flex; gap: 8px; flex-wrap: wrap; justify-content: end; }
    .secundario { color: var(--pf-text-muted); font-size: 13px; }
  `],
})
export class AgendaComponent {
  private readonly rota = inject(ActivatedRoute);
  protected readonly tipo: 'eventos' | 'escalas' = this.rota.snapshot.data['tipo'];
  private readonly aviso = inject(AvisoService);
  private readonly api = inject(AgendaService);
  private readonly unidadesService = inject(UnidadesService);
  private readonly manobristasService = inject(ManobristasService);
  protected readonly unidades = this.unidadesService.unidades;
  protected readonly manobristas = this.manobristasService.manobristas;
  protected readonly statusEvento: SituacaoEvento[] = ['PLANEJADO', 'CONFIRMADO', 'REALIZADO', 'CANCELADO'];
  protected readonly statusEscala: SituacaoEscala[] = ['PLANEJADA', 'CONFIRMADA', 'REALIZADA', 'CANCELADA'];
  protected readonly rotulos: Record<SituacaoEvento | SituacaoEscala, string> = {
    PLANEJADO: 'Planejado', CONFIRMADO: 'Confirmado', REALIZADO: 'Realizado', CANCELADO: 'Cancelado',
    PLANEJADA: 'Planejada', CONFIRMADA: 'Confirmada', REALIZADA: 'Realizada', CANCELADA: 'Cancelada',
  };

  protected readonly unidade = signal<number | null>(null);
  protected readonly de = signal('');
  protected readonly ate = signal('');
  protected readonly pagina = signal(0);
  protected readonly eventoEditado = signal<Evento | null>(null);
  protected readonly escalaEditada = signal<Escala | null>(null);
  protected readonly salvando = signal(false);
  protected readonly erroForm = signal('');
  protected readonly historico = signal<AlteracaoEscala[] | null>(null);
  protected readonly carregandoHistorico = signal(false);
  protected readonly erroHistorico = signal('');
  protected readonly eventosDaUnidade = signal<Evento[]>([]);
  protected readonly consultandoEventos = signal(false);
  protected readonly erroEventos = signal('');
  private readonly versao = signal(0);

  private readonly consulta = computed(() => {
    this.versao();
    const unidadeId = this.unidade();
    return {
      ...(unidadeId ? { unidadeId } : {}), ...(this.de() ? { de: this.de() } : {}),
      ...(this.ate() ? { ate: this.ate() } : {}), pagina: this.pagina(),
    };
  });

  protected readonly eventos = toSignal(toObservable(this.consulta).pipe(
    switchMap((filtro) => this.tipo !== 'eventos' ? of<Lista<Evento>>(carregando) : this.api.eventos(filtro).pipe(
      map((itens) => ({ carregando: false, itens, erro: '' })),
      catchError((erro) => of({ carregando: false, itens: [], erro: mensagemDeErro(erro) })),
      startWith(carregando),
    ))
  ), { initialValue: carregando as Lista<Evento> });

  protected readonly escalas = toSignal(toObservable(this.consulta).pipe(
    switchMap((filtro) => this.tipo !== 'escalas' ? of<Lista<Escala>>(carregando) : this.api.escalas(filtro).pipe(
      map((itens) => ({ carregando: false, itens, erro: '' })),
      catchError((erro) => of({ carregando: false, itens: [], erro: mensagemDeErro(erro) })),
      startWith(carregando),
    ))
  ), { initialValue: carregando as Lista<Escala> });

  constructor() {
    this.rota.queryParamMap.pipe(
      map((p) => Number(p.get('detalhe'))),
      distinctUntilChanged(),
      switchMap((id) => {
        if (!Number.isSafeInteger(id) || id <= 0) return EMPTY;
        const pedido: Observable<Evento | Escala> = this.tipo === 'eventos' ? this.api.evento(id) : this.api.escala(id);
        return pedido.pipe(
          catchError((erro) => { this.aviso.erro(erro); return EMPTY; }),
        );
      }),
      takeUntilDestroyed(),
    ).subscribe((item) => {
      if ('manobristaIds' in item) this.abrirEscala(item);
      else this.abrirEvento(item);
    });
  }

  protected nomeUnidade(id: number | null): string {
    return id === null ? '—' : this.unidadesService.nome(id);
  }

  protected equipes(ids: number[]): string {
    return ids.map((id) => this.manobristasService.nome(id)).join(', ');
  }

  protected filtrar(unidade: number | null, de: string, ate: string): void {
    this.unidade.set(unidade);
    this.de.set(de);
    this.ate.set(ate);
    this.pagina.set(0);
  }

  protected recarregar(): void {
    this.versao.update((n) => n + 1);
  }

  protected abrirEvento(valor?: Evento): void {
    this.erroForm.set('');
    this.eventoEditado.set(valor ? { ...valor, inicio: valor.inicio.slice(0, 16), fim: valor.fim.slice(0, 16) } : {
      unidadeId: this.unidadeInicial(), inicio: '', fim: '', nome: '', contratante: '', local: '', responsavel: '',
      situacao: 'PLANEJADO', veiculosPrevistos: 0, capacidade: 0, equipePrevista: 0,
      valorContratado: null, despesasPrevistas: null, observacoes: '',
    });
  }

  protected abrirEscala(valor?: Escala): void {
    this.erroForm.set('');
    this.historico.set(null);
    this.erroHistorico.set('');
    const escala: Escala = valor ? { ...valor, inicio: valor.inicio.slice(0, 16), fim: valor.fim.slice(0, 16) } : {
      unidadeId: this.unidadeInicial(), eventoId: null, inicio: '', fim: '', responsavel: '', situacao: 'PLANEJADA',
      observacoes: '', manobristaIds: [],
    };
    this.escalaEditada.set(escala);
    void this.buscarEventos(escala);
  }

  protected atualizarEquipe(escala: Escala, id: number, marcado: boolean): void {
    escala.manobristaIds = marcado ? [...escala.manobristaIds, id] : escala.manobristaIds.filter((m) => m !== id);
  }

  protected async buscarEventos(escala: Escala, novaUnidade?: number | null): Promise<void> {
    if (novaUnidade !== undefined) {
      escala.unidadeId = novaUnidade;
      escala.eventoId = null;
    }
    const unidadeId = escala.unidadeId;
    this.eventosDaUnidade.set([]);
    this.erroEventos.set('');
    if (!unidadeId) {
      this.consultandoEventos.set(false);
      return;
    }
    this.consultandoEventos.set(true);
    try {
      const filtro: FiltroAgenda = { unidadeId };
      const eventos = await firstValueFrom(this.api.eventos(filtro));
      if (this.escalaEditada() === escala && unidadeId === escala.unidadeId) {
        this.eventosDaUnidade.set(eventos.filter((e) => e.id === escala.eventoId || e.situacao !== 'CANCELADO'));
      }
    } catch (erro) {
      if (this.escalaEditada() === escala && unidadeId === escala.unidadeId) this.erroEventos.set(mensagemDeErro(erro));
    } finally {
      if (this.escalaEditada() === escala && unidadeId === escala.unidadeId) this.consultandoEventos.set(false);
    }
  }

  protected async verHistorico(id: number): Promise<void> {
    if (this.carregandoHistorico()) return;
    this.carregandoHistorico.set(true);
    this.erroHistorico.set('');
    try {
      const registros = await this.api.historico(id);
      if (this.escalaEditada()?.id === id) this.historico.set(registros);
    } catch (erro) {
      if (this.escalaEditada()?.id === id) this.erroHistorico.set(mensagemDeErro(erro));
    } finally {
      this.carregandoHistorico.set(false);
    }
  }

  protected async salvar(valor: Evento | Escala): Promise<void> {
    if (this.salvando()) return;
    this.erroForm.set('');
    if (!valor.inicio || !valor.fim || valor.inicio >= valor.fim) {
      this.erroForm.set('Informe um horário de término posterior ao início.');
      return;
    }
    if ('manobristaIds' in valor && !valor.manobristaIds.length) {
      this.erroForm.set('Selecione pelo menos um profissional.');
      return;
    }
    this.salvando.set(true);
    try {
      if ('manobristaIds' in valor) {
        await this.api.salvarEscala(valor);
        this.escalaEditada.set(null);
        this.aviso.sucesso('Escala salva.');
      } else {
        await this.api.salvarEvento(valor);
        this.eventoEditado.set(null);
        this.aviso.sucesso('Evento salvo.');
      }
      this.recarregar();
    } catch (erro) {
      this.erroForm.set(mensagemDeErro(erro));
    } finally {
      this.salvando.set(false);
    }
  }

  private unidadeInicial(): number | null {
    const ativas = this.unidades().filter((u) => u.ativa !== false);
    return ativas.find((u) => u.id === this.unidade())?.id ?? (ativas.length === 1 ? ativas[0].id : null);
  }
}
