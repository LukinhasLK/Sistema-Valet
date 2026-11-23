import { Injectable, signal } from '@angular/core';
import { mensagemDeErro } from './api';

export interface Aviso {
  tipo: 'erro' | 'sucesso';
  texto: string;
}

/** Aviso flutuante (toast) para retorno das operações na API. */
@Injectable({ providedIn: 'root' })
export class AvisoService {
  private readonly _aviso = signal<Aviso | null>(null);
  private timer?: ReturnType<typeof setTimeout>;

  readonly aviso = this._aviso.asReadonly();

  sucesso(texto: string): void {
    this.mostrar({ tipo: 'sucesso', texto });
  }

  erro(erro: unknown, padrao?: string): void {
    this.mostrar({ tipo: 'erro', texto: mensagemDeErro(erro, padrao) });
  }

  fechar(): void {
    clearTimeout(this.timer);
    this._aviso.set(null);
  }

  private mostrar(aviso: Aviso): void {
    clearTimeout(this.timer);
    this._aviso.set(aviso);
    this.timer = setTimeout(() => this._aviso.set(null), aviso.tipo === 'erro' ? 6000 : 3000);
  }
}
