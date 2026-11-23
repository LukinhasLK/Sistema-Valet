import { Pipe, PipeTransform } from '@angular/core';

const FORMATADOR = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** `1234.5` → `R$ 1.234,50`; com `sinal`, negativos viram `-R$ 1.234,50`. */
@Pipe({ name: 'currencyBr', standalone: true })
export class CurrencyBrPipe implements PipeTransform {
  transform(valor: number | null | undefined): string {
    return FORMATADOR.format(valor ?? 0);
  }
}
