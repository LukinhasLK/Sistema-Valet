import { FormEvent, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Logo } from '../../compartilhado/Logo';
import { useAparecer } from '../../compartilhado/useAparecer';
import { authServico, useAuth } from '../../nucleo/estado/auth';
import { useIsMobile, useMovimentoReduzido } from '../../nucleo/estado/layout';
import { mensagemDeErro } from '../../nucleo/servicos/api';
import { rotaInicial } from '../../nucleo/servicos/permissoes';
import './login.scss';

const SENHA_DEMO = '123456';

export default function Login() {
  const isMobile = useIsMobile();
  const movimentoReduzido = useMovimentoReduzido();
  const navegar = useNavigate();
  const [parametros] = useSearchParams();
  const cartao = useRef<HTMLFormElement>(null);
  useAparecer(cartao, 4);

  const [usarImagem, setUsarImagem] = useState(false);
  const [identificador, setIdentificador] = useState('');
  const [senha, setSenha] = useState('');
  const [tocados, setTocados] = useState({ identificador: false, senha: false });
  const [erro, setErro] = useState('');
  const [ajudaSenha, setAjudaSenha] = useState(false);
  const [entrando, setEntrando] = useState(false);

  const invalido = {
    identificador: !identificador,
    senha: !senha || senha.length < 4,
  };

  function iniciarManobra(video: HTMLVideoElement) {
    if (video.ended || !video.paused) return;
    video.play().catch(() => {
      if (video.isConnected) setUsarImagem(true);
    });
  }

  async function entrar(evento: FormEvent) {
    evento.preventDefault();
    setErro('');
    if (invalido.identificador || invalido.senha) {
      setTocados({ identificador: true, senha: true });
      return;
    }
    setEntrando(true);
    try {
      if (!(await authServico.login(identificador, senha))) {
        setErro('E-mail/usuário ou senha incorretos.');
        return;
      }
    } catch (e) {
      setErro(mensagemDeErro(e));
      return;
    } finally {
      setEntrando(false);
    }
    navegar(parametros.get('redirectTo') ?? rotaInicial(useAuth.getState().usuario?.nivel), { replace: true });
  }

  return (
    <pf-login>
      <div className={`login${isMobile ? ' login--mobile' : ''}`}>
        {/* Painel de marca: coluna esquerda no desktop, topo no mobile */}
        <section className="brand">
          {!isMobile && (
            <div className="brand__scene" aria-hidden="true">
              {movimentoReduzido || usarImagem ? (
                <img src="/login/manobra-final.png" width={960} height={600} alt="" />
              ) : (
                <video src="/login/manobra-3d.mp4" width={960} height={600} autoPlay muted playsInline
                  disablePictureInPicture tabIndex={-1}
                  onCanPlay={(e) => iniciarManobra(e.currentTarget)} onError={() => setUsarImagem(true)} />
              )}
            </div>
          )}
          <div className="brand__inner">
            <Logo escuro tamanho={isMobile ? 22 : 26} />
            <h1 className="brand__headline">Gerencie seu estacionamento com agilidade</h1>
            {!isMobile && <p className="brand__sub">Park Flash — rapidez e controle na palma da sua mão.</p>}
          </div>
        </section>

        {/* Formulário */}
        <section className="painel">
          <form ref={cartao} className="card" onSubmit={entrar} noValidate>
            <div className="card__brand"><Logo tamanho={17} /></div>

            <h2 className="card__title">Bem-vindo ao Park Flash</h2>
            <p className="card__sub">Faça login para continuar</p>

            <div className="pf-field">
              <label className="pf-label" htmlFor="identificador">E-mail ou usuário</label>
              <input id="identificador" className={`pf-input${tocados.identificador && invalido.identificador ? ' ng-invalid ng-touched' : ''}`}
                type="text" autoComplete="username" placeholder="seu@email.com" value={identificador}
                onChange={(e) => setIdentificador(e.target.value)} onBlur={() => setTocados((t) => ({ ...t, identificador: true }))} />
              {tocados.identificador && invalido.identificador && <span className="pf-error">Informe seu e-mail ou usuário.</span>}
            </div>

            <div className="pf-field">
              <label className="pf-label" htmlFor="senha">Senha</label>
              <input id="senha" className={`pf-input${tocados.senha && invalido.senha ? ' ng-invalid ng-touched' : ''}`}
                type="password" autoComplete="current-password" placeholder="••••••••" value={senha}
                onChange={(e) => setSenha(e.target.value)} onBlur={() => setTocados((t) => ({ ...t, senha: true }))} />
              {tocados.senha && invalido.senha && <span className="pf-error">A senha precisa ter ao menos 4 caracteres.</span>}
            </div>

            {erro && <p className="card__erro">{erro}</p>}

            <button type="submit" className="pf-btn pf-btn--primary pf-btn--block" disabled={entrando}>
              {entrando ? 'Entrando…' : 'Entrar'}
            </button>

            <button type="button" className="pf-link-btn card__esqueci" onClick={() => setAjudaSenha((a) => !a)} aria-expanded={ajudaSenha}>
              Esqueci minha senha
            </button>
            {ajudaSenha && (
              <p className="card__ajuda">
                Peça ao proprietário para definir uma nova senha em <strong>Usuários</strong>.
                Na demonstração, todos os usuários usam a senha <strong>{SENHA_DEMO}</strong>.
              </p>
            )}
          </form>
        </section>
      </div>
    </pf-login>
  );
}
