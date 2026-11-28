import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'pf-kpi-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="kpi">
      <p class="kpi__label">{{ label() }}</p>
      <p class="kpi__value" [class]="'kpi__value--' + tone()">{{ value() }}</p>
      @if (hint()) {
        <p class="kpi__hint">{{ hint() }}</p>
      }
    </div>
  `,
  styles: [`
    .kpi {
      background: var(--pf-surface);
      border: 1px solid var(--pf-border);
      border-radius: var(--pf-radius);
      box-shadow: var(--pf-shadow);
      padding: 18px 20px;
      min-height: 100px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 6px;
    }
    .kpi__label {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: .07em;
      text-transform: uppercase;
      color: var(--pf-text-muted);
    }
    .kpi__value {
      font-size: 24px;
      font-weight: 700;
      color: var(--pf-text);
      font-variant-numeric: tabular-nums;
      letter-spacing: -.02em;
    }
    .kpi__value--success { color: var(--pf-success); }
    .kpi__value--danger  { color: var(--pf-danger); }
    .kpi__value--accent  { color: var(--pf-accent-dark); }
    .kpi__hint { font-size: 12px; color: var(--pf-text-muted); }

    @media (max-width: 767px) {
      .kpi { padding: 14px; min-height: 88px; }
      .kpi__value { font-size: 19px; }
      .kpi__label { font-size: 10px; }
    }
  `],
})
export class KpiCardComponent {
  readonly label = input.required<string>();
  readonly value = input.required<string>();
  readonly hint = input<string>('');
  readonly tone = input<'default' | 'success' | 'danger' | 'accent'>('default');
}
