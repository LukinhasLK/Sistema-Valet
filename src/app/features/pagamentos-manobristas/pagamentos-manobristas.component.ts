import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CalendarioComponent } from '../../shared/components/calendario/calendario.component';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AvisoService } from '../../core/services/aviso.service';
import { mensagemDeErro } from '../../core/services/api';
import { ManobristasService } from '../../core/services/manobristas.service';
import { UnidadesService } from '../../core/services/unidades.service';
import { LayoutService } from '../../core/services/layout.service';
import { MESES } from '../../core/services/periodo';
import {
  Aba, Candidato, Confirmacao, Diaria, FiltroPagamentos, Forma, Pagamento, PagamentosManobristasService, Pendencia,
  Resumo, Situacao,
} from '../../core/services/pagamentos-manobristas.service';
import { KpiCardComponent } from '../../shared/components/kpi-card/kpi-card.component';
import { ModalComponent } from '../../shared/components/modal/modal.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { CurrencyBrPipe, DataBrPipe } from '../../shared/pipes';
import { PixManobristaComponent } from './pix-manobrista.component';

const FILTRO_INICIAL: FiltroPagamentos = { inicio: '', fim: '', manobristaId: 0, unidadeId: 0, busca: '', situacao: '' };

type Dialogo =
  | { tipo: 'conferencia'; candidato: Candidato }
  | { tipo: 'pix'; id: number; nome: string }
  | { tipo: 'pagamento'; diarias: Diaria[] }
  | { tipo: 'historico' | 'estorno'; pagamento: Pagamento };

@Component({
  selector: 'pf-pagamentos-manobristas',
  imports: [CalendarioComponent, DatePipe, FormsModule, NgTemplateOutlet, RouterLink, PageHeaderComponent, KpiCardComponent,
    ModalComponent, PixManobristaComponent, CurrencyBrPipe, DataBrPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pagamentos-manobristas.component.html',
  styleUrl: './pagamentos-manobristas.component.scss',
})
export class PagamentosManobristasComponent {
  private readonly api = inject(PagamentosManobristasService);
  private readonly aviso = inject(AvisoService);
  private readonly rota = inject(ActivatedRoute);
  protected readonly manobristas = inject(ManobristasService).manobristas;
  protected readonly unidades = inject(UnidadesService).unidades;
  protected readonly mobile = inject(LayoutService).isMobile;
  protected readonly meses = MESES;
  protected readonly hoje = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' }).format(new Date());
  protected readonly abas: { id: Aba; nome: string }[] = [
    { id: 'diarias', nome: 'Diárias a pagar' },
    { id: 'conferencia', nome: 'Conferir fichas' },
    { id: 'historico', nome: 'Histórico' },
  ];
  protected readonly formas: Record<Forma, string> = {
    PIX: 'Pix', DINHEIRO: 'Dinheiro', TRANSFERENCIA: 'Transferência bancária', OUTRA: 'Outra',
  };
  protected readonly opcoesForma = Object.keys(this.formas) as Forma[];
  protected readonly situacoes: Record<Situacao, { nome: string; cor: string }> = {
    PENDENTE: { nome: 'Pendente', cor: 'orange' },
    PAGO: { nome: 'Pago', cor: 'green' },
    ESTORNADO: { nome: 'Estornado', cor: 'gray' },
  };

  protected readonly aba = signal<Aba>(this.rota.snapshot.queryParamMap.get('aba') === 'historico' ? 'historico' : 'diarias');
  protected readonly pagina = signal(0);
  protected readonly tamanho = signal(15);
  protected readonly total = signal(0);
  protected readonly ultimaPagina = computed(() => Math.max(1, Math.ceil(this.total() / this.tamanho())));
  protected readonly diarias = signal<Diaria[]>([]);
  protected readonly candidatos = signal<Candidato[]>([]);
  protected readonly historico = signal<Pagamento[]>([]);
  protected readonly resumo = signal<Resumo | null>(null);
  protected readonly saldosPorPessoa = computed(() => {
    const pessoas = new Map<number, { id: number; nome: string; centavos: number; unidades: Pendencia[] }>();
    for (const linha of this.resumo()?.pendencias ?? []) {
      const pessoa = pessoas.get(linha.manobristaId) ?? {
        id: linha.manobristaId, nome: linha.manobrista, centavos: 0, unidades: [],
      };
      pessoa.centavos += Math.round(linha.saldo * 100);
      pessoa.unidades.push(linha);
      pessoas.set(pessoa.id, pessoa);
    }
    return Array.from(pessoas.values());
  });

  protected verDiarias(id: number, unidade: number): void {
    this.filtro = { ...this.filtroAtual(), manobristaId: id, unidadeId: unidade, situacao: '' };
    this.aplicar();
  }

  protected readonly carregando = signal(true);
  protected readonly erro = signal('');
  protected readonly selecao = signal<Diaria[]>([]);
  protected readonly soma = computed(() => this.totalCentavos(this.selecao()) / 100);
  protected readonly dialogo = signal<Dialogo | null>(null);
  protected readonly ocupado = signal(false);
  protected readonly erroDialogo = signal('');
  protected readonly tentativa = signal<{ dados: Confirmacao; arquivo: File | null } | null>(null);
  protected readonly nomeFiltrado = computed(() => this.manobristas().find(m => m.id === this.filtroAtual().manobristaId)?.nome);
  protected readonly filtroAtual = signal<FiltroPagamentos>({
    ...FILTRO_INICIAL, manobristaId: Number(this.rota.snapshot.queryParamMap.get('manobristaId')) || 0,
  });
  protected filtro = { ...this.filtroAtual() };
  protected valor = '';
  protected dataPagamento = this.hoje;
  protected forma: Forma = 'PIX';
  protected arquivo: File | null = null;
  protected motivo = '';
  protected dataMinima = '';
  private requisicao = 0;

  constructor() {
    this.rota.queryParamMap.pipe(takeUntilDestroyed()).subscribe((p) => {
      const id = Number(p.get('detalhe'));
      if (Number.isSafeInteger(id) && id > 0) {
        this.aba.set('historico');
        void this.consultarPagamento(id);
      }
    });
    void this.carregar();
  }

  protected trocarAba(aba: Aba): void {
    if (this.aba() === aba) return;
    this.aba.set(aba);
    this.filtro.situacao = '';
    this.aplicar();
  }

  protected aplicar(): void {
    this.filtroAtual.set({ ...this.filtro });
    this.selecao.set([]);
    this.pagina.set(0);
    void this.carregar();
  }

  protected limparFiltros(): void {
    this.filtro = { ...FILTRO_INICIAL };
    this.aplicar();
  }

  protected irPara(pagina: number): void {
    if (pagina < 0 || pagina >= this.ultimaPagina() || this.carregando()) return;
    this.pagina.set(pagina);
    void this.carregar();
  }

  protected async carregar(): Promise<void> {
    const id = ++this.requisicao;
    this.carregando.set(true);
    this.erro.set('');
    const filtro = this.filtroAtual();
    const aba = this.aba();
    try {
      if (filtro.inicio && filtro.fim && filtro.inicio > filtro.fim) {
        this.erro.set('A data final deve ser igual ou posterior à inicial.');
        return;
      }
      const pagina = this.pagina();
      switch (aba) {
        case 'diarias': {
          const [dados, resumo] = await Promise.all([this.api.listar<Diaria>(aba, filtro, pagina), this.api.resumo(filtro)]);
          if (id !== this.requisicao) return;
          this.diarias.set(dados.itens);
          this.resumo.set(resumo);
          this.total.set(dados.total);
          this.tamanho.set(dados.tamanho);
          break;
        }
        case 'conferencia': {
          const dados = await this.api.listar<Candidato>(aba, filtro, pagina);
          if (id !== this.requisicao) return;
          this.candidatos.set(dados.itens);
          this.total.set(dados.total);
          this.tamanho.set(dados.tamanho);
          break;
        }
        case 'historico': {
          const dados = await this.api.listar<Pagamento>(aba, filtro, pagina);
          if (id !== this.requisicao) return;
          this.historico.set(dados.itens);
          this.total.set(dados.total);
          this.tamanho.set(dados.tamanho);
        }
      }
      if (this.pagina() >= this.ultimaPagina()) {
        this.pagina.set(this.ultimaPagina() - 1);
        void this.carregar();
      }
    } catch (erro) {
      if (id === this.requisicao) this.erro.set(mensagemDeErro(erro, 'Não foi possível carregar os pagamentos.'));
    } finally {
      if (id === this.requisicao) this.carregando.set(false);
    }
  }

  protected selecionada(diaria: Diaria): boolean {
    return this.selecao().some(item => item.id === diaria.id);
  }

  protected podeSelecionar(diaria: Diaria): boolean {
    return diaria.saldo > 0 && (this.selecionada(diaria) || (this.selecao().length < 100
      && (!this.selecao().length || this.selecao()[0].manobristaId === diaria.manobristaId)));
  }

  protected selecionar(diaria: Diaria): void {
    if (!this.podeSelecionar(diaria)) return;
    this.selecao.update(itens => this.selecionada(diaria) ? itens.filter(item => item.id !== diaria.id) : [...itens, diaria]);
  }

  protected abrirConferencia(candidato: Candidato): void {
    this.valor = candidato.custo.toFixed(2).replace('.', ',');
    this.abrir({ tipo: 'conferencia', candidato });
  }

  protected reconhecer(candidato: Candidato): void {
    const valor = this.decimal(this.valor);
    if (!valor) return;
    void this.executar(async () => {
      await this.api.reconhecer(candidato, valor);
      this.dialogo.set(null);
      this.aviso.sucesso('Diária reconhecida e disponível para pagamento.');
      await this.carregar();
    });
  }

  protected abrirPix(id: number, nome: string): void {
    this.abrir({ tipo: 'pix', id, nome });
  }

  protected abrirPagamento(): void {
    const diarias = this.selecao();
    if (!diarias.length) return;
    this.tentativa.set(null);
    this.arquivo = null;
    this.forma = 'PIX';
    this.valor = '';
    this.dataPagamento = this.hoje;
    this.dataMinima = diarias.reduce((maior, diaria) => diaria.data > maior ? diaria.data : maior, '');
    this.abrir({ tipo: 'pagamento', diarias });
  }

  protected anexar(input: HTMLInputElement): void {
    this.erroDialogo.set('');
    this.arquivo = input.files?.[0] ?? null;
    if (this.arquivo && (this.arquivo.size > 2 * 1024 * 1024 || !this.arquivo.name.toLowerCase().endsWith('.pdf'))) {
      this.arquivo = null;
      input.value = '';
      this.erroDialogo.set('Escolha um PDF de até 2 MB.');
    }
  }

  protected confirmarPagamento(diarias: Diaria[]): void {
    if (this.ocupado()) return;
    let tentativa = this.tentativa();
    if (!tentativa) {
      const valor = (this.totalCentavos(diarias) / 100).toFixed(2);
      tentativa = {
        dados: {
          operacao: globalThis.crypto.randomUUID(), manobristaId: diarias[0].manobristaId,
          diarias: diarias.map(({ id, revisao }) => ({ id, revisao })), data: this.dataPagamento,
          forma: this.forma, efetuado: true, valor,
        },
        arquivo: this.arquivo,
      };
    }
    const envio = tentativa;
    void this.executar(async () => {
      try {
        const pagamento = await this.api.confirmar(envio.dados, envio.arquivo);
        this.tentativa.set(null);
        this.abrir({ tipo: 'historico', pagamento });
        this.selecao.set([]);
        this.aviso.sucesso('Pagamento registrado.');
        await this.carregar();
      } catch (erro) {
        if (!(erro instanceof HttpErrorResponse) || erro.status === 0 || erro.status >= 500) {
          this.tentativa.set(envio);
          this.erroDialogo.set('O servidor não confirmou a resposta. Tente enviar o mesmo registro novamente.');
        } else {
          this.tentativa.set(null);
          throw erro;
        }
      }
    });
  }

  protected abrirHistorico(pagamento: Pagamento): void {
    this.abrir({ tipo: 'historico', pagamento });
  }

  protected async consultarPagamento(id: number): Promise<void> {
    if (this.ocupado()) return;
    this.ocupado.set(true);
    try {
      this.abrirHistorico(await this.api.detalhar(id));
    } catch (erro) {
      this.aviso.erro(erro);
    } finally {
      this.ocupado.set(false);
    }
  }

  protected verHistorico(manobristaId: number): void {
    this.dialogo.set(null);
    this.aba.set('historico');
    this.filtro = { ...FILTRO_INICIAL, manobristaId };
    this.aplicar();
  }

  protected abrirEstorno(pagamento: Pagamento): void {
    this.motivo = '';
    this.abrir({ tipo: 'estorno', pagamento });
  }

  protected estornar(pagamento: Pagamento): void {
    if (!this.motivo.trim()) return;
    void this.executar(async () => {
      this.abrirHistorico(await this.api.estornar(pagamento.id, this.motivo.trim()));
      this.selecao.set([]);
      this.aviso.sucesso('Estorno registrado. As diárias voltaram ao saldo pendente.');
      await this.carregar();
    });
  }

  protected baixar(pagamento: Pagamento): void {
    void this.executar(async () => {
      const url = URL.createObjectURL(await this.api.comprovante(pagamento.id));
      const link = document.createElement('a');
      link.href = url;
      link.download = `comprovante-${pagamento.id}.pdf`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  }

  protected fechar(): void {
    if (!this.ocupado()) this.dialogo.set(null);
  }

  protected decimal(entrada: string): string | null {
    const valor = entrada.trim().replace(',', '.');
    return /^\d{1,14}(\.\d{1,2})?$/.test(valor) && Number(valor) > 0 ? valor : null;
  }

  private totalCentavos(diarias: Diaria[]): number {
    return diarias.reduce((total, item) => total + Math.round(item.saldo * 100), 0);
  }

  private abrir(dialogo: Dialogo): void {
    this.erroDialogo.set('');
    this.dialogo.set(dialogo);
  }

  private async executar(acao: () => Promise<void>): Promise<void> {
    if (this.ocupado()) return;
    this.ocupado.set(true);
    this.erroDialogo.set('');
    try {
      await acao();
    } catch (erro) {
      this.erroDialogo.set(mensagemDeErro(erro));
    } finally {
      this.ocupado.set(false);
    }
  }
}
