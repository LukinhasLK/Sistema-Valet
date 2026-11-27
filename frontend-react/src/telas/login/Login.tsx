import { CSSProperties, FormEvent, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { animate, stagger } from 'motion';
import { Icone } from '../../compartilhado/Icone';
import { Logo } from '../../compartilhado/Logo';
import { CURVA, reduzido } from '../../compartilhado/movimento';
import { authServico, useAuth } from '../../nucleo/estado/auth';
import { useIsMobile, useMovimentoReduzido } from '../../nucleo/estado/layout';
import { useSeo } from '../../compartilhado/useSeo';
import { PerdidinhoTardio } from '../../compartilhado/perdidinho';
import { mensagemDeErro } from '../../nucleo/servicos/api';
import { rotaInicial } from '../../nucleo/servicos/permissoes';
import { CenaVaga } from './CenaVaga';
import './login.scss';

/** Recursos reais do sistema (nada de números ou promessas que o produto não entrega). */
const DESTAQUES = [
  { icone: 'fichas', texto: 'Fichas de caixa com conferência e fechamento' },
  { icone: 'pagamentos', texto: 'Diárias da equipe com a chave Pix à mão' },
  { icone: 'relatorios', texto: 'Relatórios mensais e divisão de lucro' },
];

const REPOUSO_ENTRADA_MS = 1600;
const OCIOSO_MS = 60_000;
const ERRO_MS = 4000;
const SURPRESA_MS = 500;
const SUCESSO_MS = 250;
const OLHAR_EMAIL = { x: 1, y: -0.2 };
const OLHAR_ESPIANDO = { x: 1, y: 0.2 };
const OLHAR_NEUTRO = { x: 0, y: 0 };
const OLHAR_VAR = { '--perdidinho-olhar-dur': '220ms', '--perdidinho-olhar-atraso': '0ms' } as CSSProperties;

type Foco = 'nenhum' | 'email' | 'senha';

export default function Login() {
  const isMobile = useIsMobile();
  const movimentoReduzido = useMovimentoReduzido();
  const navegar = useNavigate();
  const [parametros] = useSearchParams();
  const raiz = useRef<HTMLElement>(null);
  useSeo({
    titulo: 'Entrar — Park Flash',
    descricao: 'Entre no Park Flash com o acesso fornecido pelo proprietário da sua operação.',
    caminho: '/login',
  });

  const [identificador, setIdentificador] = useState('');
  const [senha, setSenha] = useState('');
  const [verSenha, setVerSenha] = useState(false);
  const [tocados, setTocados] = useState({ identificador: false, senha: false });
  const [erro, setErro] = useState('');
  const [ajudaSenha, setAjudaSenha] = useState(false);
  const [entrando, setEntrando] = useState(false);

  // Estado do mascote (ele só recebe props; nada aqui é anunciado).
  const [foco, setFoco] = useState<Foco>('nenhum');
  const [acenando, setAcenando] = useState(true);
  const [triste, setTriste] = useState(false);
  const [feliz, setFeliz] = useState(false);
  const [dormindo, setDormindo] = useState(false);
  const [surpreso, setSurpreso] = useState(false);
  const timers = useRef(new Set<number>());
  const timerErro = useRef(0);
  const dormindoRef = useRef(false);

  const agendar = (fn: () => void, ms: number) => {
    const id = window.setTimeout(() => { timers.current.delete(id); fn(); }, ms);
    timers.current.add(id);
    return id;
  };

  const invalido = {
    identificador: !identificador,
    senha: !senha || senha.length < 4,
  };

  // Entrada da tela: marca, título, cena e formulário em sequência.
  useLayoutEffect(() => {
    const el = raiz.current;
    if (!el) return;
    if (reduzido()) return;
    const q = (sel: string) => [...el.querySelectorAll(sel)];
    const opcoes = { duration: 0.8, ease: CURVA.saida };
    const controles = [
      animate(q('.brand [data-anima]'), { opacity: [0, 1], y: [14, 0] }, { ...opcoes, delay: stagger(0.07) }),
      ...q('.brand__scene').map((c) => animate(c, { opacity: [0, 1], y: [18, 0], scale: [0.98, 1] }, { ...opcoes, delay: 0.12 })),
      ...q('.card').map((c) => animate(c, { opacity: [0, 1], y: [16, 0] }, { ...opcoes, duration: 0.7, delay: 0.05 })),
      animate(q('.card [data-anima]'), { opacity: [0, 1], y: [8, 0] }, { ...opcoes, duration: 0.5, delay: stagger(0.04, { startDelay: 0.18 }) }),
    ];
    return () => controles.forEach((c) => c.complete());
  }, [isMobile]);

  // Pré-carrega o pedaço do mascote sem bloquear nada; o aceno vira repouso após 1,6 s.
  useEffect(() => {
    import('../../compartilhado/perdidinho/Perdidinho').catch(() => {});
    const t = agendar(() => setAcenando(false), REPOUSO_ENTRADA_MS);
    const ativos = timers.current;
    return () => {
      window.clearTimeout(t);
      ativos.forEach((id) => window.clearTimeout(id));
      ativos.clear();
    };
  }, []);

  // Ocioso por 60 s (só no desktop): dorme; qualquer atividade acorda com um susto de 0,5 s.
  useEffect(() => {
    if (isMobile) return;
    let ultima = Date.now();
    const acordar = () => {
      ultima = Date.now();
      if (!dormindoRef.current) return;
      dormindoRef.current = false;
      setDormindo(false);
      setSurpreso(true);
      agendar(() => setSurpreso(false), SURPRESA_MS);
    };
    const aoVoltar = () => { if (document.visibilityState === 'visible') acordar(); };
    const verificar = window.setInterval(() => {
      if (!dormindoRef.current && Date.now() - ultima >= OCIOSO_MS) {
        dormindoRef.current = true;
        setDormindo(true);
      }
    }, 5000);
    window.addEventListener('keydown', acordar);
    window.addEventListener('pointermove', acordar, { passive: true });
    window.addEventListener('pointerdown', acordar, { passive: true });
    document.addEventListener('visibilitychange', aoVoltar);
    return () => {
      window.clearInterval(verificar);
      window.removeEventListener('keydown', acordar);
      window.removeEventListener('pointermove', acordar);
      window.removeEventListener('pointerdown', acordar);
      document.removeEventListener('visibilitychange', aoVoltar);
      dormindoRef.current = false;
    };
  }, [isMobile]);

  function falhou(mensagem: string) {
    setErro(mensagem);
    setTriste(true);
    window.clearTimeout(timerErro.current);
    timers.current.delete(timerErro.current);
    timerErro.current = agendar(() => setTriste(false), ERRO_MS);
  }

  function aoDigitar() {
    if (!triste) return;
    window.clearTimeout(timerErro.current);
    timers.current.delete(timerErro.current);
    setTriste(false);
  }

  function aoFocar(campo: Foco) { setFoco(campo); }
  function aoDesfocar(e: React.FocusEvent<HTMLElement>) {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFoco('nenhum');
  }

  // Props do mascote derivadas do estado.
  const senhaViva = foco === 'senha' || (verSenha && senha !== '');
  const espiando = verSenha && senhaViva;
  const humorMascote = feliz ? 'feliz'
    : triste ? 'triste'
    : !isMobile && dormindo ? 'dormindo'
    : !isMobile && surpreso ? 'surpreso'
    : !isMobile && acenando ? 'acenando'
    : 'explicando';
  const emRepouso = humorMascote === 'explicando' || humorMascote === 'acenando';
  const olharFixo = isMobile ? OLHAR_NEUTRO
    : !emRepouso ? undefined
    : foco === 'email' ? OLHAR_EMAIL
    : espiando ? OLHAR_ESPIANDO
    : undefined;
  const olhosMascote = !emRepouso || (!isMobile && foco === 'email') ? undefined
    : espiando ? 'espiando' as const
    : foco === 'senha' ? 'fechados' as const
    : undefined;
  const olharFinal = isMobile && espiando ? OLHAR_ESPIANDO : olharFixo;
  const mascote = (tamanho: number) => (
    <PerdidinhoTardio humor={humorMascote} falando={false} passo="login" lado="centro" decorativo tamanho={tamanho}
      reduzirMovimento={movimentoReduzido} ciclos={false}
      olhar={olharFinal} olhos={olhosMascote} virado={emRepouso && foco === 'senha' && !espiando} />
  );

  async function entrar(evento: FormEvent) {
    evento.preventDefault();
    setErro('');
    if (invalido.identificador || invalido.senha) {
      setTocados({ identificador: true, senha: true });
      // Leva o foco ao primeiro campo com problema (o erro aparece ligado a ele por aria-describedby).
      document.getElementById(invalido.identificador ? 'identificador' : 'senha')?.focus();
      return;
    }
    setEntrando(true);
    try {
      if (!(await authServico.login(identificador, senha))) {
        falhou('E-mail/usuário ou senha incorretos.');
        return;
      }
    } catch (e) {
      falhou(mensagemDeErro(e));
      return;
    } finally {
      setEntrando(false);
    }
    const destino = parametros.get('redirectTo') ?? rotaInicial(useAuth.getState().usuario?.nivel);
    window.clearTimeout(timerErro.current);
    setTriste(false);
    setFeliz(true);
    // O mascote comemora, mas a navegação nunca espera por ele (no máximo 250 ms; 0 com reduzir movimento).
    if (movimentoReduzido || reduzido()) navegar(destino, { replace: true });
    else agendar(() => navegar(destino, { replace: true }), SUCESSO_MS);
  }

  return (
    <pf-login>
      <main ref={raiz} id="conteudo" className={`login${isMobile ? ' login--mobile' : ''}`}>
        {/* Painel de marca: coluna esquerda no desktop, topo no celular */}
        <section className="brand">
          <div className="brand__inner">
            <div data-anima className="brand__topo">
              <Logo escuro tamanho={isMobile ? 21 : 24} />
              {isMobile && <div className="brand__mascote-mini" aria-hidden="true" style={OLHAR_VAR}>{mascote(44)}</div>}
            </div>
            <h1 className="brand__headline" data-anima>Seu estacionamento, <span>sob controle.</span></h1>
            {!isMobile && <p className="brand__sub" data-anima>Fichas, equipe, pagamentos e relatórios em um só lugar — feito para a rotina de quem opera.</p>}
          </div>
          {!isMobile && (
            <div className="brand__scene" aria-hidden="true">
              <div style={OLHAR_VAR}><CenaVaga>{mascote(132)}</CenaVaga></div>
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
                onChange={(e) => { setIdentificador(e.target.value); aoDigitar(); }} onFocus={() => aoFocar('email')}
                onBlur={() => { setFoco('nenhum'); setTocados((t) => ({ ...t, identificador: true })); }} />
              {tocados.identificador && invalido.identificador && <span id="erro-identificador" className="pf-error">Informe seu e-mail ou usuário.</span>}
            </div>

            <div className="pf-field" data-anima>
              <label className="pf-label" htmlFor="senha">Senha</label>
              <div className="campo-senha" onFocus={() => aoFocar('senha')} onBlur={aoDesfocar}>
                <input id="senha" className={`pf-input${tocados.senha && invalido.senha ? ' ng-invalid ng-touched' : ''}`}
                  type={verSenha ? 'text' : 'password'} autoComplete="current-password" placeholder="Sua senha" value={senha}
                  aria-invalid={tocados.senha && invalido.senha}
                  aria-describedby={tocados.senha && invalido.senha ? 'erro-senha' : undefined}
                  onChange={(e) => { setSenha(e.target.value); aoDigitar(); }} onBlur={() => setTocados((t) => ({ ...t, senha: true }))} />
                <button type="button" className="campo-senha__ver" onClick={() => setVerSenha((v) => !v)}
                  aria-label="Mostrar senha" aria-pressed={verSenha}>
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
          <Link to="/conheca" className="painel__conheca">Ainda não usa? Conheça o Park Flash <Icone nome="seta" tamanho={14} /></Link>
        </section>
      </main>
    </pf-login>
  );
}
