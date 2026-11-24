import { FormEvent, useMemo, useState } from 'react';
import { CabecalhoPagina } from '../../compartilhado/CabecalhoPagina';
import { Confirmar } from '../../compartilhado/Confirmar';
import { dataHora } from '../../compartilhado/formatos';
import { Icone } from '../../compartilhado/Icone';
import { Modal } from '../../compartilhado/Modal';
import { useFormulario } from '../../compartilhado/useFormulario';
import { avisos } from '../../nucleo/estado/aviso';
import { useIsMobile } from '../../nucleo/estado/layout';
import { percentualDoSocio, RevisaoRateio, sociosServico, totaisPorUnidade, useSocios } from '../../nucleo/estado/socios';
import { nomeUnidade, useUnidades } from '../../nucleo/estado/unidades';
import { Socio, Unidade } from '../../nucleo/modelos';
import { hojeIso } from '../../nucleo/servicos/periodo';
import './socios.scss';

const MES_ATUAL = hojeIso().slice(0, 7);

export default function Socios() {
  const isMobile = useIsMobile();
  const socios = useSocios((s) => s.socios);
  const unidades = useUnidades((s) => s.unidades);
  const totais = useMemo(() => totaisPorUnidade(socios, unidades), [socios, unidades]);

  const [formAberto, setFormAberto] = useState(false);
  const [editando, setEditando] = useState<Socio | null>(null);
  const [paraExcluir, setParaExcluir] = useState<Socio | null>(null);
  const f = useFormulario({ nome: '' }, (v) => ({ nome: !v.nome }));

  const [rateando, setRateando] = useState<Unidade | null>(null);
  const [vigencia, setVigencia] = useState(MES_ATUAL);
  const [cotas, setCotas] = useState<Partial<Record<number, number>>>({});
  const [revisoes, setRevisoes] = useState<RevisaoRateio[]>([]);
  const [carregandoRateio, setCarregandoRateio] = useState(false);
  const [erroRateio, setErroRateio] = useState(false);
  const [salvandoRateio, setSalvandoRateio] = useState(false);
  const somaRateio = Object.values(cotas).reduce<number>((total, pct) => total + Math.round((pct ?? 0) * 100), 0) / 100;

  async function abrirRateio(unidade: Unidade) {
    setRateando(unidade);
    setVigencia(MES_ATUAL);
    setCotas({});
    setRevisoes([]);
    setCarregandoRateio(true);
    setErroRateio(false);
    try {
      const [lista, historico] = await Promise.all([
        sociosServico.listarCotas(unidade.id, hojeIso()),
        sociosServico.historicoRateio(unidade.id),
      ]);
      setCotas(Object.fromEntries(lista.map((c) => [c.socioId, c.percentual])));
      setRevisoes(historico);
    } catch (erro) {
      setErroRateio(true);
      avisos.erro(erro);
    } finally {
      setCarregandoRateio(false);
    }
  }

  async function salvarRateio(evento: FormEvent) {
    evento.preventDefault();
    if (!rateando || !vigencia || salvandoRateio || somaRateio !== 100) return;
    const partes = socios.map((socio) => ({ socioId: socio.id, percentual: cotas[socio.id] ?? 0 })).filter((p) => p.percentual > 0);
    setSalvandoRateio(true);
    try {
      await sociosServico.configurarRateio(rateando.id, `${vigencia}-01`, partes);
      setRateando(null);
      avisos.sucesso('Rateio registrado para o mês selecionado.');
    } catch (erro) {
      avisos.erro(erro);
    } finally {
      setSalvandoRateio(false);
    }
  }

  function abrir(socio?: Socio) {
    setEditando(socio ?? null);
    f.resetar({ nome: socio?.nome ?? '' });
    setFormAberto(true);
  }

  async function salvar(evento: FormEvent) {
    evento.preventDefault();
    if (!f.valido) {
      f.tocarTodos();
      return;
    }
    try {
      await sociosServico.salvarSocio({ id: editando?.id, nome: f.valores.nome });
      setFormAberto(false);
      avisos.sucesso('Sócio salvo.');
    } catch (erro) {
      avisos.erro(erro);
    }
  }

  async function confirmarExclusao() {
    const socio = paraExcluir;
    setParaExcluir(null);
    if (!socio) return;
    try {
      await sociosServico.excluir(socio.id);
      avisos.sucesso('Sócio excluído.');
    } catch (erro) {
      avisos.erro(erro);
    }
  }

  const participacoes = (socio: Socio) => socio.percentuais.filter((p) => p.percentual > 0);

  return (
    <pf-socios>
      <div className="pf-page">
        <CabecalhoPagina titulo="Sócios" subtitulo="Porcentagem de cada sócio por estabelecimento">
          <button type="button" className="pf-btn pf-btn--primary" onClick={() => abrir()}>
            <Icone nome="plus" tamanho={17} />
            Novo sócio
          </button>
        </CabecalhoPagina>

        {/* Validação do rateio por unidade */}
        <div className="validacao">
          {unidades.map((u, i) => {
            const t = totais[i];
            const classes = ['pf-btn pf-btn--ghost validacao__item', !t.valido && !t.vazia && 'validacao__item--erro', t.vazia && 'validacao__item--vazia'];
            return (
              <button key={u.id} type="button" onClick={() => abrirRateio(u)} className={classes.filter(Boolean).join(' ')}>
                <Icone nome={t.valido ? 'check' : 'alerta'} tamanho={14} />
                {t.unidade} · {t.vazia ? 'sem rateio' : `${t.total}%`}
              </button>
            );
          })}
        </div>

        {socios.length === 0 ? (
          <div className="pf-card vazio">
            <p className="vazio__titulo">Nenhum sócio cadastrado</p>
            <p className="vazio__texto">Cadastre os sócios para que o app calcule a divisão do lucro.</p>
          </div>
        ) : isMobile ? (
          <div className="cards">
            {socios.map((s) => (
              <article key={s.id} className="pf-card card-socio">
                <p className="card-socio__nome">{s.nome}</p>
                <button type="button" className="acao" onClick={() => abrir(s)} aria-label={`Editar ${s.nome}`}>Editar</button>
                {participacoes(s).length ? (
                  <ul className="card-socio__lista">
                    {participacoes(s).map((p) => (
                      <li key={p.unidadeId}><span>{nomeUnidade(unidades, p.unidadeId)}</span><span className="pf-badge pf-badge--gray">{p.percentual}%</span></li>
                    ))}
                  </ul>
                ) : <p className="card-socio__vazio">Sem participação ativa.</p>}
              </article>
            ))}
          </div>
        ) : (
          <div className="pf-card tabela">
            <div className="pf-table-wrap">
              <table className="pf-table">
                <thead>
                  <tr>
                    <th>Nome</th>
                    {unidades.map((u) => <th key={u.id} className="num">{u.nome}</th>)}
                    <th className="actions">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {socios.map((s) => (
                    <tr key={s.id}>
                      <td className="forte">{s.nome}</td>
                      {unidades.map((u) => {
                        const pct = percentualDoSocio(s, u.id);
                        return <td key={u.id} className="num">{pct ? <span className="pf-badge pf-badge--gray">{pct}%</span> : <span className="tracinho">—</span>}</td>;
                      })}
                      <td className="actions">
                        <button type="button" className="acao" onClick={() => abrir(s)}>Editar</button>
                        <button type="button" className="acao acao--danger" onClick={() => setParaExcluir(s)}>Excluir</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {formAberto && (
        <Modal titulo={editando ? 'Editar sócio' : 'Novo sócio'} aoFechar={() => setFormAberto(false)}>
          <form className="modal-form" onSubmit={salvar} noValidate>
            <div className="pf-field">
              <label className="pf-label" htmlFor="s-nome">Nome</label>
              <input id="s-nome" type="text" {...f.campo('nome')} />
              {f.invalido('nome') && <span className="pf-error">Informe o nome.</span>}
            </div>
            <p className="modal-form__nota">Configure os percentuais no botão de cada unidade.</p>
            <div className="modal-form__acoes">
              <button type="button" className="pf-btn pf-btn--ghost" onClick={() => setFormAberto(false)}>Cancelar</button>
              <button type="submit" className="pf-btn pf-btn--primary">Salvar</button>
            </div>
          </form>
        </Modal>
      )}

      {paraExcluir && (
        <Confirmar mensagem={`${paraExcluir.nome} será removido se não houver participações no histórico.`}
          aoConfirmar={confirmarExclusao} aoCancelar={() => setParaExcluir(null)} />
      )}

      {rateando && (
        <Modal titulo={`Rateio · ${rateando.nome}`} aoFechar={() => setRateando(null)}>
          {carregandoRateio ? (
            <p role="status">Carregando rateio…</p>
          ) : erroRateio ? (
            <button type="button" className="pf-btn pf-btn--ghost" onClick={() => abrirRateio(rateando)}>Tentar novamente</button>
          ) : (
            <form className="modal-form" onSubmit={salvarRateio}>
              <p className="modal-form__nota">O total deve somar 100%. A versão se aplica a partir do mês escolhido.</p>
              <div className="pf-field">
                <label className="pf-label" htmlFor="vigencia-rateio">Mês de início</label>
                <input id="vigencia-rateio" className="pf-input" type="month" required min={MES_ATUAL}
                  value={vigencia} onChange={(e) => setVigencia(e.target.value)} name="vigencia" />
              </div>
              <div className="percentuais">
                {socios.length ? socios.map((socio) => (
                  <div key={socio.id} className="percentuais__linha">
                    <label className="pf-label" htmlFor={`cota-rateio-${socio.id}`}>{socio.nome}</label>
                    <input className="pf-input" id={`cota-rateio-${socio.id}`} name={`cota-${socio.id}`}
                      type="number" min={0} max={100} step={0.01} inputMode="decimal"
                      value={cotas[socio.id] ?? 0}
                      onChange={(e) => setCotas((c) => ({ ...c, [socio.id]: e.target.value === '' ? 0 : Number(e.target.value) }))} />
                  </div>
                )) : <p>Cadastre pelo menos um sócio para configurar o rateio.</p>}
              </div>
              <p role="status">Total informado: {somaRateio}%</p>
              {revisoes.length > 0 && (
                <div>
                  <h3 className="modal-form__secao">Vigências registradas</h3>
                  <ul className="previa">
                    {revisoes.map((r) => <li key={r.id}>{dataHora(r.vigenteDesde, 'MM/yyyy', 'UTC')} · {r.autor}</li>)}
                  </ul>
                </div>
              )}
              <div className="modal-form__acoes">
                <button type="button" className="pf-btn pf-btn--ghost" onClick={() => setRateando(null)}>Cancelar</button>
                <button type="submit" className="pf-btn pf-btn--primary" disabled={somaRateio !== 100 || !vigencia || salvandoRateio}>
                  {salvandoRateio ? 'Salvando…' : 'Salvar distribuição'}
                </button>
              </div>
            </form>
          )}
        </Modal>
      )}
    </pf-socios>
  );
}
