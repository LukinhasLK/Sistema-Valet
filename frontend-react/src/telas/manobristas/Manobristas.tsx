import { FormEvent, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CabecalhoPagina } from '../../compartilhado/CabecalhoPagina';
import { Confirmar } from '../../compartilhado/Confirmar';
import { moeda } from '../../compartilhado/formatos';
import { Icone } from '../../compartilhado/Icone';
import { cpfValido, telefoneValido } from '../../compartilhado/mascara';
import { Modal } from '../../compartilhado/Modal';
import { Paginacao, usePaginar } from '../../compartilhado/Paginacao';
import { useFormulario } from '../../compartilhado/useFormulario';
import { corDoAvatar } from '../../layout/itens-menu';
import { useNivel } from '../../nucleo/estado/auth';
import { avisos } from '../../nucleo/estado/aviso';
import { useDespesas } from '../../nucleo/estado/despesas';
import { anosDisponiveis, diariasPorManobrista, periodoReferencia, useFichas } from '../../nucleo/estado/fichas';
import { useIsMobile } from '../../nucleo/estado/layout';
import { manobristasServico, useManobristas } from '../../nucleo/estado/manobristas';
import { Manobrista } from '../../nucleo/modelos';
import type { TipoPix } from '../../nucleo/servicos/pagamentos-manobristas';
import { MESES, rotuloPeriodo } from '../../nucleo/servicos/periodo';
import { podeAcessar } from '../../nucleo/servicos/permissoes';
import { PixManobrista } from '../pagamentos-manobristas/PixManobrista';
import './manobristas.scss';

const fichasDe = (id: number, mes: number, ano: number) => `/app/fichas?manobristaId=${id}&mes=${mes}&ano=${ano}`;

export default function Manobristas() {
  const isMobile = useIsMobile();
  const nivel = useNivel();
  const fichas = useFichas((s) => s.fichas);
  const despesas = useDespesas((s) => s.despesas);
  const manobristas = useManobristas((s) => s.manobristas);
  const [mes, setMes] = useState(() => periodoReferencia(fichas).mes);
  const [ano, setAno] = useState(() => periodoReferencia(fichas).ano);
  const anos = useMemo(() => anosDisponiveis(fichas, despesas), [fichas, despesas]);
  const periodo = rotuloPeriodo(mes, ano);
  const podeVerPagamentos = podeAcessar(nivel, 'pagamentos-manobristas');
  const podeGerenciar = nivel === 'Proprietário';

  /** Dias e diárias vêm das fichas do período escolhido; o cadastro só guarda dados pessoais. */
  const linhas = useMemo(() => {
    const lancamentos = diariasPorManobrista(fichas, mes, ano);
    return manobristas.map((m) => {
      const doMes = lancamentos.get(m.id);
      return { ...m, diasNoMes: doMes?.dias ?? 0, custoDiarias: doMes?.total ?? 0, inicial: m.nome.charAt(0).toUpperCase(), cor: corDoAvatar(m.nome) };
    });
  }, [fichas, manobristas, mes, ano]);
  const paginacao = usePaginar(linhas);

  const [formAberto, setFormAberto] = useState(false);
  const [editando, setEditando] = useState<Manobrista | null>(null);
  const [paraDesativar, setParaDesativar] = useState<Manobrista | null>(null);
  const f = useFormulario(
    { nome: '', telefone: '', cpf: '', tipoPix: 'CPF' as TipoPix, chavePix: '', ativo: true, observacoes: '' },
    (v) => ({ nome: !v.nome, telefone: !telefoneValido(v.telefone), cpf: !cpfValido(v.cpf), observacoes: v.observacoes.length > 500 }),
  );

  function abrir(manobrista?: Manobrista) {
    setEditando(manobrista ?? null);
    f.resetar({
      nome: manobrista?.nome ?? '', telefone: manobrista?.telefone ?? '', cpf: manobrista?.cpf ?? '',
      tipoPix: 'CPF', chavePix: '', ativo: manobrista?.ativo ?? true, observacoes: manobrista?.observacoes ?? '',
    });
    setFormAberto(true);
  }

  async function salvar(evento: FormEvent) {
    evento.preventDefault();
    if (!f.valido) {
      f.tocarTodos();
      return;
    }
    try {
      const { tipoPix, chavePix, ...cadastro } = f.valores;
      await manobristasServico.salvarManobrista({
        ...cadastro,
        pix: podeGerenciar && !editando && chavePix.trim() ? { tipo: tipoPix, chave: chavePix.trim() } : undefined,
        id: editando?.id,
      });
      setFormAberto(false);
      avisos.sucesso('Manobrista salvo.');
    } catch (erro) {
      avisos.erro(erro);
    }
  }

  async function confirmarDesativacao() {
    const manobrista = paraDesativar;
    setParaDesativar(null);
    if (!manobrista) return;
    try {
      await manobristasServico.desativar(manobrista.id);
      avisos.sucesso('Manobrista desativado.');
    } catch (erro) {
      avisos.erro(erro);
    }
  }

  return (
    <pf-manobristas>
      <div className="pf-page">
        <CabecalhoPagina titulo="Manobristas" subtitulo="Cadastro dos manobristas">
          <button type="button" className="pf-btn pf-btn--primary" onClick={() => abrir()}>
            <Icone nome="plus" tamanho={17} />
            Novo manobrista
          </button>
          {podeVerPagamentos && <Link className="pf-btn pf-btn--ghost" to="/app/pagamentos-manobristas">Pagamentos</Link>}
        </CabecalhoPagina>

        <div className="pf-filters">
          <select className="pf-select" value={mes} onChange={(e) => setMes(+e.target.value)} aria-label="Mês">
            {MESES.map((nome, i) => <option key={nome} value={i + 1}>{nome}</option>)}
          </select>
          <select className="pf-select" value={ano} onChange={(e) => setAno(+e.target.value)} aria-label="Ano">
            {anos.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>

        {linhas.length === 0 ? (
          <div className="pf-card vazio">
            <p className="vazio__titulo">Nenhum manobrista cadastrado</p>
            <p className="vazio__texto">Cadastre a equipe para lançar custos nas fichas.</p>
          </div>
        ) : isMobile ? (
          <div className="cards">
            {paginacao.visiveis.map((m) => (
              <article key={m.id} className="pf-card card-mano">
                <span className="pf-avatar" style={{ background: m.cor }}>{m.inicial}</span>
                <div className="card-mano__info">
                  <p className="card-mano__nome">{m.nome}</p>
                  {m.ativo === false && <span className="pf-badge pf-badge--gray">Inativo</span>}
                  <p className="card-mano__meta">{m.diasNoMes} {m.diasNoMes === 1 ? 'dia' : 'dias'} em {periodo}</p>
                </div>
                <p className="card-mano__valor">{moeda(m.custoDiarias)}</p>
                <div className="card-mano__acoes">
                  <Link className="acao" to={fichasDe(m.id, mes, ano)} aria-label={`Ver fichas de ${m.nome}`}>Ver fichas</Link>
                  {podeGerenciar && <button type="button" className="acao" onClick={() => abrir(m)} aria-label={`Editar ${m.nome}`}>Editar</button>}
                </div>
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
                    {podeGerenciar && <><th>Telefone</th><th>CPF</th></>}
                    <th className="num">Dias no mês</th>
                    <th className="num">Custo registrado</th>
                    <th className="actions">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {paginacao.visiveis.map((m) => (
                    <tr key={m.id}>
                      <td>
                        <span className="celula-nome">
                          <span className="pf-avatar" style={{ background: m.cor }}>{m.inicial}</span>
                          {m.nome}
                          {m.ativo === false && <span className="pf-badge pf-badge--gray">Inativo</span>}
                        </span>
                      </td>
                      {podeGerenciar && <><td>{m.telefone || '—'}</td><td>{m.cpf || '—'}</td></>}
                      <td className="num">{m.diasNoMes}</td>
                      <td className="num">{moeda(m.custoDiarias)}</td>
                      <td className="actions">
                        <Link className="acao" to={fichasDe(m.id, mes, ano)} aria-label={`Ver fichas de ${m.nome}`}>Ver fichas</Link>
                        {podeGerenciar && (
                          <>
                            <button type="button" className="acao" onClick={() => abrir(m)}>Editar</button>
                            {m.ativo !== false && <button type="button" className="acao acao--danger" onClick={() => setParaDesativar(m)}>Desativar</button>}
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        <Paginacao pagina={paginacao.pagina} paginas={paginacao.paginas} aoSelecionar={paginacao.setPagina} />
      </div>

      {formAberto && (
        <Modal titulo={editando ? 'Editar manobrista' : 'Novo manobrista'} aoFechar={() => setFormAberto(false)}>
          <form className="modal-form" onSubmit={salvar} noValidate>
            <div className="pf-field">
              <label className="pf-label" htmlFor="m-nome">Nome</label>
              <input id="m-nome" type="text" {...f.campo('nome')} />
              {f.invalido('nome') && <span className="pf-error">Informe o nome.</span>}
            </div>
            <div className="pf-field">
              <label className="pf-label" htmlFor="m-telefone">Telefone</label>
              <input id="m-telefone" type="tel" placeholder="(11) 90000-0000" {...f.campo('telefone', { mascara: 'telefone' })} />
              {f.invalido('telefone') && <span className="pf-error">Telefone com DDD (10 ou 11 dígitos).</span>}
            </div>
            <div className="pf-field">
              <label className="pf-label" htmlFor="m-cpf">CPF</label>
              <input id="m-cpf" type="text" inputMode="numeric" placeholder="000.000.000-00" {...f.campo('cpf', { mascara: 'cpf' })} />
              {f.invalido('cpf') && <span className="pf-error">CPF inválido.</span>}
            </div>

            {podeGerenciar && (
              <>
                {editando && <label className="pf-label"><input {...f.marcador('ativo')} /> Manobrista ativo</label>}
                <div className="pf-field">
                  <label className="pf-label" htmlFor="mano-observacoes">Observações operacionais</label>
                  <textarea id="mano-observacoes" maxLength={500} rows={3} {...f.campo('observacoes')} />
                </div>
              </>
            )}
            {podeGerenciar && !editando && (
              <>
                <label className="pf-field"><span className="pf-label">Tipo de chave Pix</span>
                  <select {...f.campo('tipoPix')} className="pf-select">
                    <option value="CPF">CPF</option><option value="CNPJ">CNPJ</option><option value="TELEFONE">Telefone</option>
                    <option value="EMAIL">E-mail</option><option value="ALEATORIA">Chave aleatória</option>
                  </select>
                </label>
                <label className="pf-field"><span className="pf-label">Chave Pix (opcional)</span>
                  <input {...f.campo('chavePix')} maxLength={254} autoComplete="off" spellCheck={false} />
                </label>
              </>
            )}
            {podeVerPagamentos && editando && <PixManobrista manobristaId={editando.id} />}
            <p className="modal-form__nota">Dias trabalhados e custo das diárias vêm das fichas do mês.</p>
            {podeVerPagamentos && editando && (
              <Link className="pf-link-btn" to={`/app/pagamentos-manobristas?manobristaId=${editando.id}&aba=historico`}>
                Consultar Pix e histórico de pagamentos
              </Link>
            )}
            <div className="modal-form__acoes">
              <button type="button" className="pf-btn pf-btn--ghost" onClick={() => setFormAberto(false)}>Cancelar</button>
              <button type="submit" className="pf-btn pf-btn--primary">Salvar</button>
            </div>
          </form>
        </Modal>
      )}

      {paraDesativar && (
        <Confirmar mensagem={`${paraDesativar.nome} ficará indisponível para novos lançamentos e escalas. O histórico será preservado.`}
          aoConfirmar={confirmarDesativacao} aoCancelar={() => setParaDesativar(null)} />
      )}
    </pf-manobristas>
  );
}
