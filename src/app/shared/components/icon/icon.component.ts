import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Traçados dos ícones (grade 24×24, estilo contorno). */
const TRACOS: Record<string, string> = {
  dashboard: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',
  fichas: 'M4 4h11l5 5v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM14 3v6h6M8 13h8M8 17h5',
  relatorios: 'M3 21h18M7 21V10M12 21V4M17 21v-7',
  manobristas: 'M5 20v-2a4 4 0 0 1 4-4h2a4 4 0 0 1 4 4v2M12 3a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7M18 20v-1.5a3.5 3.5 0 0 0-2.5-3.35',
  lucro: 'M12 3a9 9 0 1 0 9 9h-9z M14 3.3A9 9 0 0 1 20.7 10H14z',
  despesas: 'M5 3h14v18l-3-2-2 2-2-2-2 2-3-2zM9 8h6M9 12h6M9 16h3',
  carros: 'M3 8h18M7 3v3M17 3v3M4 6h16a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1zM8 13h2M14 13h2M8 17h2M14 17h2',
  unidades: 'M4 21V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v16M15 10h3a2 2 0 0 1 2 2v9M3 21h18M8 7h3M8 11h3M8 15h3',
  socios: 'M9 21v-2a3 3 0 0 1 3-3M7.5 4a3 3 0 1 1 0 6 3 3 0 0 1 0-6M17 21v-2a3 3 0 0 0-3-3M16.5 4a3 3 0 1 1 0 6 3 3 0 0 1 0-6',
  usuarios: 'M4 20v-1.5C4 15.5 6.5 14 12 14s8 1.5 8 4.5V20M12 3.5a4 4 0 1 1 0 8 4 4 0 0 1 0-8',
  mais: 'M4 6h16M4 12h16M4 18h16',
  plus: 'M12 5v14M5 12h14',
  sino: 'M18 9a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6M13.7 20a2 2 0 0 1-3.4 0',
  busca: 'M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14M20 20l-4-4',
  sair: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  voltar: 'M15 5l-7 7 7 7',
  avancar: 'M9 5l7 7-7 7',
  baixar: 'M12 3v12M7 11l5 5 5-5M4 21h16',
  local: 'M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11zM12 8a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5',
  editar: 'M4 20h4l10-10-4-4L4 16zM14 6l4 4',
  excluir: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6',
  ver: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7M12 9.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5',
  check: 'M4 12.5 9 18 20 6',
  alerta: 'M12 3 2 20h20zM12 9v5M12 17.5v.5',
  tendencia: 'M3 17l6-6 4 4 8-8M15 7h6v6',
};

@Component({
  selector: 'pf-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      [attr.width]="size()"
      [attr.height]="size()"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      [attr.stroke-width]="strokeWidth()"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path [attr.d]="traco()" />
    </svg>
  `,
  styles: [':host { display: inline-flex; line-height: 0; }'],
})
export class IconComponent {
  readonly name = input.required<string>();
  readonly size = input(20);
  readonly strokeWidth = input(1.8);

  protected readonly traco = computed(() => TRACOS[this.name()] ?? '');
}
