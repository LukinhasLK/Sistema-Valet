import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ChartConfiguration } from 'chart.js';
import { CabecalhoPagina } from '../../compartilhado/CabecalhoPagina';
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
  const [mes, setMes] = useState(0);
  const [ano, setAno] = useState(() => periodoReferencia(fichas).ano);
  const [unidadeId, setUnidadeId] = useState(TODAS_UNIDADES);
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
        <CabecalhoPagina titulo="Carros por Mês" subtitulo="Total de carros manobrados por período">
          <button type="button" className="pf-btn pf-btn--ghost" disabled={exportando !== null} onClick={() => exportar('pdf')}>
            {exportando === 'pdf' ? 'Gerando PDF…' : 'Baixar PDF'}
          </button>
          <button type="button" className="pf-btn pf-btn--ghost" disabled={exportando !== null} onClick={() => exportar('excel')}>
            {exportando === 'excel' ? 'Gerando Excel…' : 'Baixar Excel'}
          </button>
        </CabecalhoPagina>

        <div className="pf-filters">
          <select className="pf-select" value={mes} onChange={(e) => setMes(+e.target.value)} aria-label="Mês">
            <option value={0}>Todos os meses</option>
            {MESES.map((nome, i) => <option key={nome} value={i + 1}>{nome}</option>)}
          </select>
          <select className="pf-select" value={ano} onChange={(e) => setAno(+e.target.value)} aria-label="Ano">
            {anos.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <select className="pf-select" value={unidadeId} onChange={(e) => setUnidadeId(+e.target.value)} aria-label="Unidade">
            <option value={TODAS_UNIDADES}>Todas</option>
            {unidades.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
          </select>
        </div>

        <section className="pf-grid-kpi">
          <CartaoKpi rotulo={mes ? 'Total de carros no mês' : 'Total de carros no ano'} valor={numero(totalCarros)}
            dica={mes ? `${nomeMes(mes)} de ${ano}` : String(ano)} />
          <CartaoKpi rotulo="Melhor mês" valor={melhorMes ? nomeMes(melhorMes.mes) : '—'}
            dica={melhorMes ? `${numero(melhorMes.carros)} carros` : 'sem registros'} />
          <CartaoKpi rotulo="Média mensal" valor={numero(mediaMensal)} dica="meses com movimento" />
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
            <h2 className="pf-card__title">Carros manobrados por mês</h2>
            <p className="pf-card__subtitle">{ano} — o mês recorde aparece em destaque</p>
          </div>
          <div className="pf-card__body">
            <Grafico config={grafico} altura={isMobile ? 230 : 300} rotulo="Carros manobrados mês a mês" />
          </div>
        </article>

        {mesesComDados.length === 0 ? (
          <div className="pf-card vazio">
            <p className="vazio__titulo">Nenhum registro no período</p>
            <p className="vazio__texto">Escolha outro mês, ano ou unidade.</p>
          </div>
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
                  <tr><th>Mês</th><th className="num">Fichas</th><th className="num">Carros</th><th className="num">Total bruto</th><th className="num">Total líquido</th><th>Ações</th></tr>
                </thead>
                <tbody>
                  {mesesComDados.map((m) => (
                    <tr key={m.mes}>
                      <td>{nomeMes(m.mes)}</td>
                      <td className="num">{m.fichas}</td>
                      <td className="num">{numero(m.carros)}</td>
                      <td className="num">{moeda(m.bruto)}</td>
                      <td className={`num ${classeSaldo(m.liquido)}`}>{moeda(m.liquido)}</td>
                      <td><Link className="pf-btn pf-btn--ghost" to={verFichas(m.mes)}>Ver fichas de {nomeMes(m.mes)}</Link></td>
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
