import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { NotificacoesService } from '../../../core/services/notificacoes.service';
import { AuthService } from '../../../core/services/auth.service';
import { corDoAvatar, itensPermitidos, NAV_ITEMS } from '../../nav-items';
import { IconComponent } from '../icon/icon.component';
import { LogoComponent } from '../logo/logo.component';

@Component({
  selector: 'pf-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, IconComponent, LogoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
})
export class SidebarComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly itens = computed(() => itensPermitidos(NAV_ITEMS, this.auth.nivel()));
  protected readonly usuario = this.auth.usuario;
  protected readonly inicial = this.auth.inicial;
  protected readonly naoLidas = inject(NotificacoesService).total;

  protected cor(nome: string): string {
    return corDoAvatar(nome);
  }

  protected sair(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
