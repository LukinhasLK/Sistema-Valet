import { FormEvent, useMemo, useState } from 'react';
import { CabecalhoPagina } from '../../compartilhado/CabecalhoPagina';
import { Confirmar } from '../../compartilhado/Confirmar';
import { HistoricoAdministrativo } from '../../compartilhado/HistoricoAdministrativo';
import { Icone } from '../../compartilhado/Icone';
import { emailValido } from '../../compartilhado/mascara';
import { Modal } from '../../compartilhado/Modal';
import { useFormulario } from '../../compartilhado/useFormulario';
import { corDoAvatar } from '../../layout/itens-menu';
import { useUsuario } from '../../nucleo/estado/auth';
import { avisos } from '../../nucleo/estado/aviso';
import { useIsMobile } from '../../nucleo/estado/layout';
import { useSocios } from '../../nucleo/estado/socios';
import { useUnidades } from '../../nucleo/estado/unidades';
import { usuariosServico, useUsuarios } from '../../nucleo/estado/usuarios';
import { NivelAcesso, NIVEIS_ACESSO, Unidade, Usuario } from '../../nucleo/modelos';
import { CampoSelecao } from '../../compartilhado/CampoSelecao';
import './usuarios.scss';

const CLASSE_NIVEL: Record<NivelAcesso, string> = {
  'Proprietário': 'pf-badge--purple',
  Gerente: 'pf-badge--blue',
  Operador: 'pf-badge--gray',
  'Sócio': 'pf-badge--green',
};

function resumoEscopo(usuario: Usuario, unidades: Unidade[], nomeSocio: (id?: number | null) => string): string {
  if (usuario.nivel === 'Proprietário') return 'Todas as unidades';
  if (usuario.nivel === 'Sócio') return `Sócio ${nomeSocio(usuario.socioId)} · só a própria sociedade`;
  const ids = new Set(usuario.unidadeIds ?? []);
  return unidades.filter((u) => ids.has(u.id)).map((u) => u.nome).join(', ') || 'Sem acesso a unidades';
}

export default function Usuarios() {
  const isMobile = useIsMobile();
  const sessao = useUsuario();
  const todos = useUsuarios((s) => s.usuarios);
  const unidades = useUnidades((s) => s.unidades);
  const socios = useSocios((s) => s.socios);
  const nomeSocio = (id?: number | null) => socios.find((x) => x.id === id)?.nome ?? '—';
  /** Sócios que ainda não têm login (o de quem está sendo editado continua na lista). */
  const sociosLivres = socios.filter((x) => x.id === editando?.socioId || !todos.some((u) => u.ativo !== false && u.socioId === x.id));
  const [mostrarInativos, setMostrarInativos] = useState(false);
  const usuarios = useMemo(() => todos.filter((u) => mostrarInativos || u.ativo !== false), [todos, mostrarInativos]);
  const [salvando, setSalvando] = useState(false);
  const [formAberto, setFormAberto] = useState(false);
  const [editando, setEditando] = useState<Usuario | null>(null);
  const [paraExcluir, setParaExcluir] = useState<Usuario | null>(null);
  const [emailDuplicado, setEmailDuplicado] = useState(false);
  const f = useFormulario(
    { nome: '', email: '', nivel: 'Operador' as NivelAcesso, senha: '', unidadeIds: [] as number[], socioId: '' },
    (v) => ({
      socioId: v.nivel === 'Sócio' && !v.socioId,
      nome: !v.nome,
      email: !v.email || !emailValido(v.email),
      // Senha obrigatória só no cadastro; na edição, vazio mantém a atual.
      senha: editando ? !!v.senha && (v.senha.length < 10 || v.senha.length > 72) : !v.senha || v.senha.length < 10 || v.senha.length > 72,
    }),
  );

  /** O usuário da sessão não pode se excluir. */
  const ehVoce = (u: Usuario) => sessao?.id === u.id;

  function abrir(usuario?: Usuario) {
    setEditando(usuario ?? null);
    f.resetar({ nome: usuario?.nome ?? '', email: usuario?.email ?? '', nivel: usuario?.nivel ?? 'Operador', senha: '', unidadeIds: usuario?.unidadeIds ?? [], socioId: usuario?.socioId ? String(usuario.socioId) : '' });
    setEmailDuplicado(false);
    setFormAberto(true);
  }

  const alternarUnidade = (id: number, selecionada: boolean) =>
    f.definir('unidadeIds', selecionada ? [...f.valores.unidadeIds, id] : f.valores.unidadeIds.filter((u) => u !== id));

  async function salvar(evento: FormEvent) {
    evento.preventDefault();
    if (salvando) return;
    if (!f.valido) {
      f.tocarTodos();
      return;
    }
    if (usuariosServico.emailEmUso(f.valores.email, editando?.id)) {
      setEmailDuplicado(true);
      return;
    }
    setSalvando(true);
    try {
      const { socioId, ...valores } = f.valores;
      const ehSocio = valores.nivel === 'Sócio';
      await usuariosServico.salvarUsuario({
        ...valores, id: editando?.id,
        unidadeIds: ehSocio ? [] : valores.unidadeIds,
        socioId: ehSocio ? Number(socioId) : null,
      });
      setFormAberto(false);
      avisos.sucesso('Usuário salvo.');
    } catch (erro) {
      avisos.erro(erro);
    } finally {
      setSalvando(false);
    }
  }

  async function confirmarExclusao() {
    const usuario = paraExcluir;
    setParaExcluir(null);
    if (!usuario || ehVoce(usuario)) return;
    try {
      await usuariosServico.excluir(usuario.id);
      avisos.sucesso('Usuário desativado.');
    } catch (erro) {
      avisos.erro(erro);
    }
  }

  return (
    <pf-usuarios>
      <div className="pf-page">
        <CabecalhoPagina titulo="Usuários" subtitulo="Gerencie os usuários do sistema">
          <button type="button" className="pf-btn pf-btn--primary" onClick={() => abrir()}>
            <Icone nome="plus" tamanho={17} />
            Novo usuário
          </button>
        </CabecalhoPagina>

        <label className="pf-btn pf-btn--ghost">
          <input type="checkbox" checked={mostrarInativos} onChange={(e) => setMostrarInativos(e.target.checked)} />
          Incluir contas desativadas
        </label>

        {isMobile ? (
          <div className="cards">
            {usuarios.map((u) => (
              <article key={u.id} className="pf-card card-usuario">
                <span className="pf-avatar" style={{ background: corDoAvatar(u.nome) }}>{u.nome.charAt(0)}</span>
                <div className="card-usuario__info">
                  <p className="card-usuario__nome">{u.nome}{ehVoce(u) && <span className="voce">você</span>}</p>
                  <p className="card-usuario__email">{u.email}</p>
                  <p className="card-usuario__escopo">{resumoEscopo(u, unidades, nomeSocio)}</p>
                </div>
                <div className="card-usuario__acoes">
                  <span className={`pf-badge ${CLASSE_NIVEL[u.nivel]}`}>{u.nivel}</span>
                  {u.ativo === false && <span className="pf-badge pf-badge--gray">Desativado</span>}
                  {u.ativo !== false && <button type="button" className="acao" onClick={() => abrir(u)} aria-label={`Editar ${u.nome}`}>Editar</button>}
                  <HistoricoAdministrativo tipo="usuarios" id={u.id} nome={u.nome} />
                  {u.ativo !== false && !ehVoce(u) && <button type="button" className="acao acao--danger" onClick={() => setParaExcluir(u)}>Desativar</button>}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="pf-card tabela">
            <div className="pf-table-wrap">
              <table className="pf-table">
                <thead>
                  <tr><th>Nome</th><th>E-mail</th><th>Nível de acesso</th><th>Unidades autorizadas</th><th className="actions">Ações</th></tr>
                </thead>
                <tbody>
                  {usuarios.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <span className="celula-nome">
                          <span className="pf-avatar" style={{ background: corDoAvatar(u.nome) }}>{u.nome.charAt(0)}</span>
                          {u.nome}
                          {ehVoce(u) && <span className="voce">você</span>}
                        </span>
                      </td>
                      <td>{u.email}</td>
                      <td>
                        <span className={`pf-badge ${CLASSE_NIVEL[u.nivel]}`}>{u.nivel}</span>
                        {u.ativo === false && <span className="pf-badge pf-badge--gray">Desativado</span>}
                      </td>
                      <td>{resumoEscopo(u, unidades, nomeSocio)}</td>
                      <td className="actions">
                        <HistoricoAdministrativo tipo="usuarios" id={u.id} nome={u.nome} />
                        {u.ativo !== false && <button type="button" className="acao" onClick={() => abrir(u)}>Editar</button>}
                        <button type="button" className="acao acao--danger" disabled={ehVoce(u)}
                          title={ehVoce(u) ? 'Você não pode desativar a própria conta' : 'Desativar usuário'}
                          onClick={() => setParaExcluir(u)}>Desativar</button>
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
        <Modal titulo={editando ? 'Editar usuário' : 'Novo usuário'} aoFechar={() => setFormAberto(false)}>
          <form className="modal-form" onSubmit={salvar} noValidate>
            <div className="pf-field">
              <label className="pf-label" htmlFor="us-nome">Nome</label>
              <input id="us-nome" type="text" {...f.campo('nome')} />
              {f.invalido('nome') && <span className="pf-error">Informe o nome.</span>}
            </div>
            <div className="pf-field">
              <label className="pf-label" htmlFor="us-email">E-mail</label>
              <input id="us-email" type="email" placeholder="nome@email.com" {...f.campo('email')} />
              {f.invalido('email') && <span className="pf-error">Informe um e-mail válido.</span>}
              {emailDuplicado && <span className="pf-error">Este e-mail já está em uso.</span>}
            </div>
            <div className="pf-field">
              <label className="pf-label" htmlFor="us-nivel">Nível de acesso</label>
              <CampoSelecao id="us-nivel" {...f.campo('nivel')} className="pf-select">
                {NIVEIS_ACESSO.map((n) => <option key={n} value={n}>{n}</option>)}
              </CampoSelecao>
            </div>

            {f.valores.nivel === 'Sócio' && (
              <div className="pf-field">
                <label className="pf-label" htmlFor="us-socio">Qual sócio é este login</label>
                <CampoSelecao id="us-socio" {...f.campo('socioId')} className="pf-select">
                  <option value="">Escolha o sócio</option>
                  {sociosLivres.map((x) => <option key={x.id} value={String(x.id)}>{x.nome}</option>)}
                </CampoSelecao>
                <p className="card-usuario__escopo">Ele vê só as unidades onde tem participação e quanto é a parte dele. Não vê fichas, equipe nem os outros sócios.</p>
                {f.invalido('socioId') && <span className="pf-error">Escolha o sócio.</span>}
                {!sociosLivres.length && <span className="pf-error">Todos os sócios já têm login. Cadastre o sócio em Sócios primeiro.</span>}
              </div>
            )}

            {f.valores.nivel !== 'Proprietário' && f.valores.nivel !== 'Sócio' && (
              <fieldset className="escopo" aria-describedby="us-escopo-ajuda">
                <legend className="pf-label">Unidades autorizadas</legend>
                <p id="us-escopo-ajuda" className="card-usuario__escopo">Sem seleção, este usuário não verá dados de nenhuma unidade.</p>
                {unidades.length ? unidades.map((unidade) => (
                  <label key={unidade.id} className="escopo__opcao">
                    <input type="checkbox" checked={f.valores.unidadeIds.includes(unidade.id)}
                      onChange={(e) => alternarUnidade(unidade.id, e.target.checked)} />
                    {unidade.nome}
                  </label>
                )) : <p className="card-usuario__escopo">Cadastre uma unidade para conceder acesso.</p>}
              </fieldset>
            )}

            <div className="pf-field">
              <label className="pf-label" htmlFor="us-senha">{editando ? 'Nova senha (opcional)' : 'Senha'}</label>
              <input id="us-senha" type="password" autoComplete="new-password"
                placeholder={editando ? 'Deixe em branco para manter' : 'Mínimo de 10 caracteres'} {...f.campo('senha')} />
              {f.invalido('senha') && <span className="pf-error">A senha precisa ter de 10 a 72 caracteres.</span>}
            </div>

            <div className="modal-form__acoes">
              <button type="button" className="pf-btn pf-btn--ghost" onClick={() => setFormAberto(false)}>Cancelar</button>
              <button type="submit" className="pf-btn pf-btn--primary" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</button>
            </div>
          </form>
        </Modal>
      )}

      {paraExcluir && (
        <Confirmar mensagem={`${paraExcluir.nome} perderá o acesso ao Park Flash.`}
          aoConfirmar={confirmarExclusao} aoCancelar={() => setParaExcluir(null)} />
      )}
    </pf-usuarios>
  );
}
