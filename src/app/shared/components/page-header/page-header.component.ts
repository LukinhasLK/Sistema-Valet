import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'pf-page-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="head">
      <div class="head__text">
        <h1 class="head__title">{{ title() }}</h1>
        @if (subtitle()) {
          <p class="head__subtitle">{{ subtitle() }}</p>
        }
      </div>
      <div class="head__actions">
        <ng-content />
      </div>
    </header>
  `,
  styles: [`
    .head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 22px;
    }
    .head__title {
      font-size: 24px;
      font-weight: 700;
      letter-spacing: -.02em;
      color: var(--pf-text);
    }
    .head__subtitle {
      font-size: 13px;
      color: var(--pf-text-muted);
      margin-top: 3px;
    }
    .head__actions { display: flex; flex-wrap: wrap; gap: 10px; max-width: 100%; }

    @media (max-width: 767px) {
      .head { flex-wrap: wrap; gap: 10px; margin-bottom: 16px; }
      .head__title { font-size: 20px; }
      .head__subtitle { font-size: 12px; }
    }
  `],
})
export class PageHeaderComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string>('');
}
