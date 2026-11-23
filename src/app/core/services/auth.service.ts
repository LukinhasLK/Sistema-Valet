import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { NivelAcesso, Usuario } from '../models';
import { API_URL } from './api';
import { DespesasService } from './despesas.service';
import { FichasService } from './fichas.service';
import { ManobristasService } from './manobristas.service';
import { desligarPushDaSessao } from './push-dispositivo';
import { podeAcessar } from './permissoes';
import { SociosService } from './socios.service';
import { carregar, remover, salvar } from './storage';
import { UnidadesService } from './unidades.service';
import { UsuariosService } from './usuarios.service';

const CHAVE_TOKEN = 'parkflash.token';

interface RespostaLogin {
  token: string;
  usuario: Usuario;
}

/**
 * Sessão via JWT emitido por POST /api/auth/login. O token só prova quem é o usuário:
 * as permissões valem no servidor, e o nível exibido aqui vem sempre da API.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly unidades = inject(UnidadesService);
  private readonly manobristas = inject(ManobristasService);
  private readonly socios = inject(SociosService);
  private readonly fichas = inject(FichasService);
  private readonly despesas = inject(DespesasService);
  private readonly usuarios = inject(UsuariosService);

  private readonly _token = signal<string | null>(carregar<string | null>(CHAVE_TOKEN, null));
  private readonly _usuario = signal<Usuario | null>(null);

  readonly token = this._token.asReadonly();
  readonly usuario = this._usuario.asReadonly();
  readonly autenticado = computed(() => this.usuario() !== null);
  readonly nivel = computed(() => this.usuario()?.nivel ?? null);
  readonly inicial = computed(() => this.usuario()?.nome.charAt(0).toUpperCase() ?? '?');

  /** Retorna false para credenciais erradas; outros erros (servidor fora do ar) são lançados. */
  async login(identificador: string, senha: string): Promise<boolean> {
    if (!identificador.trim() || !senha) return false;
    try {
      const resposta = await firstValueFrom(
        this.http.post<RespostaLogin>(`${API_URL}/auth/login`, { identificador: identificador.trim(), senha })
      );
      this._token.set(resposta.token);
      salvar(CHAVE_TOKEN, resposta.token);
      this._usuario.set(resposta.usuario);
      await this.carregarDados(resposta.usuario.nivel);
      return true;
    } catch (erro: unknown) {
      if ((erro as { status?: number }).status === 401) {
        this.logout();
        return false;
      }
      this.logout();
      throw erro;
    }
  }

  /** Na abertura do app: se houver token salvo, confirma com o servidor e recarrega os dados. */
  async restaurarSessao(): Promise<void> {
    if (!this._token()) return;
    try {
      const usuario = await firstValueFrom(this.http.get<Usuario>(`${API_URL}/auth/me`));
      this._usuario.set(usuario);
      await this.carregarDados(usuario.nivel);
    } catch {
      this.logout();
    }
  }

  async trocarSenha(senhaAtual: string, novaSenha: string): Promise<void> {
    await firstValueFrom(this.http.put<void>(`${API_URL}/auth/senha`, { senhaAtual, novaSenha }));
  }

  logout(): void {
    desligarPushDaSessao(this._usuario()?.id, this._token());
    this._token.set(null);
    this._usuario.set(null);
    remover(CHAVE_TOKEN);
    [this.unidades, this.manobristas, this.socios, this.fichas, this.despesas, this.usuarios].forEach((s) => s.limpar());
  }

  /** Carrega só o que o nível pode ver — o servidor recusaria o resto com 403. */
  private async carregarDados(nivel: NivelAcesso): Promise<void> {
    await Promise.all([
      this.unidades.carregar(),
      this.manobristas.carregar(),
      podeAcessar(nivel, 'socios') ? this.socios.carregar() : Promise.resolve(),
      this.fichas.carregar(),
      podeAcessar(nivel, 'despesas') ? this.despesas.carregar() : Promise.resolve(),
      podeAcessar(nivel, 'usuarios') ? this.usuarios.carregar() : Promise.resolve(),
    ]);
  }
}
