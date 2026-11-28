import { paginar, PaginacaoComponent } from '../../shared/components/paginacao/paginacao';
import { PixManobristaComponent } from '../pagamentos-manobristas/pix-manobrista.component';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Manobrista } from '../../core/models';
import { FichasService } from '../../core/services/fichas.service';
import { LayoutService } from '../../core/services/layout.service';
import { ManobristasService } from '../../core/services/manobristas.service';
import { AuthService } from '../../core/services/auth.service';
import { MESES, rotuloPeriodo } from '../../core/services/periodo';
import { podeAcessar } from '../../core/services/permissoes';
import { cpfValido, MascaraDirective, telefoneValido } from '../../shared/directives/mascara.directive';
import { corDoAvatar } from '../../shared/nav-items';
import { ConfirmComponent } from '../../shared/components/confirm/confirm.component';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { ModalComponent } from '../../shared/components/modal/modal.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { CurrencyBrPipe } from '../../shared/pipes/currency-br.pipe';
import type { TipoPix } from '../../core/services/pagamentos-manobristas.service';
import { AvisoService } from '../../core/services/aviso.service';

interface LinhaManobrista extends Manobrista {
  diasNoMes: number;
  custoDiarias: number;
  inicial: string;
  cor: string;
}

@Component({
  selector: 'pf-manobristas',
  standalone: true,
  imports: [PaginacaoComponent, PixManobristaComponent, RouterLink, FormsModule, ReactiveFormsModule, MascaraDirective, PageHeaderComponent, IconComponent, ModalComponent, ConfirmComponent, CurrencyBrPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './manobristas.component.html',
  styleUrl: './manobristas.component.scss',
})
export class ManobristasComponent {
  private readonly manobristasService = inject(ManobristasService);
  private readonly aviso = inject(AvisoService);
  private readonly fichasService = inject(FichasService);
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);

  protected readonly isMobile = inject(LayoutService).isMobile;
  protected readonly meses = MESES;
  protected readonly anos = this.fichasService.anosDisponiveis;
  protected readonly mes = signal(this.fichasService.periodoReferencia().mes);
  protected readonly ano = signal(this.fichasService.periodoReferencia().ano);
  protected readonly periodo = computed(() => rotuloPeriodo(this.mes(), this.ano()));
  protected readonly podeVerPagamentos = computed(() => podeAcessar(this.auth.nivel(), 'pagamentos-manobristas'));
  protected readonly podeGerenciar = computed(() => this.auth.nivel() === 'Proprietário');

  /** Dias e diárias vêm das fichas do período escolhido; o cadastro só guarda dados pessoais. */
  protected readonly linhas = computed<LinhaManobrista[]>(() => {
    const lancamentos = this.fichasService.diariasPorManobrista(this.mes(), this.ano());

    return this.manobristasService.manobristas().map((m) => {
      const doMes = lancamentos.get(m.id);
      return {
        ...m,
        diasNoMes: doMes?.dias ?? 0,
        custoDiarias: doMes?.total ?? 0,
        inicial: m.nome.charAt(0).toUpperCase(),
        cor: corDoAvatar(m.nome),
      };
    });
  });
  protected readonly paginacao = paginar(this.linhas);

  protected readonly formAberto = signal(false);
  protected readonly editando = signal<Manobrista | null>(null);
  protected readonly paraDesativar = signal<Manobrista | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    nome: ['', Validators.required],
    telefone: ['', telefoneValido],
    cpf: ['', cpfValido],
    tipoPix: ['CPF' as TipoPix],
    chavePix: [''],
    ativo: [true],
    observacoes: ['', Validators.maxLength(500)],
  });

  protected abrir(manobrista?: Manobrista): void {
    this.editando.set(manobrista ?? null);
    this.form.reset({
      nome: manobrista?.nome ?? '',
      telefone: manobrista?.telefone ?? '',
      cpf: manobrista?.cpf ?? '',
      ativo: manobrista?.ativo ?? true,
      observacoes: manobrista?.observacoes ?? '',
    });
    this.formAberto.set(true);
  }

  protected async salvar(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const atual = this.editando();

    try {
      const { tipoPix, chavePix, ...cadastro } = this.form.getRawValue();
      await this.manobristasService.salvarManobrista({
        ...cadastro,
        pix: this.podeGerenciar() && !atual && chavePix.trim() ? { tipo: tipoPix, chave: chavePix.trim() } : undefined,
        id: atual?.id,
      });
      this.formAberto.set(false);
      this.aviso.sucesso('Manobrista salvo.');
    } catch (erro) {
      this.aviso.erro(erro);
    }
  }

  protected async confirmarDesativacao(): Promise<void> {
    const manobrista = this.paraDesativar();
    this.paraDesativar.set(null);
    if (!manobrista) return;
    try {
      await this.manobristasService.desativar(manobrista.id);
      this.aviso.sucesso('Manobrista desativado.');
    } catch (erro) {
      this.aviso.erro(erro);
    }
  }

  protected invalido(nome: string): boolean {
    const campo = this.form.get(nome);
    return !!campo && campo.invalid && campo.touched;
  }
}
