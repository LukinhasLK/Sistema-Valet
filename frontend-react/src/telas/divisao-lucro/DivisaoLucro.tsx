import { useMemo, useState } from 'react';
import type { ChartConfiguration } from 'chart.js';
import { CabecalhoPagina } from '../../compartilhado/CabecalhoPagina';
import { CartaoKpi } from '../../compartilhado/CartaoKpi';
import { moeda } from '../../compartilhado/formatos';
import { Grafico } from '../../compartilhado/Grafico';
import { formatarMoeda, SERIES, SUPERFICIE, TOOLTIP } from '../../compartilhado/tema-graficos';
import { useConsulta } from '../../compartilhado/useConsulta';
import { useDespesas } from '../../nucleo/estado/despesas';
import { anosDisponiveis, periodoReferencia, useFichas } from '../../nucleo/estado/fichas';
import { useIsMobile } from '../../nucleo/estado/layout';
import { totaisPorUnidade, useSocios } from '../../nucleo/estado/socios';
import { nomeUnidade, useUnidades } from '../../nucleo/estado/unidades';
import { round2 } from '../../nucleo/servicos/calc';
import { MESES, rotuloPeriodo } from '../../nucleo/servicos/periodo';
import { relatoriosServico } from '../../nucleo/servicos/relatorios';
import { EstadoVazio } from '../../compartilhado/EstadoVazio';
import { EsqueletoKpis } from '../../compartilhado/Esqueleto';
import { CampoSelecao } from '../../compartilhado/CampoSelecao';
import './divisao-lucro.scss';

const NEUTRO = '#9ca3af';

interface FatiaSocio {
  nome: string;
  percentual: number;
  valor: number;
  cor: string;
}

export default function DivisaoLucro() {
  const isMobile = useIsMobile();
  const fichas = useFichas((s) => s.fichas);
  const despesas = useDespesas((s) => s.despesas);
  const unidades = useUnidades((s) => s.unidades);
  const socios = useSocios((s) => s.socios);
  const anos = useMemo(() => anosDisponiveis(fichas, despesas), [fichas, despesas]);
  const [mes, setMes] = useState(() => periodoReferencia(fichas).mes);
  const [ano, setAno] = useState(() => periodoReferencia(fichas).ano);
  // Começa pela primeira unidade com rateio configurado.
  const [unidadeId, setUnidadeId] = useState(
    () => totaisPorUnidade(socios, unidades).filter((t) => t.total > 0)[0]?.unidadeId ?? unidades[0]?.id ?? 0,
  );

  const { consulta } = useConsulta(
    async (sinal) => (unidadeId ? relatoriosServico.divisao({ mes, ano, unidadeId }, sinal) : null),
    [mes, ano, unidadeId],
  );
  const dados = consulta.tipo === 'pronta' ? consulta.dados : null;
  const erro = consulta.tipo === 'erro' ? consulta.mensagem : null;

  const periodoLabel = rotuloPeriodo(mes, ano);
  const unidadeLabel = nomeUnidade(unidades, unidadeId);
  const resultado = dados?.resultado ?? 0;
  const partes = useMemo(() => dados?.partes ?? [], [dados]);

  /**
   * Cores do donut. A paleta categórica validada cobre três séries em todos os pares;
   * a partir da quarta, o excedente vira uma fatia neutra "Outros".
   */
  const fatias = useMemo<FatiaSocio[]>(() => {
    if (partes.length <= SERIES.length) return partes.map((parte, i) => ({ ...parte, cor: SERIES[i] }));
    const principais = partes.slice(0, SERIES.length - 1).map((parte, i) => ({ ...parte, cor: SERIES[i] as string }));
    const restante = partes.slice(SERIES.length - 1);
    return [...principais, {
      nome: `Outros (${restante.length})`,
      percentual: round2(restante.reduce((soma, p) => soma + p.percentual, 0)),
      valor: round2(restante.reduce((soma, p) => soma + p.valor, 0)),
      cor: NEUTRO,
    }];
  }, [partes]);

  const totalDistribuido = round2(partes.reduce((soma, parte) => soma + parte.valor, 0));
  /** O donut representa proporção — com saldo negativo ele não faz sentido. */
  const saldoNegativo = resultado < 0;

  const grafico = useMemo<ChartConfiguration>(() => ({
    type: 'doughnut',
    data: {
      labels: fatias.map((f) => f.nome),
      datasets: [{
        data: fatias.map((f) => f.percentual),
        backgroundColor: fatias.map((f) => f.cor),
        // Anel de 2px na cor da superfície separando as fatias.
        borderColor: SUPERFICIE,
        borderWidth: 2,
        hoverOffset: 6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '62%',
      plugins: {
        legend: { display: false },
        tooltip: {
          ...TOOLTIP,
          callbacks: {
            label: (item) => {
              const fatia = fatias[item.dataIndex];
              return `${fatia.percentual.toFixed(1)}% · ${formatarMoeda(fatia.valor)}`;
            },
          },
        },
      },
    } as ChartConfiguration['options'],
  }), [fatias]);

  /** Cor da barra no detalhamento (sócios agrupados em "Outros" recebem o neutro). */
  const corDoSocio = (indice: number) =>
    indice < SERIES.length && partes.length <= SERIES.length ? SERIES[indice] : indice < SERIES.length - 1 ? SERIES[indice] : NEUTRO;
  /** Largura da barra do detalhamento, proporcional ao maior percentual. */
  const largura = (percentual: number) => Math.round((percentual / Math.max(...partes.map((p) => p.percentual), 1)) * 100);

  return (
    <pf-divisao-lucro>
      <div className="pf-page">
        <CabecalhoPagina titulo="Divisão de Lucro" subtitulo="Resultado da unidade (lucro das fichas − despesas fixas) dividido entre os sócios" />

        <div className="pf-filters">
          <CampoSelecao className="pf-select" value={mes} onChange={(e) => setMes(+e.target.value)} aria-label="Mês">
            {MESES.map((nome, i) => <option key={nome} value={i + 1}>{nome}</option>)}
          </CampoSelecao>
          <CampoSelecao className="pf-select" value={ano} onChange={(e) => setAno(+e.target.value)} aria-label="Ano">
            {anos.map((a) => <option key={a} value={a}>{a}</option>)}
          </CampoSelecao>
          <CampoSelecao className="pf-select" value={unidadeId} onChange={(e) => setUnidadeId(+e.target.value)} aria-label="Unidade">
            {unidades.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
          </CampoSelecao>
        </div>

        {!unidadeId ? (
          <EstadoVazio ilustracao="vaga" titulo="Nenhuma unidade cadastrada" texto="Cadastre uma unidade para consultar a divisão de lucro." />
        ) : erro ? (
          <p className="pf-card vazio pf-error" role="alert">{erro}</p>
        ) : dados ? (
          <>
            <section className="cards-resumo">
              <CartaoKpi rotulo="Lucro das fichas" icone="fichas" valor={moeda(dados.lucroFichas)} numero={dados.lucroFichas} formato={moeda} dica={`${dados.quantidadeFichas} fichas · ${periodoLabel}`} />
              <CartaoKpi rotulo="(−) Despesas fixas" icone="despesas" valor={moeda(dados.despesasFixas)} numero={dados.despesasFixas} formato={moeda} dica={unidadeLabel} tom="danger" />
              <CartaoKpi rotulo="= Resultado a dividir" valor={moeda(resultado)} dica={`${partes.length} sócio(s)`} tom={resultado >= 0 ? 'success' : 'danger'} />
            </section>

            {partes.length === 0 ? (
              <EstadoVazio ilustracao="equipe" titulo="Sem rateio configurado"
                texto={<>Configure uma distribuição de 100% para {unidadeLabel} no mês selecionado, em <strong>Sócios</strong>.</>} />
            ) : (
              <section className="painel">
                {/* Distribuição */}
                <article className="pf-card">
                  <div className="pf-card__head">
                    <h2 className="pf-card__title">Distribuição por sócio</h2>
                    <p className="pf-card__subtitle">{unidadeLabel} — {periodoLabel}</p>
                  </div>
                  <div className="pf-card__body">
                    {saldoNegativo ? (
                      <p className="negativo">
                        O período fechou com prejuízo de {moeda(resultado)}. O gráfico de proporção fica oculto porque não há lucro a
                        distribuir — o rateio abaixo mostra a parte de cada sócio no prejuízo.
                      </p>
                    ) : (
                      <Grafico config={grafico} altura={isMobile ? 210 : 260} rotulo="Participação percentual de cada sócio no valor líquido" />
                    )}
                    <ul className="legenda">
                      {fatias.map((fatia) => (
                        <li key={fatia.nome}>
                          <span className="legenda__cor" style={{ background: fatia.cor }} aria-hidden="true" />
                          <span className="legenda__nome">{fatia.nome}</span>
                          <span className="legenda__pct">{fatia.percentual.toFixed(1)}%</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </article>

                {/* Detalhamento */}
                <article className="pf-card">
                  <div className="pf-card__head">
                    <h2 className="pf-card__title">Detalhamento</h2>
                    <p className="pf-card__subtitle">Valor líquido por sócio</p>
                  </div>
                  <div className="pf-card__body">
                    <ul className="detalhe">
                      {partes.map((parte, i) => (
                        <li key={parte.nome} className="detalhe__item">
                          <div className="detalhe__topo">
                            <span className="detalhe__nome">{parte.nome}</span>
                            <span className={`detalhe__valor${parte.valor < 0 ? ' pf-money--neg' : ''}`}>{moeda(parte.valor)}</span>
                          </div>
                          <div className="detalhe__barra">
                            <span className="detalhe__preenchimento" style={{ width: `${largura(parte.percentual)}%`, background: corDoSocio(i) }} />
                          </div>
                          <span className="detalhe__pct">{parte.percentual}% de participação</span>
                        </li>
                      ))}
                    </ul>
                    <div className="detalhe__rodape">
                      <span>Total calculado</span>
                      <strong className={totalDistribuido < 0 ? 'pf-money--neg' : undefined}>{moeda(totalDistribuido)}</strong>
                    </div>
                  </div>
                </article>
              </section>
            )}
          </>
        ) : (
          <EsqueletoKpis quantidade={3} />
        )}
      </div>
    </pf-divisao-lucro>
  );
}
