import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ChartConfiguration } from 'chart.js';
import { CartaoKpi } from '../../compartilhado/CartaoKpi';
import { moeda, numero } from '../../compartilhado/formatos';
import { Grafico } from '../../compartilhado/Grafico';
import { Icone } from '../../compartilhado/Icone';
import { AZUL, escalasPadrao, formatarMoeda, opcoesBase } from '../../compartilhado/tema-graficos';
import { useConsulta } from '../../compartilhado/useConsulta';
import { useUsuario } from '../../nucleo/estado/auth';
import { useDespesas } from '../../nucleo/estado/despesas';
import { anosDisponiveis, filtrarFichas, liquidoPorDia, melhorDiaDaSemana, resumoMensal, useFichas } from '../../nucleo/estado/fichas';
import { useIsMobile } from '../../nucleo/estado/layout';
import { totaisPorUnidade, useSocios } from '../../nucleo/estado/socios';
import { useUnidades } from '../../nucleo/estado/unidades';
import { anoDe, hojeIso, MESES, MESES_CURTOS, mesDe, rotuloPeriodo, TODAS_UNIDADES } from '../../nucleo/servicos/periodo';
import { podeAcessar } from '../../nucleo/servicos/permissoes';
import { relatoriosServico } from '../../nucleo/servicos/relatorios';
import { carregar, salvar } from '../../nucleo/servicos/storage';
import './dashboard.scss';

const semCentavos = (v: number) => formatarMoeda(v).replace(/\s?,00$/, '');

export default function Dashboard() {
  const isMobile = useIsMobile();
  const usuario = useUsuario();
  const fichas = useFichas((s) => s.fichas);
  const despesas = useDespesas((s) => s.despesas);
  const unidades = useUnidades((s) => s.unidades);
  const socios = useSocios((s) => s.socios);
  const anos = useMemo(() => anosDisponiveis(fichas, despesas), [fichas, despesas]);

  const [mes, setMes] = useState(() => mesDe(hojeIso()));
  const [ano, setAno] = useState(() => anoDe(hojeIso()));
  const [unidadeId, setUnidadeId] = useState(TODAS_UNIDADES);
  const chaveValores = `parkflash.painel.ocultar-valores.${usuario?.id}`;
  const [valoresOcultos, setValoresOcultos] = useState(() => carregar(chaveValores, false));
  const [alertasAbertos, setAlertasAbertos] = useState(false);
  const primeiroNome = usuario?.nome.split(' ')[0] ?? '';
  const periodo = rotuloPeriodo(mes, ano).toUpperCase();

  const { consulta, tentarNovamente } = useConsulta(
    (sinal) => relatoriosServico.painel({ mes, ano, ...(unidadeId === TODAS_UNIDADES ? {} : { unidadeId }) }, sinal),
    [mes, ano, unidadeId],
  );
  const painel = consulta.tipo === 'pronta' ? consulta.dados : undefined;

  const fichasDoMes = useMemo(() => filtrarFichas(fichas, { mes, ano, unidadeId }), [fichas, mes, ano, unidadeId]);
  const melhorDia = useMemo(() => melhorDiaDaSemana(fichasDoMes), [fichasDoMes]);

  const alertas = useMemo(() => {
    const lista: { texto: string; rota: string }[] = [];
    const nomeMes = MESES[mes - 1].toLowerCase();
    if (podeAcessar(usuario?.nivel, 'socios')) {
      for (const t of totaisPorUnidade(socios, unidades)) {
        if (!t.valido) {
          lista.push({
            texto: t.vazia ? `${t.unidade} não tem sócios cadastrados` : `Rateio de ${t.unidade} soma ${t.total}% (precisa de 100%)`,
            rota: '/app/socios',
          });
        }
      }
    }
    const negativas = fichasDoMes.filter((f) => f.totalLiquido < 0).length;
    if (negativas > 0) lista.push({ texto: `${negativas} ficha(s) com líquido negativo em ${nomeMes}`, rota: '/app/fichas' });
    if (painel && painel.mes.resultado < 0) lista.push({ texto: `Resultado de ${nomeMes} negativo após despesas fixas`, rota: '/app/despesas' });
    if (painel?.fichasParaConferir) lista.push({ texto: `${painel.fichasParaConferir} ficha(s) para conferência`, rota: '/app/fichas' });
    if (painel?.pagamentosPendentes) lista.push({ texto: 'Há diárias reconhecidas com saldo a pagar no recorte', rota: '/app/pagamentos-manobristas' });
    if (painel?.eventosProximos) lista.push({ texto: `${painel.eventosProximos} evento(s) nos próximos 7 dias`, rota: '/app/eventos' });
    return lista;
  }, [usuario, socios, unidades, fichasDoMes, painel, mes]);

  function alternarValores() {
    const novo = !valoresOcultos;
    setValoresOcultos(novo);
    salvar(chaveValores, novo);
  }

  /** Últimos nove dias com movimento no mês. */
  const graficoLinha = useMemo<ChartConfiguration>(() => {
    const pontos = liquidoPorDia(fichasDoMes, 9);
    return {
      type: 'line',
      data: {
        labels: pontos.map((p) => p.rotulo),
        datasets: [{
          label: 'Valor líquido',
          data: pontos.map((p) => p.valor),
          borderColor: AZUL.medio,
          backgroundColor: 'rgba(42, 120, 214, .10)',
          borderWidth: 2,
          fill: true,
          cubicInterpolationMode: 'monotone',
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: AZUL.medio,
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
        }],
      },
      options: {
        ...opcoesBase(),
        scales: escalasPadrao(semCentavos),
        plugins: {
          ...opcoesBase().plugins,
          tooltip: {
            ...opcoesBase().plugins!.tooltip,
            callbacks: { title: (itens) => `Dia ${itens[0].label}`, label: (item) => formatarMoeda(item.parsed.y ?? 0) },
          },
        },
      },
    };
  }, [fichasDoMes]);

  const graficoBarras = useMemo<ChartConfiguration>(() => {
    const meses = [...resumoMensal(fichas, ano - 1, unidadeId), ...resumoMensal(fichas, ano, unidadeId)].slice(12 + mes - 6, 12 + mes);
    const maior = Math.max(...meses.map((m) => m.liquido));
    return {
      type: 'bar',
      data: {
        labels: meses.map((m) => MESES_CURTOS[m.mes - 1]),
        datasets: [{
          label: 'Líquido',
          data: meses.map((m) => m.liquido),
          // Mesma hue; o mês recorde ganha o passo mais escuro.
          backgroundColor: meses.map((m) => (m.liquido === maior ? AZUL.escuro : AZUL.medio)),
          borderRadius: 4,
          borderSkipped: false,
          maxBarThickness: 34,
        }],
      },
      options: {
        ...opcoesBase(),
        interaction: { mode: 'nearest', intersect: true },
        scales: escalasPadrao(semCentavos),
        plugins: {
          ...opcoesBase().plugins,
          tooltip: { ...opcoesBase().plugins!.tooltip, callbacks: { label: (item) => formatarMoeda(item.parsed.y ?? 0) } },
        },
      },
    };
  }, [fichas, ano, mes, unidadeId]);

  return (
    <pf-dashboard>
      <div className="pf-page dash">
        <header className="dash__head">
          <div>
            <p className="dash__periodo">{periodo}</p>
            <h1 className="dash__saudacao">Olá, {primeiroNome}</h1>
          </div>
          <div className="dash__acoes">
            <Link className="pf-btn pf-btn--primary" to="/app/fichas/nova">
              <Icone nome="plus" tamanho={17} />
              Ficha
            </Link>
            <div className="dash__alertas">
              <button type="button" className="pf-btn pf-btn--ghost dash__pendencias" aria-label="Pendências do painel"
                aria-expanded={alertasAbertos} onClick={() => setAlertasAbertos((a) => !a)}
                onKeyDown={(e) => { if (e.key === 'Escape') setAlertasAbertos(false); }}>
                Pendências {alertas.length > 0 && <span aria-hidden="true">({alertas.length})</span>}
              </button>
              {alertasAbertos && (
                <div className="alertas" role="region" aria-label="Pendências do painel"
                  onKeyDown={(e) => { if (e.key === 'Escape') setAlertasAbertos(false); }}>
                  <p className="alertas__titulo">Pendências</p>
                  {alertas.length ? alertas.map((alerta) => (
                    <Link key={alerta.texto} className="alertas__item" to={alerta.rota} onClick={() => setAlertasAbertos(false)}>{alerta.texto}</Link>
                  )) : <p className="alertas__vazio">Nenhum alerta. Tudo em dia!</p>}
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="pf-filters">
          <select className="pf-select" value={mes} onChange={(e) => setMes(+e.target.value)} aria-label="Mês do painel">
            {MESES.map((nome, i) => <option key={nome} value={i + 1}>{nome}</option>)}
          </select>
          <select className="pf-select" value={ano} onChange={(e) => setAno(+e.target.value)} aria-label="Ano do painel">
            {anos.map((valor) => <option key={valor} value={valor}>{valor}</option>)}
          </select>
          <select className="pf-select" value={unidadeId} onChange={(e) => setUnidadeId(+e.target.value)} aria-label="Unidade do painel">
            <option value={TODAS_UNIDADES}>Unidades autorizadas</option>
            {unidades.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
          </select>
          <button type="button" className="pf-btn pf-btn--ghost dash__privacidade" aria-pressed={valoresOcultos} onClick={alternarValores}>Ocultar valores</button>
        </div>

        {consulta.tipo === 'carregando' ? (
          <p role="status">Carregando indicadores…</p>
        ) : consulta.tipo === 'erro' ? (
          <>
            <p className="pf-error" role="alert">{consulta.mensagem}</p>
            <button type="button" className="pf-btn pf-btn--ghost" onClick={tentarNovamente}>Tentar novamente</button>
          </>
        ) : (
          <>
            <section className="pf-grid-kpi">
              {!valoresOcultos && (
                <>
                  <CartaoKpi rotulo="Faturamento hoje" valor={moeda(consulta.dados.brutoHoje)} />
                  <CartaoKpi rotulo="Faturamento do mês" valor={moeda(consulta.dados.mes.totalBruto)} />
                </>
              )}
              <CartaoKpi rotulo="Fichas" valor={numero(consulta.dados.mes.quantidadeFichas)} />
              <CartaoKpi rotulo="Veículos" valor={numero(consulta.dados.mes.totalCarros)} />
              {!valoresOcultos && (
                <>
                  <CartaoKpi rotulo="Resultado do mês" valor={moeda(consulta.dados.mes.resultado)}
                    dica={`Mês anterior: ${moeda(consulta.dados.resultadoAnterior)}`} tom={consulta.dados.mes.resultado < 0 ? 'danger' : 'success'} />
                  <CartaoKpi rotulo="Despesas totais" valor={moeda(consulta.dados.despesasTotais)} dica="Adicionais e fixas" />
                  <CartaoKpi rotulo="Custos de manobristas" valor={moeda(consulta.dados.custosManobristas)} dica="Registrados nas fichas" />
                  <CartaoKpi rotulo="Pagamentos pendentes" valor={moeda(consulta.dados.pagamentosPendentes)} dica="Diárias reconhecidas pelo mês do trabalho" />
                  <CartaoKpi rotulo="Pagamentos confirmados" valor={moeda(consulta.dados.pagamentosConfirmados)} dica="Pelo mês da baixa registrada" />
                </>
              )}
            </section>

            {!valoresOcultos && consulta.dados.porUnidade.length > 1 && (
              <section className="pf-card">
                <div className="pf-card__head"><h2 className="pf-card__title">Resultado das fichas por unidade</h2></div>
                <div className="pf-table-wrap">
                  <table className="pf-table">
                    <thead><tr><th>Unidade</th><th className="num">Bruto</th><th className="num">Saldo das fichas</th></tr></thead>
                    <tbody>
                      {consulta.dados.porUnidade.map((u) => (
                        <tr key={u.unidadeId}><td>{u.unidade}</td><td className="num">{moeda(u.bruto)}</td><td className="num">{moeda(u.liquido)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </>
        )}

        {valoresOcultos ? (
          <p className="dash__privacidade-nota" role="status">Valores do painel ocultos neste navegador.</p>
        ) : (
          <>
            {/* Gráficos */}
            <section className="dash__graficos">
              <article className="pf-card">
                <div className="pf-card__head">
                  <h2 className="pf-card__title">Valor líquido por dia</h2>
                  <p className="pf-card__subtitle">Últimas fichas do mês</p>
                </div>
                <div className="pf-card__body">
                  <Grafico config={graficoLinha} altura={isMobile ? 200 : 250} rotulo="Valor líquido por dia do mês" />
                </div>
              </article>
              {!isMobile && (
                <article className="pf-card">
                  <div className="pf-card__head">
                    <h2 className="pf-card__title">Evolução — 6 meses</h2>
                    <p className="pf-card__subtitle">Lucro das fichas por mês</p>
                  </div>
                  <div className="pf-card__body">
                    <Grafico config={graficoBarras} altura={250} rotulo="Evolução do lucro líquido nos últimos seis meses" />
                  </div>
                </article>
              )}
            </section>

            {/* Cards informativos */}
            <section className="dash__info">
              {!isMobile && melhorDia && (
                <article className="pf-card info">
                  <p className="info__label">Melhor dia da semana</p>
                  <p className="info__valor">{melhorDia.dia}</p>
                  <p className="info__hint">Maior faturamento — {moeda(melhorDia.total)}</p>
                </article>
              )}
            </section>
          </>
        )}
      </div>
    </pf-dashboard>
  );
}
