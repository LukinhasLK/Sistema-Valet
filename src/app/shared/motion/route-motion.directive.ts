import { Directive, ElementRef, Injector, NgZone, OnDestroy, afterNextRender, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { entrada } from './motion';

@Directive({ selector: 'router-outlet[pfRouteMotion]', standalone: true })
export class RouteMotionDirective implements OnDestroy {
  private readonly zone = inject(NgZone);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly outlet = inject(RouterOutlet);
  private readonly injector = inject(Injector);
  private cancelar?: () => void;

  constructor() {
    this.outlet.activateEvents.pipe(takeUntilDestroyed()).subscribe(() => {
      this.cancelar?.();
      const render = afterNextRender(() => {
        const pagina = this.host.nativeElement.nextElementSibling;
        if (!(pagina instanceof HTMLElement)) return;
        const cabecalho = pagina.querySelector<HTMLElement>('h1');
        const indicadores = [...pagina.querySelectorAll<HTMLElement>('.pf-grid-kpi:not(.kpis) > pf-kpi-card')].slice(0, 3);
        const alvos = [...(cabecalho ? [cabecalho] : []), ...indicadores];
        if (alvos.length) this.cancelar = this.zone.runOutsideAngular(() => entrada(alvos, 6, true));
      }, { injector: this.injector });
      this.cancelar = () => render.destroy();
    });
  }

  ngOnDestroy(): void {
    this.cancelar?.();
  }
}
