import { Pipe, PipeTransform } from '@angular/core';
import { formatarData } from '../../core/services/periodo';

/** `2026-06-07` → `07/06/2026`. */
@Pipe({ name: 'dataBr', standalone: true })
export class DataBrPipe implements PipeTransform {
  transform(dataIso: string | null | undefined): string {
    return dataIso ? formatarData(dataIso) : '—';
  }
}
