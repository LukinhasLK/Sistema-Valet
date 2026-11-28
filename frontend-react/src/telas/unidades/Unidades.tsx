import { FormEvent, useState } from 'react';
import { CabecalhoPagina } from '../../compartilhado/CabecalhoPagina';
import { Confirmar } from '../../compartilhado/Confirmar';
import { HistoricoAdministrativo } from '../../compartilhado/HistoricoAdministrativo';
import { Icone } from '../../compartilhado/Icone';
import { telefoneValido } from '../../compartilhado/mascara';
import { Modal } from '../../compartilhado/Modal';
import { useFormulario } from '../../compartilhado/useFormulario';
import { mensagemDeErro } from '../../nucleo/servicos/api';
import { avisos } from '../../nucleo/estado/aviso';
import { useIsMobile } from '../../nucleo/estado/layout';
import { unidadesServico, useUnidades } from '../../nucleo/estado/unidades';
import { Unidade } from '../../nucleo/modelos';
import { EstadoVazio } from '../../compartilhado/EstadoVazio';
import './unidades.scss';

export default function Unidades() {
  const isMobile = useIsMobile();
  const unidades = useUnidades((s) => s.unidades);
  const [formAberto, setFormAberto] = useState(false);
  const [editando, setEditando] = useState<Unidade | null>(null);
  const [paraDesativar, setParaDesativar] = useState<Unidade | null>(null);
  const [paraExcluir, setParaExcluir] = useState<Unidade | null>(null);
  const [recusada, setRecusada] = useState<{ unidade: Unidade; mensagem: string } | null>(null);
  const f = useFormulario({ nome: '', endereco: '', telefone: '', ativa: true }, (v) => ({
    nome: !v.nome,
    endereco: !v.endereco,
    telefone: !telefoneValido(v.telefone),
  }));

  function abrir(unidade?: Unidade) {
    setEditando(unidade ?? null);
    f.resetar({ nome: unidade?.nome ?? '', endereco: unidade?.endereco ?? '', telefone: unidade?.telefone ?? '', ativa: unidade?.ativa ?? true });
    setFormAberto(true);
  }

  async function salvar(evento: FormEvent) {
    evento.preventDefault();
    if (!f.valido) {
      f.tocarTodos();
      return;
    }
    try {
      await unidadesServico.salvarUnidade({ ...f.valores, id: editando?.id });
      setFormAberto(false);
      avisos.sucesso('Unidade salva.');
    } catch (erro) {
      avisos.erro(erro);
    }
  }

  async function confirmarDesativacao() {
    const unidade = paraDesativar;
    setParaDesativar(null);
    if (!unidade) return;
    try {
      await unidadesServico.desativar(unidade.id);
      avisos.sucesso('Unidade desativada.');
    } catch (erro) {
      avisos.erro(erro);
    }
  }

  async function confirmarExclusao() {
    const unidade = paraExcluir;
    setParaExcluir(null);
    if (!unidade) return;
    try {
      await unidadesServico.excluir(unidade.id);
      avisos.sucesso('Unidade excluída.');
    } catch (erro) {
      setRecusada({ unidade, mensagem: mensagemDeErro(erro, 'Não foi possível excluir a unidade.') });
    }
  }

  async function desativarRecusada() {
    const unidade = recusada?.unidade;
    setRecusada(null);
    if (!unidade) return;
    try {
      await unidadesServico.desativar(unidade.id);
      avisos.sucesso('Unidade desativada.');
    } catch (erro) {
      avisos.erro(erro);
    }
  }

  return (
    <pf-unidades>
      <div className="pf-page">
        <CabecalhoPagina titulo="Unidades" subtitulo="Cadastre os locais onde o serviço é prestado">
          <button type="button" className="pf-btn pf-btn--primary" onClick={() => abrir()}>
            <Icone nome="plus" tamanho={17} />
            Nova unidade
          </button>
        </CabecalhoPagina>

        {unidades.length === 0 ? (
          <EstadoVazio ilustracao="vaga" titulo="Nenhuma unidade cadastrada" texto="Cadastre a primeira unidade para começar a lançar fichas." />
        ) : isMobile ? (
          <div className="cards">
            {unidades.map((u) => (
              <article key={u.id} className="pf-card card-unidade">
                <span className="card-unidade__icone"><Icone nome="local" tamanho={20} /></span>
                <div className="card-unidade__info">
                  <p className="card-unidade__nome">{u.nome}</p>
                  {u.ativa === false && <span className="pf-badge pf-badge--gray">Inativa</span>}
                  <p className="card-unidade__endereco">{u.endereco}</p>
                  {u.telefone && <p className="card-unidade__tel">{u.telefone}</p>}
                  <HistoricoAdministrativo tipo="unidades" id={u.id} nome={u.nome} />
                </div>
                <div className="card-unidade__acoes">
                  <button type="button" className="card-unidade__editar" onClick={() => abrir(u)} aria-label={`Editar ${u.nome}`}>
                    <Icone nome="editar" tamanho={18} />
                  </button>
                  <button type="button" className="acao acao--danger" onClick={() => setParaExcluir(u)} aria-label={`Excluir ${u.nome}`}>Excluir</button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="pf-card tabela">
            <div className="pf-table-wrap">
              <table className="pf-table">
                <thead>
                  <tr><th>Nome</th><th>Endereço</th><th>Telefone</th><th>Situação</th><th className="actions">Ações</th></tr>
                </thead>
                <tbody>
                  {unidades.map((u) => (
                    <tr key={u.id}>
                      <td className="forte">{u.nome}</td>
                      <td>{u.endereco || '—'}</td>
                      <td>{u.telefone || '—'}</td>
                      <td>{u.ativa === false ? 'Inativa' : 'Ativa'}</td>
                      <td className="actions">
                        <HistoricoAdministrativo tipo="unidades" id={u.id} nome={u.nome} />
                        <button type="button" className="acao" onClick={() => abrir(u)}>Editar</button>
                        {u.ativa !== false && <button type="button" className="acao acao--danger" onClick={() => setParaDesativar(u)}>Desativar</button>}
                        <button type="button" className="acao acao--danger" onClick={() => setParaExcluir(u)}>Excluir</button>
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
        <Modal titulo={editando ? 'Editar unidade' : 'Nova unidade'} aoFechar={() => setFormAberto(false)}>
          <form className="modal-form" onSubmit={salvar} noValidate>
            <div className="pf-field">
              <label className="pf-label" htmlFor="u-nome">Nome</label>
              <input id="u-nome" type="text" {...f.campo('nome')} />
              {f.invalido('nome') && <span className="pf-error">Informe o nome da unidade.</span>}
            </div>
            <div className="pf-field">
              <label className="pf-label" htmlFor="u-endereco">Endereço</label>
              <input id="u-endereco" type="text" placeholder="Rua, número" {...f.campo('endereco')} />
              {f.invalido('endereco') && <span className="pf-error">Informe o endereço.</span>}
            </div>
            <div className="pf-field">
              <label className="pf-label" htmlFor="u-telefone">Telefone</label>
              <input id="u-telefone" type="tel" placeholder="(11) 0000-0000" {...f.campo('telefone', { mascara: 'telefone' })} />
              {f.invalido('telefone') && <span className="pf-error">Telefone com DDD (10 ou 11 dígitos).</span>}
            </div>
            {editando && (
              <>
                <label className="pf-label"><input {...f.marcador('ativa')} /> Unidade ativa</label>
                <p className="vazio__texto">Unidades inativas permanecem no histórico e não recebem novos lançamentos.</p>
              </>
            )}
            <div className="modal-form__acoes">
              <button type="button" className="pf-btn pf-btn--ghost" onClick={() => setFormAberto(false)}>Cancelar</button>
              <button type="submit" className="pf-btn pf-btn--primary">Salvar</button>
            </div>
          </form>
        </Modal>
      )}

      {paraDesativar && (
        <Confirmar mensagem={`${paraDesativar.nome} ficará indisponível para novos lançamentos. O histórico será preservado.`}
          aoConfirmar={confirmarDesativacao} aoCancelar={() => setParaDesativar(null)} />
      )}

      {paraExcluir && (
        <Confirmar titulo="Excluir unidade" mensagem={`Excluir ${paraExcluir.nome} de vez? Isso não pode ser desfeito.`}
          aoConfirmar={confirmarExclusao} aoCancelar={() => setParaExcluir(null)} />
      )}

      {recusada && (
        recusada.unidade.ativa === false ? (
          <Modal titulo="Não foi possível excluir" aoFechar={() => setRecusada(null)}>
            <p>{recusada.mensagem}</p>
            <div className="modal-form__acoes">
              <button type="button" className="pf-btn pf-btn--ghost" onClick={() => setRecusada(null)}>Fechar</button>
            </div>
          </Modal>
        ) : (
          <Confirmar titulo="Não foi possível excluir" rotuloConfirmar="Desativar" mensagem={recusada.mensagem}
            aoConfirmar={desativarRecusada} aoCancelar={() => setRecusada(null)} />
        )
      )}
    </pf-unidades>
  );
}
