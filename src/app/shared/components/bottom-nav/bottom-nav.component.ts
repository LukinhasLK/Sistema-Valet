import { A11yModule } from '@angular/cdk/a11y';
import { ChangeDetectionStrategy, Component, inject, signal, computed } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { BOTTOM_NAV_ITEMS, itensPermitidos, NAV_ITEMS, PERFIL_ITEM } from '../../nav-items';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'pf-bottom-nav',
  standalone: true,
  imports: [A11yModule, RouterLink, RouterLinkActive, IconComponent],
  host: { '(document:keydown.escape)': 'fecharMais()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './bottom-nav.component.html',
  styleUrl: './bottom-nav.component.scss',
})
export class BottomNavComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly itens = computed(() => itensPermitidos(BOTTOM_NAV_ITEMS, this.auth.nivel()));
  protected readonly maisItens = computed(() => [
    ...itensPermitidos(NAV_ITEMS, this.auth.nivel()).filter((item) =>
      item.rota !== '/app/notificacoes' && !this.itens().some((b) => b.rota === item.rota)),
    PERFIL_ITEM,
  ]);
  protected readonly maisAberto = signal(false);

  protected alternarMais(): void {
    this.maisAberto.update((aberto) => !aberto);
  }

  protected fecharMais(): void {
    this.maisAberto.set(false);
  }

  protected sair(): void {
    this.fecharMais();
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
