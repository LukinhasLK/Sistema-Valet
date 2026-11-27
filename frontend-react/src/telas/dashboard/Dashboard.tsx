import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ChartConfiguration } from 'chart.js';
import { AnimatePresence, motion } from 'motion/react';
import { BarraFiltros } from '../../compartilhado/BarraFiltros';
import { CartaoKpi } from '../../compartilhado/CartaoKpi';
import { EsqueletoKpis } from '../../compartilhado/Esqueleto';
import { TRANSICAO } from '../../compartilhado/movimento';
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
import { useFiltroPeriodo } from '../../compartilhado/useFiltroPeriodo';
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

  const filtroPeriodo = useFiltroPeriodo({
    mesPadrao: mesDe(hojeIso()), anoPadrao: anoDe(hojeIso()), anos, unidades, rotuloTodasUnidades: 'Autorizadas',
  });
  const { mes, ano, unidadeId } = filtroPeriodo;
  const chaveValores = `parkflash.painel.ocultar-valores.${usuario?.id}`;
  const [valoresOcultos, setValoresOcultos] = useState(() => carregar(chaveValores, false));
  const [alertasAbertos, setAlertasAbertos] = useState(false);
  const primeiroNome = usuario?.nome.split(' ')[0] ?? '';
  const hora = new Date().getHours();
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
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
            <h1 className="dash__saudacao">{saudacao}, {primeiroNome}</h1>
          </div>
          <div className="dash__acoes">
            <Link className="pf-btn pf-btn--primary" to="/app/fichas/nova">
              <Icone nome="plus" tamanho={17} />
              Nova ficha
            </Link>
            <div className="dash__alertas">
              <button type="button" className="pf-btn pf-btn--ghost dash__pendencias"
                aria-expanded={alertasAbertos} onClick={() => setAlertasAbertos((a) => !a)}
                onKeyDown={(e) => { if (e.key === 'Escape') setAlertasAbertos(false); }}>
                <Icone nome="sino" tamanho={16} />
                Alertas {alertas.length > 0 && <span className="dash__contador" aria-hidden="true">{alertas.length}</span>}
              </button>
              <AnimatePresence>
              {alertasAbertos && (
                <motion.div className="alertas" role="region" aria-label="Alertas do período"
                  initial={{ opacity: 0, y: -6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4, transition: TRANSICAO.saida }} transition={TRANSICAO.mola}
                  onKeyDown={(e) => { if (e.key === 'Escape') setAlertasAbertos(false); }}>
                  <p className="alertas__titulo">Alertas do período</p>
                  {alertas.length ? alertas.map((alerta) => (
                    <Link key={alerta.texto} className="alertas__item" to={alerta.rota} onClick={() => setAlertasAbertos(false)}>{alerta.texto}</Link>
                  )) : <p className="alertas__vazio"><Icone nome="sucesso" tamanho={16} />Nenhum alerta. Tudo em dia!</p>}
                </motion.div>
              )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        <BarraFiltros ativos={filtroPeriodo.ativos} aoLimpar={filtroPeriodo.limpar} extra={
          <button type="button" className="pf-btn pf-btn--quiet pf-btn--sm dash__privacidade" aria-pressed={valoresOcultos} onClick={alternarValores}>
            <Icone nome={valoresOcultos ? 'ver' : 'ocultar'} tamanho={15} />
            {valoresOcultos ? 'Mostrar valores' : 'Ocultar valores'}
          </button>
        }>
          {filtroPeriodo.etiquetas}
        </BarraFiltros>

        {consulta.tipo === 'carregando' ? (
          <EsqueletoKpis />
        ) : consulta.tipo === 'erro' ? (
          <>
            <p className="pf-error" role="alert">{consulta.mensagem}</p>
            <button type="button" className="pf-btn pf-btn--ghost" onClick={tentarNovamente}>Tentar novamente</button>
          </>
        ) : (
          <>
            <section className="pf-grid-kpi" data-tour="kpis-dashboard">
              {!valoresOcultos && (
                <>
                  <CartaoKpi rotulo="Faturamento hoje" icone="dinheiro" valor={moeda(consulta.dados.brutoHoje)} numero={consulta.dados.brutoHoje} formato={moeda} />
                  <CartaoKpi rotulo="Faturamento do mês" icone="dinheiro" valor={moeda(consulta.dados.mes.totalBruto)} numero={consulta.dados.mes.totalBruto} formato={moeda} />
                </>
              )}
              <CartaoKpi rotulo="Fichas" icone="fichas" valor={numero(consulta.dados.mes.quantidadeFichas)} numero={consulta.dados.mes.quantidadeFichas} formato={numero} />
              <CartaoKpi rotulo="Veículos" icone="carros" valor={numero(consulta.dados.mes.totalCarros)} numero={consulta.dados.mes.totalCarros} formato={numero} />
              {!valoresOcultos && (
                <>
                  <CartaoKpi rotulo="Resultado do mês" icone="tendencia" valor={moeda(consulta.dados.mes.resultado)} numero={consulta.dados.mes.resultado} formato={moeda}
                    dica={`Mês anterior: ${moeda(consulta.dados.resultadoAnterior)}`} tom={consulta.dados.mes.resultado < 0 ? 'danger' : 'success'} />
                  <CartaoKpi rotulo="Despesas totais" icone="despesas" valor={moeda(consulta.dados.despesasTotais)} numero={consulta.dados.despesasTotais} formato={moeda} dica="Adicionais e fixas" />
                  <CartaoKpi rotulo="Custos de manobristas" icone="manobristas" valor={moeda(consulta.dados.custosManobristas)} numero={consulta.dados.custosManobristas} formato={moeda} dica="Registrados nas fichas" />
                  <CartaoKpi rotulo="Pagamentos pendentes" icone="relogio" valor={moeda(consulta.dados.pagamentosPendentes)} numero={consulta.dados.pagamentosPendentes} formato={moeda} dica="Diárias reconhecidas pelo mês do trabalho" />
                  <CartaoKpi rotulo="Pagamentos confirmados" icone="sucesso" valor={moeda(consulta.dados.pagamentosConfirmados)} numero={consulta.dados.pagamentosConfirmados} formato={moeda} dica="Pelo mês da baixa registrada" />
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
