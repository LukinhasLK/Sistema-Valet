import { useMemo, useState } from 'react';
import type { ChartConfiguration } from 'chart.js';
import { BarraFiltros, FiltroPilula } from '../../compartilhado/BarraFiltros';
import { CabecalhoPagina } from '../../compartilhado/CabecalhoPagina';
import { CartaoKpi } from '../../compartilhado/CartaoKpi';
import { EsqueletoKpis } from '../../compartilhado/Esqueleto';
import { EstadoVazio } from '../../compartilhado/EstadoVazio';
import { moeda } from '../../compartilhado/formatos';
import { Grafico } from '../../compartilhado/Grafico';
import { AZUL, escalasPadrao, formatarMoeda, opcoesBase } from '../../compartilhado/tema-graficos';
import { useConsulta } from '../../compartilhado/useConsulta';
import { useNivel } from '../../nucleo/estado/auth';
import { useIsMobile } from '../../nucleo/estado/layout';
import { useSocios } from '../../nucleo/estado/socios';
import { MESES, MESES_CURTOS, rotuloPeriodo } from '../../nucleo/servicos/periodo';
import { acumuladoNoAno, sociedadeServico } from '../../nucleo/servicos/sociedade';
import './sociedade.scss';

const NEGATIVO = '#c0392b';

/**
 * Visão do sócio: unidades onde ele tem participação e quanto é a parte dele no resultado.
 * O sócio vê só a si mesmo; o proprietário escolhe qualquer sócio e vê exatamente o que ele vê.
 */
export default function Sociedade() {
  const nivel = useNivel();
  const isMobile = useIsMobile();
  const ehProprietario = nivel === 'Proprietário';
  const socios = useSocios((s) => s.socios);

  const hoje = new Date();
  const mesAtual = hoje.getMonth() + 1;
  const anoAtual = hoje.getFullYear();
  const [mes, setMes] = useState(mesAtual);
  const [ano, setAno] = useState(anoAtual);
  const [socioEscolhido, setSocioEscolhido] = useState<number | null>(null);
  const socioId = ehProprietario ? socioEscolhido ?? socios[0]?.id : undefined;

  const { consulta } = useConsulta(
    async (sinal) => (ehProprietario && !socioId ? null : sociedadeServico.consultar({ mes, ano, socioId }, sinal)),
    [mes, ano, socioId, ehProprietario],
  );
  const dados = consulta.tipo === 'pronta' ? consulta.dados : null;
  const erro = consulta.tipo === 'erro' ? consulta.mensagem : null;

  const anos = useMemo(() => Array.from({ length: 5 }, (_, i) => anoAtual - i), [anoAtual]);
  const periodo = rotuloPeriodo(mes, ano);
  const acumulado = dados ? acumuladoNoAno(dados.meses) : 0;
  const filtrosAtivos = (mes !== mesAtual ? 1 : 0) + (ano !== anoAtual ? 1 : 0);
  const sujeito = ehProprietario ? `Parte de ${dados?.nome ?? '…'}` : 'Sua parte';

  const grafico = useMemo<ChartConfiguration | null>(() => {
    if (!dados) return null;
    const valores = dados.meses.map((m) => m.valor);
    return {
      type: 'bar',
      data: {
        labels: MESES_CURTOS.map((m) => m),
        datasets: [{
          label: 'Parte do sócio',
          data: valores.map((v) => v ?? 0),
          // Mês escolhido em tom escuro; prejuízo em vermelho; meses futuros sem barra.
          backgroundColor: valores.map((v, i) => (v !== null && v < 0 ? NEGATIVO : i + 1 === dados.mes ? AZUL.escuro : AZUL.medio)),
          borderRadius: 4,
          borderSkipped: false,
          maxBarThickness: 40,
        }],
      },
      options: {
        ...opcoesBase(),
        interaction: { mode: 'nearest', intersect: true },
        scales: escalasPadrao(formatarMoeda),
        plugins: {
          ...opcoesBase().plugins,
          tooltip: { ...opcoesBase().plugins!.tooltip, callbacks: {
            title: (itens) => `${MESES[itens[0].dataIndex]} de ${dados.ano}`,
            label: (item) => (valores[item.dataIndex] === null ? 'Mês ainda não começou' : formatarMoeda(item.parsed.y ?? 0)),
          } },
        },
      },
    };
  }, [dados]);

  return (
    <pf-sociedade>
      <div className="pf-page">
        <CabecalhoPagina sobretitulo="Financeiro" titulo={ehProprietario ? 'Sociedade' : 'Minha sociedade'}
          subtitulo={ehProprietario
            ? 'Escolha um sócio e veja exatamente o que ele vê quando entra no sistema.'
            : 'As unidades onde você tem participação e quanto é a sua parte no resultado de cada mês.'} />

        <BarraFiltros ativos={filtrosAtivos} aoLimpar={() => { setMes(mesAtual); setAno(anoAtual); }}>
          {ehProprietario && socios.length > 0 && (
            <FiltroPilula rotulo="Sócio" icone="socios" valor={socioId ?? 0} padrao={socios[0].id}
              opcoes={socios.map((s) => ({ valor: s.id, rotulo: s.nome }))} aoMudar={setSocioEscolhido} />
          )}
          <FiltroPilula rotulo="Mês" icone="eventos" valor={mes} padrao={mesAtual}
            opcoes={MESES.map((nome, i) => ({ valor: i + 1, rotulo: nome }))} aoMudar={setMes} />
          <FiltroPilula rotulo="Ano" valor={ano} padrao={anoAtual}
            opcoes={anos.map((a) => ({ valor: a, rotulo: String(a) }))} aoMudar={setAno} />
        </BarraFiltros>

        {ehProprietario && socios.length === 0 ? (
          <EstadoVazio ilustracao="equipe" titulo="Nenhum sócio cadastrado" texto="Cadastre os sócios em Sócios para ver a sociedade de cada um." />
        ) : erro ? (
          <p className="pf-card vazio pf-error" role="alert">{erro}</p>
        ) : !dados ? (
          <EsqueletoKpis quantidade={3} />
        ) : (
          <>
            <section className="cards-resumo">
              <CartaoKpi rotulo={`${sujeito} em ${periodo}`} icone="lucro" valor={moeda(dados.totalMes)} numero={dados.totalMes} formato={moeda}
                tom={dados.totalMes < 0 ? 'danger' : 'success'}
                dica={dados.mesEmAndamento ? 'Mês em andamento: o valor muda até o fechamento.' : 'Mês fechado.'} />
              <CartaoKpi rotulo={`Acumulado em ${dados.ano}`} icone="relatorios" valor={moeda(acumulado)} numero={acumulado} formato={moeda}
                tom={acumulado < 0 ? 'danger' : 'default'} dica="Soma dos meses até agora" />
              <CartaoKpi rotulo="Unidades com participação" icone="unidades" valor={String(dados.unidades.length)}
                dica={dados.unidades.map((u) => u.nome).join(', ') || 'Nenhuma neste mês'} />
            </section>

            {dados.rateioIncompleto && (
              <p className="aviso-rateio" role="status">
                Em alguma unidade a divisão entre os sócios não soma 100% neste mês. A parte dessa unidade fica de fora até o proprietário ajustar.
              </p>
            )}

            {dados.unidades.length === 0 ? (
              <EstadoVazio ilustracao="equipe" titulo="Sem participação neste mês"
                texto={`${ehProprietario ? dados.nome + ' não tem' : 'Você não tem'} participação em nenhuma unidade em ${periodo}.`} />
            ) : (
              <section className="unidades" aria-label="Participação por unidade">
                {dados.unidades.map((u) => (
                  <article key={u.unidadeId} className="pf-card unidade">
                    <header className="unidade__topo">
                      <h2 className="unidade__nome">{u.nome}</h2>
                      <span className="pf-badge pf-badge--blue">{u.percentual}%</span>
                    </header>
                    <p className="unidade__rotulo">{ehProprietario ? 'Parte do sócio' : 'Sua parte'}</p>
                    <p className={`unidade__valor${u.valor !== null && u.valor < 0 ? ' pf-money--neg' : ''}`}>
                      {u.valor === null ? 'Aguardando rateio' : moeda(u.valor)}
                    </p>
                    <div className="unidade__barra" aria-hidden="true">
                      <span style={{ width: `${Math.min(100, Math.max(0, u.percentual))}%` }} />
                    </div>
                    <dl className="unidade__dados">
                      <div><dt>Resultado da unidade</dt><dd className={u.resultado < 0 ? 'pf-money--neg' : undefined}>{moeda(u.resultado)}</dd></div>
                      <div><dt>Fichas no mês</dt><dd>{u.fichas}</dd></div>
                    </dl>
                  </article>
                ))}
              </section>
            )}

            {grafico && (
              <article className="pf-card evolucao">
                <div className="pf-card__head">
                  <h2 className="pf-card__title">{ehProprietario ? `Parte de ${dados.nome} mês a mês` : 'Sua parte mês a mês'}</h2>
                  <p className="pf-card__subtitle">{dados.ano} · somando todas as unidades</p>
                </div>
                <div className="pf-card__body">
                  <Grafico config={grafico} altura={isMobile ? 200 : 260} rotulo={`Parte do sócio em cada mês de ${dados.ano}`} />
                </div>
              </article>
            )}

            <p className="nota">Resultado = lucro das fichas − despesas fixas da unidade, dividido pelo percentual de cada sócio vigente no mês. Mesma conta da Divisão de Lucro.</p>
          </>
        )}
      </div>
    </pf-sociedade>
  );
}
