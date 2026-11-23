import { Pipe, PipeTransform } from '@angular/core';

const FORMATADOR = new Intl.NumberFormat('pt-BR');

/** `2246` → `2.246`. */
@Pipe({ name: 'numeroBr', standalone: true })
export class NumeroBrPipe implements PipeTransform {
  transform(valor: number | null | undefined): string {
    return FORMATADOR.format(valor ?? 0);
  }
}
