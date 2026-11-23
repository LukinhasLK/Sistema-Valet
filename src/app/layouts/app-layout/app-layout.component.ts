import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouteMotionDirective } from '../../shared/motion/route-motion.directive';
import { RouterLink, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { NotificacoesService } from '../../core/services/notificacoes.service';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { LayoutService } from '../../core/services/layout.service';
import { corDoAvatar } from '../../shared/nav-items';
import { BottomNavComponent } from '../../shared/components/bottom-nav/bottom-nav.component';
import { LogoComponent } from '../../shared/components/logo/logo.component';
import { SidebarComponent } from '../../shared/components/sidebar/sidebar.component';

@Component({
  selector: 'pf-app-layout',
  standalone: true,
  imports: [RouterLink, RouterOutlet, SidebarComponent, BottomNavComponent, LogoComponent, IconComponent, RouteMotionDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app-layout.component.html',
  styleUrl: './app-layout.component.scss',
})
export class AppLayoutComponent {
  private readonly auth = inject(AuthService);
  private readonly layout = inject(LayoutService);

  protected readonly isMobile = this.layout.isMobile;
  protected readonly usuario = this.auth.usuario;
  protected readonly inicial = this.auth.inicial;
  protected readonly notificacoes = inject(NotificacoesService);

  protected cor(nome: string): string {
    return corDoAvatar(nome);
  }
}
