import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CabecalhoPagina } from '../../compartilhado/CabecalhoPagina';
import { Confirmar } from '../../compartilhado/Confirmar';
import { useFormulario } from '../../compartilhado/useFormulario';
import { corDoAvatar } from '../../layout/itens-menu';
import { authServico, inicialDe, useNivel, useUsuario } from '../../nucleo/estado/auth';
import { onboardingServico, progressoDe, useOnboarding } from '../../nucleo/onboarding/estado';
import { Icone } from '../../compartilhado/Icone';
import { avisos } from '../../nucleo/estado/aviso';
import { mensagemDeErro } from '../../nucleo/servicos/api';
import { podeAcessar } from '../../nucleo/servicos/permissoes';
import { AgendaGoogle } from './AgendaGoogle';
import './perfil.scss';

const VAZIO = { senhaAtual: '', novaSenha: '', confirmacao: '' };

export default function Perfil() {
  const usuario = useUsuario();
  const nivel = useNivel();
  const statusTour = useOnboarding((st) => progressoDe(st.progresso, usuario?.id).status);
  const navegar = useNavigate();
  const [mensagem, setMensagem] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [confirmarSaida, setConfirmarSaida] = useState(false);

  async function sairDeTodos() {
    setConfirmarSaida(false);
    try {
      await authServico.sairDeTodos();
      navegar('/login');
      avisos.sucesso('Você saiu de todos os aparelhos.');
    } catch (erro) {
      avisos.erro(erro, 'Não foi possível sair dos outros aparelhos.');
    }
  }
  const f = useFormulario(VAZIO, (v) => ({
    senhaAtual: !v.senhaAtual,
    novaSenha: !v.novaSenha || v.novaSenha.length < 10 || v.novaSenha.length > 72,
    confirmacao: !v.confirmacao,
    _form: v.novaSenha !== v.confirmacao,
  }));

  async function trocarSenha(evento: FormEvent) {
    evento.preventDefault();
    setMensagem(null);
    if (!f.valido) {
      f.tocarTodos();
      return;
    }
    setSalvando(true);
    try {
      await authServico.trocarSenha(f.valores.senhaAtual, f.valores.novaSenha);
    } catch (erro) {
      setMensagem({ tipo: 'erro', texto: mensagemDeErro(erro) });
      return;
    } finally {
      setSalvando(false);
    }
    f.resetar(VAZIO);
    authServico.logout();
    navegar('/login');
    avisos.sucesso('Senha alterada. Entre com a nova senha.');
  }

  return (
    <pf-perfil>
      <div className="pf-page perfil">
        <CabecalhoPagina sobretitulo="Conta" titulo="Meu perfil" subtitulo="Seus dados de acesso e preferências deste aparelho." />

        {usuario && (
          <section className="pf-card perfil__card">
            <span className="pf-avatar perfil__avatar" style={{ background: corDoAvatar(usuario.nome) }}>{inicialDe(usuario)}</span>
            <div>
              <p className="perfil__nome">{usuario.nome}</p>
              <p className="perfil__email">{usuario.email}</p>
              <span className="pf-badge pf-badge--gray">{usuario.nivel}</span>
            </div>
          </section>
        )}

        <form className="pf-card perfil__card perfil__form" onSubmit={trocarSenha} noValidate>
          <h2 className="perfil__titulo">Trocar senha</h2>

          <div className="pf-field">
            <label className="pf-label" htmlFor="p-atual">Senha atual</label>
            <input id="p-atual" type="password" autoComplete="current-password" {...f.campo('senhaAtual')} />
            {f.invalido('senhaAtual') && <span className="pf-error">Informe a senha atual.</span>}
          </div>

          <div className="pf-field">
            <label className="pf-label" htmlFor="p-nova">Nova senha</label>
            <input id="p-nova" type="password" autoComplete="new-password" placeholder="De 10 a 72 caracteres" {...f.campo('novaSenha')} />
            {f.invalido('novaSenha') && <span className="pf-error">A nova senha precisa ter de 10 a 72 caracteres.</span>}
          </div>

          <div className="pf-field">
            <label className="pf-label" htmlFor="p-conf">Confirmar nova senha</label>
            <input id="p-conf" type="password" autoComplete="new-password" {...f.campo('confirmacao')} />
            {f.erros._form && f.tocados.confirmacao && <span className="pf-error">As senhas não conferem.</span>}
          </div>

          {mensagem && <p className={`perfil__msg${mensagem.tipo === 'erro' ? ' perfil__msg--erro' : ''}`} role="status">{mensagem.texto}</p>}

          <button type="submit" className="pf-btn pf-btn--primary" disabled={salvando}>Salvar nova senha</button>
        </form>

        <section className="pf-card perfil__card perfil__tour" aria-labelledby="perfil-sessoes">
          <span className="perfil__tour-icone"><Icone nome="seguro" tamanho={20} /></span>
          <div className="perfil__tour-texto">
            <h2 id="perfil-sessoes" className="perfil__titulo">Segurança da conta</h2>
            <p>Esqueceu a conta aberta em outro celular ou computador? Saia de todos de uma vez. O link do Google Calendar também para de funcionar.</p>
            <div className="perfil__tour-acoes">
              <button type="button" className="pf-btn pf-btn--ghost pf-btn--sm" onClick={() => setConfirmarSaida(true)}>Sair de todos os aparelhos</button>
            </div>
          </div>
        </section>

        {confirmarSaida && (
          <Confirmar titulo="Sair de todos os aparelhos?" rotuloConfirmar="Sair de todos"
            mensagem="Todos os aparelhos, inclusive este, vão pedir login de novo. Se você usa o link do Google Calendar, gere um novo depois."
            aoConfirmar={sairDeTodos} aoCancelar={() => setConfirmarSaida(false)} />
        )}

        {podeAcessar(nivel, 'eventos') && <AgendaGoogle />}

        <section className="pf-card perfil__card perfil__tour" aria-labelledby="perfil-tour">
          <span className="perfil__tour-icone"><Icone nome="tour" tamanho={20} /></span>
          <div className="perfil__tour-texto">
            <h2 id="perfil-tour" className="perfil__titulo">Tour guiado</h2>
            <p>{statusTour === 'concluido' ? 'Você concluiu o tour. Reveja quando quiser.'
              : statusTour === 'pausado' || statusTour === 'em_andamento' ? 'Você parou no meio do tour. Continue de onde parou ou recomece.'
              : 'Um passo a passo curto pelas telas que o seu perfil usa.'}</p>
            <div className="perfil__tour-acoes">
              {(statusTour === 'pausado' || statusTour === 'em_andamento') && (
                <button type="button" className="pf-btn pf-btn--primary pf-btn--sm" onClick={() => onboardingServico.retomar(usuario?.id, nivel)}>Continuar</button>
              )}
              <button type="button" className="pf-btn pf-btn--ghost pf-btn--sm" onClick={() => onboardingServico.iniciar(usuario?.id, nivel)}>
                {statusTour === 'concluido' || statusTour === 'pulado' ? 'Rever o tour' : 'Começar do início'}
              </button>
            </div>
          </div>
        </section>
      </div>
    </pf-perfil>
  );
}
