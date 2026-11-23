import { BreakpointObserver } from '@angular/cdk/layout';
import { inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

/** Ponto de virada entre o layout mobile (bottom nav) e o desktop (sidebar). */
export const BREAKPOINT_DESKTOP = '(min-width: 768px)';

@Injectable({ providedIn: 'root' })
export class LayoutService {
  private readonly breakpoints = inject(BreakpointObserver);

  private readonly _isMobile = signal(!this.breakpoints.isMatched(BREAKPOINT_DESKTOP));
  readonly isMobile = this._isMobile.asReadonly();

  constructor() {
    this.breakpoints
      .observe(BREAKPOINT_DESKTOP)
      .pipe(takeUntilDestroyed())
      .subscribe((estado) => this._isMobile.set(!estado.matches));
  }
}
