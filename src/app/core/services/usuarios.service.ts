import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Usuario } from '../models';
import { API_URL } from './api';

const URL = `${API_URL}/usuarios`;

/** Cadastro de usuários (somente Proprietário). A API nunca devolve senha nem hash. */
@Injectable({ providedIn: 'root' })
export class UsuariosService {
  private readonly http = inject(HttpClient);
  private readonly _usuarios = signal<Usuario[]>([]);

  readonly usuarios = this._usuarios.asReadonly();

  async carregar(): Promise<void> {
    this._usuarios.set(await firstValueFrom(this.http.get<Usuario[]>(URL, { params: { incluirInativos: true } })));
  }

  limpar(): void {
    this._usuarios.set([]);
  }

  /** Na edição, senha vazia mantém a senha atual. */
  async salvarUsuario(usuario: Omit<Usuario, 'id'> & { id?: number }): Promise<Usuario> {
    const { id, ...dados } = usuario;
    const corpo = { ...dados, senha: dados.senha || null };
    const salvo = await firstValueFrom(
      id ? this.http.put<Usuario>(`${URL}/${id}`, corpo) : this.http.post<Usuario>(URL, corpo)
    );
    this._usuarios.update((lista) => (id ? lista.map((u) => (u.id === salvo.id ? salvo : u)) : [...lista, salvo]));
    return salvo;
  }

  emailEmUso(email: string, ignorarId?: number): boolean {
    const busca = email.trim().toLowerCase();
    return this._usuarios().some((u) => u.id !== ignorarId && u.email.toLowerCase() === busca);
  }

  async excluir(id: number): Promise<void> {
    await firstValueFrom(this.http.delete<void>(`${URL}/${id}`));
    this._usuarios.update((lista) => lista.map((u) => u.id === id ? { ...u, ativo: false } : u));
  }
}
