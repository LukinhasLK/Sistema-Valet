import { FormEvent, useLayoutEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { gsap } from 'gsap';
import { Icone } from '../../compartilhado/Icone';
import { Logo } from '../../compartilhado/Logo';
import { movimentoLivre } from '../../compartilhado/movimento';
import { authServico, useAuth } from '../../nucleo/estado/auth';
import { useIsMobile, useMovimentoReduzido } from '../../nucleo/estado/layout';
import { mensagemDeErro } from '../../nucleo/servicos/api';
import { rotaInicial } from '../../nucleo/servicos/permissoes';
import './login.scss';

/** Recursos reais do sistema (nada de números ou promessas que o produto não entrega). */
const DESTAQUES = [
  { icone: 'fichas', texto: 'Fichas de caixa com conferência e fechamento' },
  { icone: 'pagamentos', texto: 'Diárias da equipe com a chave Pix à mão' },
  { icone: 'relatorios', texto: 'Relatórios mensais e divisão de lucro' },
];

export default function Login() {
  const isMobile = useIsMobile();
  const movimentoReduzido = useMovimentoReduzido();
  const navegar = useNavigate();
  const [parametros] = useSearchParams();
  const raiz = useRef<HTMLDivElement>(null);

  const [usarImagem, setUsarImagem] = useState(false);
  const [identificador, setIdentificador] = useState('');
  const [senha, setSenha] = useState('');
  const [verSenha, setVerSenha] = useState(false);
  const [tocados, setTocados] = useState({ identificador: false, senha: false });
  const [erro, setErro] = useState('');
  const [ajudaSenha, setAjudaSenha] = useState(false);
  const [entrando, setEntrando] = useState(false);

  const invalido = {
    identificador: !identificador,
    senha: !senha || senha.length < 4,
  };

  // Entrada da tela: marca, título, cena e formulário em sequência (GSAP).
  useLayoutEffect(() => {
    const el = raiz.current;
    if (!el) return;
    const media = gsap.matchMedia();
    media.add(movimentoLivre, () => {
      const tl = gsap.timeline({ defaults: { ease: 'expo.out', duration: 0.8 } });
      tl.from(el.querySelectorAll('.brand [data-anima]'), { opacity: 0, y: 14, stagger: 0.07 }, 0)
        .from(el.querySelector('.brand__scene'), { opacity: 0, y: 18, scale: 0.98 }, 0.12)
        .from(el.querySelector('.card'), { opacity: 0, y: 16, duration: 0.7 }, 0.05)
        .from(el.querySelectorAll('.card [data-anima]'), { opacity: 0, y: 8, stagger: 0.04, duration: 0.5 }, 0.18);
    });
    return () => media.revert();
  }, [isMobile]);

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
      <div ref={raiz} className={`login${isMobile ? ' login--mobile' : ''}`}>
        {/* Painel de marca: coluna esquerda no desktop, topo no celular */}
        <section className="brand">
          <div className="brand__inner">
            <div data-anima><Logo escuro tamanho={isMobile ? 21 : 24} /></div>
            <h1 className="brand__headline" data-anima>Seu estacionamento, <span>sob controle.</span></h1>
            {!isMobile && <p className="brand__sub" data-anima>Fichas, equipe, pagamentos e relatórios em um só lugar — feito para a rotina de quem opera.</p>}
          </div>
          {!isMobile && (
            <div className="brand__scene" aria-hidden="true">
              {movimentoReduzido || usarImagem ? (
                <img src="/midia/login/manobra-final.png" width={960} height={600} alt="" />
              ) : (
                <video src="/midia/login/manobra-3d.mp4" width={960} height={600} autoPlay muted playsInline
                  disablePictureInPicture tabIndex={-1}
                  onCanPlay={(e) => iniciarManobra(e.currentTarget)} onError={() => setUsarImagem(true)} />
              )}
            </div>
          )}
          {!isMobile && (
            <ul className="brand__destaques">
              {DESTAQUES.map((d) => (
                <li key={d.icone} data-anima><span><Icone nome={d.icone} tamanho={15} /></span>{d.texto}</li>
              ))}
            </ul>
          )}
        </section>

        {/* Formulário */}
        <section className="painel">
          <form className="card" onSubmit={entrar} noValidate aria-labelledby="login-titulo">
            <div className="card__brand" data-anima><Logo tamanho={17} /></div>

            <div data-anima>
              <h2 id="login-titulo" className="card__title">Entrar</h2>
              <p className="card__sub">Use o e-mail ou o nome de usuário cadastrado.</p>
            </div>

            <div className="pf-field" data-anima>
              <label className="pf-label" htmlFor="identificador">E-mail ou usuário</label>
              <input id="identificador" className={`pf-input${tocados.identificador && invalido.identificador ? ' ng-invalid ng-touched' : ''}`}
                type="text" autoComplete="username" placeholder="seu@email.com" value={identificador} autoCapitalize="none" spellCheck={false}
                aria-invalid={tocados.identificador && invalido.identificador}
                aria-describedby={tocados.identificador && invalido.identificador ? 'erro-identificador' : undefined}
                onChange={(e) => setIdentificador(e.target.value)} onBlur={() => setTocados((t) => ({ ...t, identificador: true }))} />
              {tocados.identificador && invalido.identificador && <span id="erro-identificador" className="pf-error">Informe seu e-mail ou usuário.</span>}
            </div>

            <div className="pf-field" data-anima>
              <label className="pf-label" htmlFor="senha">Senha</label>
              <div className="campo-senha">
                <input id="senha" className={`pf-input${tocados.senha && invalido.senha ? ' ng-invalid ng-touched' : ''}`}
                  type={verSenha ? 'text' : 'password'} autoComplete="current-password" placeholder="Sua senha" value={senha}
                  aria-invalid={tocados.senha && invalido.senha}
                  aria-describedby={tocados.senha && invalido.senha ? 'erro-senha' : undefined}
                  onChange={(e) => setSenha(e.target.value)} onBlur={() => setTocados((t) => ({ ...t, senha: true }))} />
                <button type="button" className="campo-senha__ver" onClick={() => setVerSenha((v) => !v)}
                  aria-label={verSenha ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={verSenha}>
                  <Icone nome={verSenha ? 'ocultar' : 'ver'} tamanho={17} />
                </button>
              </div>
              {tocados.senha && invalido.senha && <span id="erro-senha" className="pf-error">A senha precisa ter ao menos 4 caracteres.</span>}
            </div>

            {erro && <p className="card__erro" role="alert"><Icone nome="alerta" tamanho={16} />{erro}</p>}

            <button type="submit" className="pf-btn pf-btn--primary pf-btn--block card__entrar" disabled={entrando} data-anima>
              {entrando ? <><span className="girando" aria-hidden="true" />Entrando…</> : <>Entrar<Icone nome="seta" tamanho={16} /></>}
            </button>

            <button type="button" className="pf-link-btn card__esqueci" onClick={() => setAjudaSenha((a) => !a)} aria-expanded={ajudaSenha} data-anima>
              Esqueci minha senha
            </button>
            {ajudaSenha && (
              <p className="card__ajuda" role="note">
                Por segurança, a senha não é enviada por e-mail. Peça ao proprietário da conta para definir uma nova senha em <strong>Usuários</strong>.
              </p>
            )}
          </form>
          {!isMobile && <Link to="/conheca" className="painel__conheca">Conheça o Park Flash <Icone nome="externo" tamanho={14} /></Link>}
        </section>
      </div>
    </pf-login>
  );
}
