import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ChartConfiguration } from 'chart.js';
import { BarraFiltros, FiltroPilula } from '../../compartilhado/BarraFiltros';
import { CabecalhoPagina } from '../../compartilhado/CabecalhoPagina';
import { EstadoVazio } from '../../compartilhado/EstadoVazio';
import { Icone } from '../../compartilhado/Icone';
import { lerFiltro, useFiltrosUrl } from '../../compartilhado/useFiltrosUrl';
import { CartaoKpi } from '../../compartilhado/CartaoKpi';
import { moeda, numero } from '../../compartilhado/formatos';
import { Grafico } from '../../compartilhado/Grafico';
import { AZUL, escalasPadrao, formatarNumero, opcoesBase } from '../../compartilhado/tema-graficos';
import { avisos } from '../../nucleo/estado/aviso';
import { useDespesas } from '../../nucleo/estado/despesas';
import { anosDisponiveis, periodoReferencia, resumoMensal, useFichas } from '../../nucleo/estado/fichas';
import { useIsMobile } from '../../nucleo/estado/layout';
import { useUnidades } from '../../nucleo/estado/unidades';
import { baixarArquivo } from '../../nucleo/servicos/download';
import { MESES, MESES_CURTOS, TODAS_UNIDADES } from '../../nucleo/servicos/periodo';
import { relatoriosServico } from '../../nucleo/servicos/relatorios';
import './carros-por-mes.scss';

const nomeMes = (mes: number) => MESES[mes - 1];
const classeSaldo = (valor: number) => (valor < 0 ? 'pf-money--neg' : 'pf-money--pos');

export default function CarrosPorMes() {
  const isMobile = useIsMobile();
  const fichas = useFichas((s) => s.fichas);
  const despesas = useDespesas((s) => s.despesas);
  const unidades = useUnidades((s) => s.unidades);
  const anos = useMemo(() => anosDisponiveis(fichas, despesas), [fichas, despesas]);
  const anoReferencia = useMemo(() => periodoReferencia(fichas).ano, [fichas]);
  // Filtros na URL, como em Fichas: o link abre o mesmo recorte.
  const filtros = useFiltrosUrl({
    mes: { padrao: 0, ler: lerFiltro.inteiro(0, 12) },
    ano: { padrao: anoReferencia, ler: (b: string) => { const n = Number(b); return anos.includes(n) ? n : undefined; } },
    unidadeId: { padrao: TODAS_UNIDADES, ler: (b: string) => { const n = Number(b); return unidades.some((u) => u.id === n) ? n : undefined; } },
  });
  const { mes, ano, unidadeId } = filtros.valores;
  const [exportando, setExportando] = useState<'pdf' | 'excel' | null>(null);

  const resumoAnual = useMemo(() => resumoMensal(fichas, ano, unidadeId), [fichas, ano, unidadeId]);
  /** Só os meses que tiveram movimento entram na tabela e nas médias. */
  const mesesComDados = useMemo(() => resumoAnual.filter((m) => m.fichas > 0 && (!mes || m.mes === mes)), [resumoAnual, mes]);
  const totalCarros = mesesComDados.reduce((soma, m) => soma + m.carros, 0);
  const melhorMes = mesesComDados.length ? mesesComDados.reduce((melhor, atual) => (atual.carros > melhor.carros ? atual : melhor)) : null;
  const mediaMensal = mesesComDados.length ? Math.round(totalCarros / mesesComDados.length) : 0;

  /** Variação sobre os mesmos meses do ano anterior (ex.: jan–jun × jan–jun). */
  const comparativo = useMemo(() => {
    const meses = new Set(mesesComDados.map((m) => m.mes));
    const base = resumoMensal(fichas, ano - 1, unidadeId).filter((m) => meses.has(m.mes)).reduce((soma, m) => soma + m.carros, 0);
    if (!base) return null;
    return { variacao: Math.round(((totalCarros - base) / base) * 100), base, meses: meses.size };
  }, [mesesComDados, fichas, ano, unidadeId, totalCarros]);

  /** Mês escolhido: carros de cada dia (dia e noite somados; fichas canceladas ficam de fora, como no PDF). */
  const porDia = useMemo(() => {
    if (!mes) return [];
    const prefixo = `${ano}-${String(mes).padStart(2, '0')}`;
    const mapa = new Map<string, { fichas: number; carros: number }>();
    for (const f of fichas) {
      if (f.situacao === 'CANCELADA' || !f.data.startsWith(prefixo) || (unidadeId !== TODAS_UNIDADES && f.unidadeId !== unidadeId)) continue;
      const atual = mapa.get(f.data) ?? { fichas: 0, carros: 0 };
      mapa.set(f.data, { fichas: atual.fichas + 1, carros: atual.carros + f.totalCarros });
    }
    return [...mapa.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([data, v]) => ({ data, ...v }));
  }, [fichas, mes, ano, unidadeId]);

  const graficoDias = useMemo<ChartConfiguration | null>(() => {
    if (!mes) return null;
    const diasNoMes = new Date(ano, mes, 0).getDate();
    const valores = Array.from({ length: diasNoMes }, (_, i) => porDia.find((d) => +d.data.slice(8) === i + 1)?.carros ?? 0);
    const maior = Math.max(...valores);
    return {
      type: 'bar',
      data: {
        labels: valores.map((_, i) => String(i + 1)),
        datasets: [{
          label: 'Carros',
          data: valores,
          backgroundColor: valores.map((v) => (v === 0 ? AZUL.claro : v === maior ? AZUL.escuro : AZUL.medio)),
          borderRadius: 3,
          borderSkipped: false,
          maxBarThickness: 22,
        }],
      },
      options: {
        ...opcoesBase(),
        interaction: { mode: 'nearest', intersect: true },
        scales: escalasPadrao(formatarNumero),
        plugins: {
          ...opcoesBase().plugins,
          tooltip: { ...opcoesBase().plugins!.tooltip, callbacks: {
            title: (itens) => `${itens[0].label} de ${nomeMes(mes)}`,
            label: (item) => `${formatarNumero(item.parsed.y ?? 0)} carros`,
          } },
        },
      },
    };
  }, [porDia, mes, ano]);

  const grafico = useMemo<ChartConfiguration>(() => {
    const maior = Math.max(...resumoAnual.map((m) => m.carros));
    return {
      type: 'bar',
      data: {
        labels: MESES_CURTOS.map((m) => m),
        datasets: [{
          label: 'Carros',
          data: resumoAnual.map((m) => m.carros),
          // Passo escuro só no mês recorde; meses sem dados ficam bem claros.
          backgroundColor: resumoAnual.map((m) => (m.carros === 0 ? AZUL.claro : m.carros === maior ? AZUL.escuro : AZUL.medio)),
          borderRadius: 4,
          borderSkipped: false,
          maxBarThickness: 44,
        }],
      },
      options: {
        ...opcoesBase(),
        interaction: { mode: 'nearest', intersect: true },
        scales: escalasPadrao(formatarNumero),
        plugins: {
          ...opcoesBase().plugins,
          tooltip: { ...opcoesBase().plugins!.tooltip, callbacks: { label: (item) => `${formatarNumero(item.parsed.y ?? 0)} carros` } },
        },
      },
    };
  }, [resumoAnual]);

  async function exportar(formato: 'pdf' | 'excel') {
    if (exportando) return;
    setExportando(formato);
    try {
      const arquivo = await relatoriosServico.carros({ ano, ...(mes ? { mes } : {}), ...(unidadeId === TODAS_UNIDADES ? {} : { unidadeId }) }, formato);
      baixarArquivo(arquivo, `parkflash-carros-${ano}-${String(mes || 1).padStart(2, '0')}-01.${formato === 'pdf' ? 'pdf' : 'xlsx'}`);
    } catch (erro) {
      avisos.erro(erro);
    } finally {
      setExportando(null);
    }
  }

  const verFichas = (m: number) => `/app/fichas?mes=${m}&ano=${ano}&unidadeId=${unidadeId}`;

  return (
    <pf-carros-por-mes>
      <div className="pf-page">
        <CabecalhoPagina sobretitulo="Operação" titulo="Carros por Mês" subtitulo="Carros manobrados por período, a partir das fichas lançadas.">
          <button type="button" className="pf-btn pf-btn--ghost" disabled={exportando !== null} onClick={() => exportar('pdf')}>
            <Icone nome="documento" tamanho={16} />
            {exportando === 'pdf' ? 'Gerando PDF…' : 'Baixar PDF'}
          </button>
          <button type="button" className="pf-btn pf-btn--ghost" disabled={exportando !== null} onClick={() => exportar('excel')}>
            <Icone nome="baixar" tamanho={16} />
            {exportando === 'excel' ? 'Gerando Excel…' : 'Baixar Excel'}
          </button>
        </CabecalhoPagina>

        <BarraFiltros ativos={filtros.ativos} aoLimpar={filtros.limpar}>
          <FiltroPilula rotulo="Mês" icone="eventos" valor={mes} padrao={0}
            opcoes={[{ valor: 0, rotulo: 'Todos os meses' }, ...MESES.map((nome, i) => ({ valor: i + 1, rotulo: nome }))]}
            aoMudar={(v) => filtros.definir({ mes: v })} />
          <FiltroPilula rotulo="Ano" valor={ano} padrao={anoReferencia} opcoes={anos.map((a) => ({ valor: a, rotulo: String(a) }))} aoMudar={(v) => filtros.definir({ ano: v })} />
          <FiltroPilula rotulo="Unidade" icone="unidades" valor={unidadeId} padrao={TODAS_UNIDADES}
            opcoes={[{ valor: TODAS_UNIDADES, rotulo: 'Todas' }, ...unidades.map((u) => ({ valor: u.id, rotulo: u.nome }))]}
            aoMudar={(v) => filtros.definir({ unidadeId: v })} />
        </BarraFiltros>

        <section className="pf-grid-kpi">
          <CartaoKpi rotulo={mes ? 'Total de carros no mês' : 'Total de carros no ano'} icone="carros" valor={numero(totalCarros)} numero={totalCarros} formato={numero}
            dica={mes ? `${nomeMes(mes)} de ${ano}` : String(ano)} />
          <CartaoKpi rotulo="Melhor mês" icone="tendencia" valor={melhorMes ? nomeMes(melhorMes.mes) : '—'}
            dica={melhorMes ? `${numero(melhorMes.carros)} carros` : 'sem registros'} />
          <CartaoKpi rotulo="Média mensal" icone="relatorios" valor={numero(mediaMensal)} numero={mediaMensal} formato={numero} dica="meses com movimento" />
          {comparativo ? (
            <CartaoKpi rotulo="Comparativo ano ant."
              valor={`${comparativo.variacao >= 0 ? '↑ ' : '↓ '}${Math.abs(comparativo.variacao)}%`}
              dica={`mesmos ${comparativo.meses} meses: ${numero(comparativo.base)} carros`}
              tom={comparativo.variacao >= 0 ? 'success' : 'danger'} />
          ) : (
            <CartaoKpi rotulo="Comparativo ano ant." valor="—" dica="sem base de comparação" />
          )}
        </section>

        <article className="pf-card grafico">
          <div className="pf-card__head">
            <h2 className="pf-card__title">{mes ? `Carros por dia — ${nomeMes(mes)} de ${ano}` : 'Carros manobrados por mês'}</h2>
            <p className="pf-card__subtitle">{mes ? 'O dia com mais carros aparece em destaque' : `${ano} — o mês recorde aparece em destaque`}</p>
          </div>
          <div className="pf-card__body">
            <Grafico config={graficoDias ?? grafico} altura={isMobile ? 230 : 300} rotulo={mes ? `Carros por dia em ${nomeMes(mes)}` : 'Carros manobrados mês a mês'} />
          </div>
        </article>

        {mes > 0 && porDia.length > 0 && (
          <article className="pf-card tabela-dias">
            <div className="pf-card__head">
              <h2 className="pf-card__title">Carros por dia</h2>
              <p className="pf-card__subtitle">Os mesmos números do PDF e do Excel deste mês</p>
            </div>
            <div className="pf-table-wrap">
              <table className="pf-table">
                <thead><tr><th>Data</th><th>Dia</th><th className="num">Fichas</th><th className="num">Carros</th></tr></thead>
                <tbody>
                  {porDia.map((d) => (
                    <tr key={d.data}>
                      <td className="mes">{d.data.slice(8)}/{d.data.slice(5, 7)}/{d.data.slice(0, 4)}</td>
                      <td>{new Intl.DateTimeFormat('pt-BR', { weekday: 'long', timeZone: 'UTC' }).format(new Date(`${d.data}T12:00:00Z`))}</td>
                      <td className="num">{d.fichas}</td>
                      <td className="num"><strong>{numero(d.carros)}</strong></td>
                    </tr>
                  ))}
                  <tr className="linha-total">
                    <td colSpan={2}>Total do mês</td>
                    <td className="num">{porDia.reduce((s, d) => s + d.fichas, 0)}</td>
                    <td className="num">{numero(porDia.reduce((s, d) => s + d.carros, 0))}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </article>
        )}

        {mesesComDados.length === 0 ? (
          <EstadoVazio ilustracao="calendario" titulo="Nenhum carro registrado no período"
            texto="Os totais vêm das fichas lançadas. Escolha outro mês, ano ou unidade.">
            {filtros.ativos > 0 && <button type="button" className="pf-btn pf-btn--ghost" onClick={filtros.limpar}>Limpar filtros</button>}
          </EstadoVazio>
        ) : isMobile ? (
          <div className="cards">
            {mesesComDados.map((m) => (
              <article key={m.mes} className="pf-card card-mes">
                <div className="card-mes__topo">
                  <span className="card-mes__nome">{nomeMes(m.mes)}</span>
                  <span className="card-mes__carros">{numero(m.carros)} carros</span>
                </div>
                <div className="card-mes__linha"><span>{m.fichas} fichas</span><span>{moeda(m.bruto)}</span></div>
                <div className="card-mes__linha card-mes__linha--forte">
                  <span>Líquido</span>
                  <span className={classeSaldo(m.liquido)}>{moeda(m.liquido)}</span>
                </div>
                <Link className="pf-btn pf-btn--ghost" to={verFichas(m.mes)}>Ver fichas de {nomeMes(m.mes)}</Link>
              </article>
            ))}
          </div>
        ) : (
          <div className="pf-card tabela">
            <div className="pf-table-wrap">
              <table className="pf-table">
                <thead>
                  <tr><th>Mês</th><th className="num">Fichas</th><th className="num">Carros</th><th className="num">Total bruto</th><th className="num">Total líquido</th><th className="actions"><span className="pf-sr-only">Ações</span></th></tr>
                </thead>
                <tbody>
                  {mesesComDados.map((m) => (
                    <tr key={m.mes}>
                      <td className="mes">{nomeMes(m.mes)}</td>
                      <td className="num">{m.fichas}</td>
                      <td className="num">{numero(m.carros)}</td>
                      <td className="num">{moeda(m.bruto)}</td>
                      <td className={`num ${classeSaldo(m.liquido)}`}>{moeda(m.liquido)}</td>
                      <td className="actions"><Link className="pf-btn pf-btn--ghost pf-btn--sm" to={verFichas(m.mes)}>Ver fichas de {nomeMes(m.mes)}<Icone nome="seta" tamanho={14} /></Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </pf-carros-por-mes>
  );
}
