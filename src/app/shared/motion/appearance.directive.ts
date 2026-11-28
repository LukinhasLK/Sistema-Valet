import { Directive, ElementRef, NgZone, OnDestroy, afterNextRender, inject, input } from '@angular/core';
import { entrada } from './motion';

@Directive({ selector: '[pfAppear]', standalone: true })
export class AppearanceDirective implements OnDestroy {
  readonly deslocamento = input(4, { alias: 'pfAppear' });
  private readonly zone = inject(NgZone);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private cancelar?: () => void;
  private readonly render = afterNextRender(() => {
    this.cancelar = this.zone.runOutsideAngular(() => entrada([this.host.nativeElement], this.deslocamento()));
  });

  ngOnDestroy(): void {
    this.render.destroy();
    this.cancelar?.();
  }
}
