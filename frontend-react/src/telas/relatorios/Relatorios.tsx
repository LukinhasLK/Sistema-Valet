import { useMemo, useState } from 'react';
import { CabecalhoPagina } from '../../compartilhado/CabecalhoPagina';
import { CartaoKpi } from '../../compartilhado/CartaoKpi';
import { dataBr, moeda } from '../../compartilhado/formatos';
import { Icone } from '../../compartilhado/Icone';
import { useConsulta } from '../../compartilhado/useConsulta';
import { avisos } from '../../nucleo/estado/aviso';
import { useDespesas } from '../../nucleo/estado/despesas';
import { anosDisponiveis, periodoReferencia, useFichas } from '../../nucleo/estado/fichas';
import { useIsMobile } from '../../nucleo/estado/layout';
import { useUnidades } from '../../nucleo/estado/unidades';
import { baixarArquivo } from '../../nucleo/servicos/download';
import { rotuloPeriodo, TODAS_UNIDADES } from '../../nucleo/servicos/periodo';
import { FiltroRelatorio, relatoriosServico } from '../../nucleo/servicos/relatorios';
import { EstadoVazio } from '../../compartilhado/EstadoVazio';
import { EsqueletoKpis, EsqueletoLista } from '../../compartilhado/Esqueleto';
import { useFiltroPeriodo } from '../../compartilhado/useFiltroPeriodo';
import { BarraFiltros } from '../../compartilhado/BarraFiltros';
import './relatorios.scss';

const classeSaldo = (valor: number) => (valor < 0 ? 'pf-money--neg' : 'pf-money--pos');
const classeTurno = (turno: string) => `pf-badge ${turno === 'dia' ? 'pf-badge--blue' : 'pf-badge--night'}`;

export default function Relatorios() {
  const isMobile = useIsMobile();
  const fichas = useFichas((s) => s.fichas);
  const despesas = useDespesas((s) => s.despesas);
  const unidades = useUnidades((s) => s.unidades);
  const anos = useMemo(() => anosDisponiveis(fichas, despesas), [fichas, despesas]);
  const referencia = useMemo(() => periodoReferencia(fichas), [fichas]);
  const periodo = useFiltroPeriodo({
    mesPadrao: referencia.mes, anoPadrao: referencia.ano, anos, rotuloTodosMeses: 'Ano inteiro',
    unidades, rotuloTodasUnidades: 'Consolidado',
  });
  const { mes, ano, unidadeId } = periodo;
  const [exportando, setExportando] = useState<'pdf' | 'excel' | null>(null);
  const periodoLabel = rotuloPeriodo(mes, ano);

  const filtro = useMemo<FiltroRelatorio>(
    () => ({ ano, ...(mes ? { mes } : {}), ...(unidadeId !== TODAS_UNIDADES ? { unidadeId } : {}) }),
    [mes, ano, unidadeId],
  );
  const { consulta, tentarNovamente } = useConsulta((sinal) => relatoriosServico.financeiro(filtro, sinal), [filtro]);

  async function exportar(formato: 'pdf' | 'excel') {
    if (consulta.tipo !== 'pronta' || exportando) return;
    setExportando(formato);
    try {
      const arquivo = await (formato === 'pdf' ? relatoriosServico.pdf(filtro) : relatoriosServico.excel(filtro));
      baixarArquivo(arquivo, `parkflash-financeiro-${consulta.dados.inicio}.${formato === 'pdf' ? 'pdf' : 'xlsx'}`);
    } catch (erro) {
      avisos.erro(erro);
    } finally {
      setExportando(null);
    }
  }

  const bloqueado = consulta.tipo !== 'pronta' || exportando !== null;

  return (
    <pf-relatorios>
      <div className="pf-page relatorio">
        <CabecalhoPagina titulo="Relatórios" subtitulo="Visão geral financeira por período">
          <button type="button" className="pf-btn pf-btn--ghost nao-imprimir" disabled={bloqueado} onClick={() => exportar('pdf')}>
            <Icone nome="baixar" tamanho={17} />
            {exportando === 'pdf' ? 'Gerando PDF…' : 'Baixar PDF'}
          </button>
          <button type="button" className="pf-btn pf-btn--ghost nao-imprimir" disabled={bloqueado} onClick={() => exportar('excel')}>
            <Icone nome="baixar" tamanho={17} />
            {exportando === 'excel' ? 'Gerando Excel…' : 'Baixar Excel'}
          </button>
        </CabecalhoPagina>

        <BarraFiltros ativos={periodo.ativos} aoLimpar={periodo.limpar}>
          {periodo.etiquetas}
        </BarraFiltros>

        {consulta.tipo === 'carregando' ? (
          <><EsqueletoKpis quantidade={5} /><div style={{ marginTop: 16 }}><EsqueletoLista linhas={6} rotulo="Carregando relatório…" /></div></>
        ) : consulta.tipo === 'erro' ? (
          <div className="pf-card vazio">
            <p className="pf-error" role="alert">{consulta.mensagem}</p>
            <button type="button" className="pf-btn pf-btn--ghost" onClick={tentarNovamente}>Tentar novamente</button>
          </div>
        ) : (() => {
          const relatorio = consulta.dados;
          const resumo = relatorio.resumo;
          return (
            <>
              <p className="periodo">{periodoLabel} · {relatorio.unidade}</p>
              <section className="cards-resumo">
                <CartaoKpi rotulo="Receita total" icone="dinheiro" valor={moeda(resumo.totalBruto)} numero={resumo.totalBruto} formato={moeda} dica={periodoLabel} />
                <CartaoKpi rotulo="Custos das fichas" icone="manobristas" valor={moeda(relatorio.custosFichas)} numero={relatorio.custosFichas} formato={moeda} dica="diárias, taxas e gastos da ficha" tom="danger" />
                <CartaoKpi rotulo="Lucro das fichas" valor={moeda(resumo.lucroFichas)} dica={`${resumo.quantidadeFichas} fichas no período`}
                  tom={resumo.lucroFichas >= 0 ? 'success' : 'danger'} />
                <CartaoKpi rotulo="Despesas fixas" icone="despesas" valor={moeda(resumo.despesasFixas)} numero={resumo.despesasFixas} formato={moeda} dica="aluguel, seguro, manutenção" tom="danger" />
                <CartaoKpi rotulo="Resultado do período" valor={moeda(resumo.resultado)} dica="lucro das fichas − despesas fixas"
                  tom={resumo.resultado >= 0 ? 'success' : 'danger'} />
              </section>

              {relatorio.linhas.length === 0 ? (
                <EstadoVazio ilustracao="fichas" titulo="Nenhuma ficha neste período"
                  texto={resumo.despesasFixas > 0
                    ? `O resultado de ${moeda(resumo.resultado)} vem só das despesas fixas (${moeda(resumo.despesasFixas)}).`
                    : 'Escolha outro mês, ano ou unidade.'} />
              ) : isMobile ? (
                <div className="cards">
                  {relatorio.linhas.map((linha) => (
                    <article key={linha.id} className="pf-card card-rel">
                      <div className="card-rel__topo">
                        <span className="card-rel__data">{dataBr(linha.data)}</span>
                        <span className={classeTurno(linha.turno)}>{linha.turno === 'dia' ? 'Dia' : 'Noite'}</span>
                      </div>
                      <p className="card-rel__unidade">{linha.unidade}</p>
                      <div className="card-rel__linha"><span>Receita</span><span>{moeda(linha.bruto)}</span></div>
                      <div className="card-rel__linha"><span>Custos</span><span>{moeda(linha.custos)}</span></div>
                      <div className="card-rel__linha card-rel__linha--forte">
                        <span>Saldo</span>
                        <span className={classeSaldo(linha.liquido)}>{moeda(linha.liquido)}</span>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="pf-card tabela">
                  <div className="pf-table-wrap">
                    <table className="pf-table">
                      <thead>
                        <tr><th>Data</th><th>Turno</th><th>Unidade</th><th className="num">Receita</th><th className="num">Custos</th><th className="num">Saldo</th></tr>
                      </thead>
                      <tbody>
                        {relatorio.linhas.map((linha) => (
                          <tr key={linha.id}>
                            <td>{dataBr(linha.data)}</td>
                            <td><span className={classeTurno(linha.turno)}>{linha.turno === 'dia' ? 'Dia' : 'Noite'}</span></td>
                            <td>{linha.unidade}</td>
                            <td className="num">{moeda(linha.bruto)}</td>
                            <td className="num">{moeda(linha.custos)}</td>
                            <td className={`num ${classeSaldo(linha.liquido)}`}>{moeda(linha.liquido)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan={3}>Total do período</td>
                          <td className="num">{moeda(resumo.totalBruto)}</td>
                          <td className="num">{moeda(relatorio.custosFichas)}</td>
                          <td className={`num ${classeSaldo(resumo.lucroFichas)}`}>{moeda(resumo.lucroFichas)}</td>
                        </tr>
                        <tr>
                          <td colSpan={5}>(−) Despesas fixas do período</td>
                          <td className="num pf-money--neg">{moeda(resumo.despesasFixas)}</td>
                        </tr>
                        <tr>
                          <td colSpan={5}>Resultado do período</td>
                          <td className={`num ${classeSaldo(resumo.resultado)}`}>{moeda(resumo.resultado)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}
            </>
          );
        })()}
      </div>
    </pf-relatorios>
  );
}
