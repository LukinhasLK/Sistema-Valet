import { AppearanceDirective } from '../../shared/motion/appearance.directive';
import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { firstValueFrom, fromEvent } from 'rxjs';
import { AvisoService } from '../../core/services/aviso.service';
import { mensagemDeErro } from '../../core/services/api';
import { CATEGORIAS, Categoria, Notificacao, NotificacoesService, PreferenciaNotificacao } from '../../core/services/notificacoes.service';
import { navegadorPushCompativel } from '../../core/services/push-dispositivo';
import { ConfiguracaoPush, DiagnosticoPush, WebPushService } from '../../core/services/web-push.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';

const ROTAS: Record<Notificacao['destino'], string> = {
  FICHA: '/app/fichas', PAGAMENTO: '/app/pagamentos-manobristas', EVENTO: '/app/eventos', ESCALA: '/app/escalas',
};

@Component({
  selector: 'pf-notificacoes',
  imports: [DatePipe, PageHeaderComponent, AppearanceDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './notificacoes.component.html',
  styleUrl: './notificacoes.component.scss',
})
export class NotificacoesComponent {
  private readonly api = inject(NotificacoesService);
  private readonly push = inject(WebPushService);
  private readonly aviso = inject(AvisoService);
  private readonly router = inject(Router);

  protected readonly total = this.api.total;
  protected readonly categorias = CATEGORIAS;
  protected readonly itens = signal<Notificacao[]>([]);
  protected readonly preferencia = signal<PreferenciaNotificacao[]>([]);
  protected readonly mostraPreferencias = signal(false);
  protected readonly soNaoLidas = signal(false);
  protected readonly carregando = signal(true);
  protected readonly carregandoPreferencias = signal(false);
  protected readonly erro = signal('');
  protected readonly erroPreferencias = signal('');
  protected readonly mais = signal(false);
  protected readonly marcando = signal(false);
  protected readonly salvandoCategoria = signal<Categoria | null>(null);
  protected readonly config = signal<ConfiguracaoPush | null>(null);
  protected readonly pushOcupado = signal(false);
  protected readonly pushMensagem = signal('');
  protected readonly diagnostico = signal<DiagnosticoPush[] | null>(null);
  protected readonly diagnosticoOcupado = signal(false);
  protected readonly suportaPush = navegadorPushCompativel();
  protected readonly pushBloqueado = signal(this.suportaPush && Notification.permission === 'denied');
  protected readonly podeAtivarPush = computed(() => this.suportaPush && !!this.config()?.pronto && !this.pushBloqueado());
  private requisicao = 0;

  constructor() {
    void this.carregar();
    fromEvent(document, 'visibilitychange').pipe(takeUntilDestroyed()).subscribe(() => {
      if (document.visibilityState === 'visible' && !this.mostraPreferencias()) void this.carregar();
    });
    if ('serviceWorker' in navigator) {
      fromEvent<MessageEvent>(navigator.serviceWorker, 'message').pipe(takeUntilDestroyed()).subscribe((e) => {
        if (e.data?.tipo === 'PARKFLASH_NOTIFICACAO' && !this.mostraPreferencias()) void this.carregar();
      });
    }
  }

  protected async carregar(proxima = false): Promise<void> {
    const antes = proxima ? this.itens().at(-1)?.id : undefined;
    const requisicao = ++this.requisicao;
    this.carregando.set(true);
    this.erro.set('');
    try {
      const itens = await firstValueFrom(this.api.listar(this.soNaoLidas(), antes));
      if (requisicao !== this.requisicao) return;
      this.itens.set(proxima ? [...this.itens(), ...itens] : itens);
      this.mais.set(itens.length === 30);
      this.api.atualizarContador();
    } catch (erro) {
      if (requisicao === this.requisicao) this.erro.set(mensagemDeErro(erro, 'Não foi possível consultar as notificações.'));
    } finally {
      if (requisicao === this.requisicao) this.carregando.set(false);
    }
  }

  protected filtrar(naoLidas: boolean): void {
    this.soNaoLidas.set(naoLidas);
    this.itens.set([]);
    void this.carregar();
  }

  protected async marcar(id?: number): Promise<void> {
    if (this.marcando()) return;
    this.marcando.set(true);
    try {
      await firstValueFrom(this.api.ler(id));
      await this.carregar();
      this.aviso.sucesso(id === undefined ? 'Notificações marcadas como lidas.' : 'Notificação marcada como lida.');
    } catch (erro) {
      this.aviso.erro(erro);
    } finally {
      this.marcando.set(false);
    }
  }

  protected async abrir(item: Notificacao): Promise<void> {
    if (this.marcando()) return;
    this.marcando.set(true);
    try {
      if (!item.lida) await firstValueFrom(this.api.ler(item.id));
      this.api.atualizarContador();
      await this.router.navigate([ROTAS[item.destino]], {
        queryParams: { detalhe: item.destinoId, ...(item.destino === 'PAGAMENTO' ? { aba: 'historico' } : {}) },
      });
    } catch (erro) {
      this.aviso.erro(erro);
    } finally {
      this.marcando.set(false);
    }
  }

  protected async abrirPreferencias(): Promise<void> {
    this.mostraPreferencias.set(true);
    this.carregandoPreferencias.set(true);
    this.erroPreferencias.set('');
    this.pushBloqueado.set(this.suportaPush && Notification.permission === 'denied');
    this.pushMensagem.set('');
    try {
      const [preferencia, config] = await Promise.all([firstValueFrom(this.api.preferencias()), this.push.configuracao()]);
      this.preferencia.set(preferencia);
      this.config.set(config);
    } catch (erro) {
      this.erroPreferencias.set(mensagemDeErro(erro, 'Não foi possível consultar as preferências.'));
    } finally {
      this.carregandoPreferencias.set(false);
    }
  }

  protected async alterarCategoria(evento: Event, item: PreferenciaNotificacao): Promise<void> {
    const campo = evento.target as HTMLInputElement;
    const ativa = campo.checked;
    this.salvandoCategoria.set(item.categoria);
    try {
      await firstValueFrom(this.api.preferir(item.categoria, ativa));
      this.preferencia.update((lista) => lista.map((p) => p.categoria === item.categoria ? { ...p, ativa } : p));
    } catch (erro) {
      campo.checked = item.ativa;
      this.aviso.erro(erro);
    } finally {
      this.salvandoCategoria.set(null);
    }
  }

  protected async ativarPush(): Promise<void> {
    const chave = this.config()?.chavePublica;
    if (!chave || this.pushOcupado() || !this.podeAtivarPush()) return;
    this.pushOcupado.set(true);
    this.pushMensagem.set('Ativando neste aparelho…');
    try {
      const ativo = await this.push.ativar(chave);
      this.pushBloqueado.set(Notification.permission === 'denied');
      this.config.set(await this.push.configuracao());
      this.pushMensagem.set(ativo ? 'Push ativado neste dispositivo.' : 'A permissão de push não foi concedida.');
    } catch (erro) {
      this.pushBloqueado.set(Notification.permission === 'denied');
      this.pushMensagem.set(mensagemDeErro(erro, erro instanceof Error ? erro.message : 'Não foi possível ativar o push.'));
    } finally {
      this.pushOcupado.set(false);
    }
  }

  protected async testarPush(): Promise<void> {
    if (this.pushOcupado() || !this.config()?.inscrito || !this.config()?.envioAtivo) return;
    this.pushOcupado.set(true);
    this.pushMensagem.set('Enviando o aviso de teste…');
    try {
      const resultado = await this.push.testar();
      switch (resultado.estado) {
        case 'ACEITA':
          this.pushMensagem.set('O provedor aceitou o envio. Confira a bandeja de notificações deste aparelho.');
          break;
        case 'EXPIRADA':
          this.config.set(await this.push.configuracao());
          this.pushMensagem.set('A inscrição expirou. Ative o push novamente neste aparelho.');
          break;
        case 'FALHA_REDE':
          this.pushMensagem.set('Falha de conexão com o provedor. Tente novamente em instantes.');
          break;
        default:
          this.pushMensagem.set(`O provedor recusou o envio (HTTP ${resultado.codigo}).`);
      }
    } catch (erro) {
      this.pushMensagem.set(mensagemDeErro(erro, 'Não foi possível enviar o aviso de teste.'));
    } finally {
      this.pushOcupado.set(false);
    }
  }

  protected async desativarPush(): Promise<void> {
    if (this.pushOcupado()) return;
    this.pushOcupado.set(true);
    this.pushMensagem.set('');
    try {
      await this.push.desativar();
      this.config.set(await this.push.configuracao());
      this.pushMensagem.set('Push desativado neste dispositivo.');
    } catch (erro) {
      this.aviso.erro(erro);
    } finally {
      this.pushOcupado.set(false);
    }
  }

  protected async consultarDiagnostico(): Promise<void> {
    this.diagnosticoOcupado.set(true);
    try {
      this.diagnostico.set(await firstValueFrom(this.push.diagnostico()));
    } catch (erro) {
      this.aviso.erro(erro);
    } finally {
      this.diagnosticoOcupado.set(false);
    }
  }

  protected sairDasPreferencias(): void {
    this.mostraPreferencias.set(false);
    void this.carregar();
  }
}
