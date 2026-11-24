import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CabecalhoPagina } from '../../compartilhado/CabecalhoPagina';
import { dataHora } from '../../compartilhado/formatos';
import { useAparecer } from '../../compartilhado/useAparecer';
import { avisos } from '../../nucleo/estado/aviso';
import { mensagemDeErro } from '../../nucleo/servicos/api';
import {
  Categoria, CATEGORIAS, Notificacao, notificacoesServico, PreferenciaNotificacao, useTotalNaoLidas,
} from '../../nucleo/servicos/notificacoes';
import { navegadorPushCompativel } from '../../nucleo/servicos/push-dispositivo';
import { ConfiguracaoPush, DiagnosticoPush, webPushServico } from '../../nucleo/servicos/web-push';
import './notificacoes.scss';

const ROTAS: Record<Notificacao['destino'], string> = {
  FICHA: '/app/fichas', PAGAMENTO: '/app/pagamentos-manobristas', EVENTO: '/app/eventos', ESCALA: '/app/escalas',
};
const ROTULO_ABRIR: Record<Notificacao['destino'], string> = {
  FICHA: 'Abrir ficha', PAGAMENTO: 'Abrir pagamento', EVENTO: 'Abrir evento', ESCALA: 'Abrir escala',
};
const SUPORTA_PUSH = navegadorPushCompativel();
const permissaoNegada = () => SUPORTA_PUSH && Notification.permission === 'denied';

function Preferencias(props: {
  config: ConfiguracaoPush | null; preferencia: PreferenciaNotificacao[]; pushBloqueado: boolean; pushOcupado: boolean;
  pushMensagem: string; diagnostico: DiagnosticoPush[] | null; diagnosticoOcupado: boolean; salvandoCategoria: Categoria | null;
  podeAtivarPush: boolean; atualizar: () => void; ativar: () => void; testar: () => void; desativar: () => void;
  consultarDiagnostico: () => void; alterarCategoria: (e: React.ChangeEvent<HTMLInputElement>, item: PreferenciaNotificacao) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useAparecer(ref, 4);
  const { config } = props;
  return (
    <div ref={ref} className="preferencias">
      <section className="pf-card aviso-central">
        <h2>Notificações no aparelho</h2>
        <p className="apoio">O aviso na tela bloqueada é genérico. Os detalhes ficam na central.</p>
        {!config?.chavePublica ? (
          <p>O envio push ainda não foi configurado neste ambiente.</p>
        ) : !SUPORTA_PUSH ? (
          <p>Este navegador não oferece push para o Park Flash. No iPhone, adicione o Park Flash à Tela de Início pelo menu Compartilhar e abra pelo ícone.</p>
        ) : props.pushBloqueado ? (
          <p>As notificações estão bloqueadas. Autorize-as nos ajustes do navegador ou do dispositivo.</p>
        ) : null}
        {config?.chavePublica && !config?.envioAtivo && <p>O envio ao celular está pausado. A central continua funcionando.</p>}
        {config?.inscrito ? (
          <p>Ativo neste aparelho.</p>
        ) : SUPORTA_PUSH && !props.pushBloqueado && config?.envioAtivo && !config?.pronto ? (
          <>
            <p>O serviço de notificações está iniciando.</p>
            <button type="button" className="pf-btn pf-btn--ghost" onClick={props.atualizar}>Atualizar estado</button>
          </>
        ) : null}
        <div className="acoes">
          {config?.inscrito ? (
            <>
              {config.envioAtivo && (
                <button type="button" className="pf-btn pf-btn--primary" disabled={props.pushOcupado} onClick={props.testar}>Enviar aviso de teste</button>
              )}
              <button type="button" className="pf-btn pf-btn--ghost" disabled={props.pushOcupado} onClick={props.desativar}>Desativar neste dispositivo</button>
            </>
          ) : props.podeAtivarPush ? (
            <button type="button" className="pf-btn pf-btn--primary" disabled={props.pushOcupado} onClick={props.ativar}>Ativar neste dispositivo</button>
          ) : null}
        </div>
        {props.pushMensagem && <p role="status">{props.pushMensagem}</p>}

        <div className="diagnostico">
          <button type="button" className="pf-btn pf-btn--ghost" disabled={props.diagnosticoOcupado} onClick={props.consultarDiagnostico}>Ver atividade de envio</button>
          {props.diagnostico && (
            <>
              <p className="apoio">Aceita significa que o provedor recebeu o aviso. A exibição depende do dispositivo.</p>
              <ul>
                {props.diagnostico.length ? props.diagnostico.map((r, i) => (
                  <li key={i}>{dataHora(r.atualizadoEm, 'dd/MM HH:mm', '-0300')} · {r.estado.toLowerCase()} · {r.tentativas} tentativa(s){r.codigo && ` · ${r.codigo}`}</li>
                )) : <li>Ainda não há envios para esta conta.</li>}
              </ul>
            </>
          )}
        </div>
      </section>

      <section className="pf-card aviso-central">
        <h2>Alertas que você recebe</h2>
        <p className="apoio">As preferências valem para novos alertas na central e no celular.</p>
        <div className="categorias">
          {props.preferencia.map((item) => (
            <label key={item.categoria} className="categoria">
              <span>{CATEGORIAS[item.categoria]}</span>
              <input type="checkbox" defaultChecked={item.ativa} disabled={props.salvandoCategoria !== null}
                onChange={(e) => props.alterarCategoria(e, item)} />
            </label>
          ))}
        </div>
      </section>
    </div>
  );
}

export default function Notificacoes() {
  const navegar = useNavigate();
  const total = useTotalNaoLidas();
  const [itens, setItens] = useState<Notificacao[]>([]);
  const [preferencia, setPreferencia] = useState<PreferenciaNotificacao[]>([]);
  const [mostraPreferencias, setMostraPreferencias] = useState(false);
  const [soNaoLidas, setSoNaoLidas] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [carregandoPreferencias, setCarregandoPreferencias] = useState(false);
  const [erro, setErro] = useState('');
  const [erroPreferencias, setErroPreferencias] = useState('');
  const [mais, setMais] = useState(false);
  const [marcando, setMarcando] = useState(false);
  const [salvandoCategoria, setSalvandoCategoria] = useState<Categoria | null>(null);
  const [config, setConfig] = useState<ConfiguracaoPush | null>(null);
  const [pushOcupado, setPushOcupado] = useState(false);
  const [pushMensagem, setPushMensagem] = useState('');
  const [diagnostico, setDiagnostico] = useState<DiagnosticoPush[] | null>(null);
  const [diagnosticoOcupado, setDiagnosticoOcupado] = useState(false);
  const [pushBloqueado, setPushBloqueado] = useState(permissaoNegada);
  const podeAtivarPush = SUPORTA_PUSH && !!config?.pronto && !pushBloqueado;

  // Valores atuais para as funções assíncronas e os ouvintes de eventos.
  const estado = useRef({ itens, soNaoLidas, mostraPreferencias });
  estado.current = { itens, soNaoLidas, mostraPreferencias };
  const requisicao = useRef(0);

  const carregar = useCallback(async (proxima = false, naoLidas?: boolean) => {
    const antes = proxima ? estado.current.itens.at(-1)?.id : undefined;
    const atual = ++requisicao.current;
    setCarregando(true);
    setErro('');
    try {
      const lista = await notificacoesServico.listar(naoLidas ?? estado.current.soNaoLidas, antes);
      if (atual !== requisicao.current) return;
      setItens(proxima ? [...estado.current.itens, ...lista] : lista);
      setMais(lista.length === 30);
      notificacoesServico.atualizarContador();
    } catch (e) {
      if (atual === requisicao.current) setErro(mensagemDeErro(e, 'Não foi possível consultar as notificações.'));
    } finally {
      if (atual === requisicao.current) setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
    const aoVoltar = () => { if (document.visibilityState === 'visible' && !estado.current.mostraPreferencias) void carregar(); };
    const doWorker = (e: MessageEvent) => {
      if (e.data?.tipo === 'PARKFLASH_NOTIFICACAO' && !estado.current.mostraPreferencias) void carregar();
    };
    document.addEventListener('visibilitychange', aoVoltar);
    if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('message', doWorker);
    return () => {
      document.removeEventListener('visibilitychange', aoVoltar);
      if ('serviceWorker' in navigator) navigator.serviceWorker.removeEventListener('message', doWorker);
    };
  }, [carregar]);

  function filtrar(naoLidas: boolean) {
    setSoNaoLidas(naoLidas);
    setItens([]);
    estado.current.itens = [];
    void carregar(false, naoLidas);
  }

  async function marcar(id?: number) {
    if (marcando) return;
    setMarcando(true);
    try {
      await notificacoesServico.ler(id);
      await carregar();
      avisos.sucesso(id === undefined ? 'Notificações marcadas como lidas.' : 'Notificação marcada como lida.');
    } catch (e) {
      avisos.erro(e);
    } finally {
      setMarcando(false);
    }
  }

  async function abrir(item: Notificacao) {
    if (marcando) return;
    setMarcando(true);
    try {
      if (!item.lida) await notificacoesServico.ler(item.id);
      notificacoesServico.atualizarContador();
      navegar(`${ROTAS[item.destino]}?detalhe=${item.destinoId}${item.destino === 'PAGAMENTO' ? '&aba=historico' : ''}`);
    } catch (e) {
      avisos.erro(e);
    } finally {
      setMarcando(false);
    }
  }

  async function abrirPreferencias() {
    setMostraPreferencias(true);
    setCarregandoPreferencias(true);
    setErroPreferencias('');
    setPushBloqueado(permissaoNegada());
    setPushMensagem('');
    try {
      const [lista, configuracao] = await Promise.all([notificacoesServico.preferencias(), webPushServico.configuracao()]);
      setPreferencia(lista);
      setConfig(configuracao);
    } catch (e) {
      setErroPreferencias(mensagemDeErro(e, 'Não foi possível consultar as preferências.'));
    } finally {
      setCarregandoPreferencias(false);
    }
  }

  async function alterarCategoria(evento: React.ChangeEvent<HTMLInputElement>, item: PreferenciaNotificacao) {
    const campo = evento.target;
    const ativa = campo.checked;
    setSalvandoCategoria(item.categoria);
    try {
      await notificacoesServico.preferir(item.categoria, ativa);
      setPreferencia((lista) => lista.map((p) => (p.categoria === item.categoria ? { ...p, ativa } : p)));
    } catch (e) {
      campo.checked = item.ativa;
      avisos.erro(e);
    } finally {
      setSalvandoCategoria(null);
    }
  }

  async function ativarPush() {
    const chave = config?.chavePublica;
    if (!chave || pushOcupado || !podeAtivarPush) return;
    setPushOcupado(true);
    setPushMensagem('Ativando neste aparelho…');
    try {
      const ativo = await webPushServico.ativar(chave);
      setPushBloqueado(Notification.permission === 'denied');
      setConfig(await webPushServico.configuracao());
      setPushMensagem(ativo ? 'Push ativado neste dispositivo.' : 'A permissão de push não foi concedida.');
    } catch (e) {
      setPushBloqueado(Notification.permission === 'denied');
      setPushMensagem(mensagemDeErro(e, e instanceof Error ? e.message : 'Não foi possível ativar o push.'));
    } finally {
      setPushOcupado(false);
    }
  }

  async function testarPush() {
    if (pushOcupado || !config?.inscrito || !config?.envioAtivo) return;
    setPushOcupado(true);
    setPushMensagem('Enviando o aviso de teste…');
    try {
      const resultado = await webPushServico.testar();
      switch (resultado.estado) {
        case 'ACEITA':
          setPushMensagem('O provedor aceitou o envio. Confira a bandeja de notificações deste aparelho.');
          break;
        case 'EXPIRADA':
          setConfig(await webPushServico.configuracao());
          setPushMensagem('A inscrição expirou. Ative o push novamente neste aparelho.');
          break;
        case 'FALHA_REDE':
          setPushMensagem('Falha de conexão com o provedor. Tente novamente em instantes.');
          break;
        default:
          setPushMensagem(`O provedor recusou o envio (HTTP ${resultado.codigo}).`);
      }
    } catch (e) {
      setPushMensagem(mensagemDeErro(e, 'Não foi possível enviar o aviso de teste.'));
    } finally {
      setPushOcupado(false);
    }
  }

  async function desativarPush() {
    if (pushOcupado) return;
    setPushOcupado(true);
    setPushMensagem('');
    try {
      await webPushServico.desativar();
      setConfig(await webPushServico.configuracao());
      setPushMensagem('Push desativado neste dispositivo.');
    } catch (e) {
      avisos.erro(e);
    } finally {
      setPushOcupado(false);
    }
  }

  async function consultarDiagnostico() {
    setDiagnosticoOcupado(true);
    try {
      setDiagnostico(await webPushServico.diagnostico());
    } catch (e) {
      avisos.erro(e);
    } finally {
      setDiagnosticoOcupado(false);
    }
  }

  function sairDasPreferencias() {
    setMostraPreferencias(false);
    void carregar();
  }

  return (
    <pf-notificacoes>
      <div className="pf-page central">
        <CabecalhoPagina titulo="Notificações">
          {mostraPreferencias
            ? <button type="button" className="pf-btn pf-btn--ghost" onClick={sairDasPreferencias}>Voltar à central</button>
            : <button type="button" className="pf-btn pf-btn--ghost" onClick={abrirPreferencias}>Preferências</button>}
        </CabecalhoPagina>

        {mostraPreferencias ? (
          carregandoPreferencias ? (
            <p className="pf-card aviso-central" role="status">Carregando preferências…</p>
          ) : erroPreferencias ? (
            <div className="pf-card aviso-central">
              <p className="pf-error" role="alert">{erroPreferencias}</p>
              <button type="button" className="pf-btn pf-btn--ghost" onClick={abrirPreferencias}>Tentar novamente</button>
            </div>
          ) : (
            <Preferencias config={config} preferencia={preferencia} pushBloqueado={pushBloqueado} pushOcupado={pushOcupado}
              pushMensagem={pushMensagem} diagnostico={diagnostico} diagnosticoOcupado={diagnosticoOcupado}
              salvandoCategoria={salvandoCategoria} podeAtivarPush={podeAtivarPush} atualizar={abrirPreferencias}
              ativar={ativarPush} testar={testarPush} desativar={desativarPush} consultarDiagnostico={consultarDiagnostico}
              alterarCategoria={alterarCategoria} />
          )
        ) : (
          <>
            <div className="barra-central">
              <div className="acoes" role="group" aria-label="Filtrar notificações">
                <button type="button" className={`pf-btn ${!soNaoLidas ? 'pf-btn--dark' : 'pf-btn--ghost'}`} aria-pressed={!soNaoLidas} onClick={() => filtrar(false)}>Todas</button>
                <button type="button" className={`pf-btn ${soNaoLidas ? 'pf-btn--dark' : 'pf-btn--ghost'}`} aria-pressed={soNaoLidas} onClick={() => filtrar(true)}>
                  Não lidas {total !== null && `(${total})`}
                </button>
              </div>
              <div className="acoes">
                <button type="button" className="pf-btn pf-btn--ghost" disabled={carregando} onClick={() => carregar()}>Atualizar</button>
                {!!total && <button type="button" className="pf-btn pf-btn--ghost" disabled={marcando} onClick={() => marcar()}>Marcar todas como lidas</button>}
              </div>
            </div>
            {erro ? (
              <div className="pf-card aviso-central">
                <p className="pf-error" role="alert">{erro}</p>
                <button type="button" className="pf-btn pf-btn--ghost" onClick={() => carregar()}>Tentar novamente</button>
              </div>
            ) : carregando && !itens.length ? (
              <p className="pf-card aviso-central" role="status">Carregando notificações…</p>
            ) : !itens.length ? (
              <div className="pf-card aviso-central">
                <h2>{soNaoLidas ? 'Você está em dia' : 'Nenhuma notificação por enquanto'}</h2>
                <p className="apoio">{soNaoLidas ? 'Novos alertas aparecerão aqui.' : 'Os alertas das suas unidades aparecerão nesta central.'}</p>
              </div>
            ) : (
              <>
                <ul className="lista-central" aria-busy={carregando}>
                  {itens.map((item) => (
                    <li key={item.id} className={`pf-card notificacao${!item.lida ? ' notificacao--nova' : ''}`}>
                      <div className="notificacao__info">
                        <time dateTime={item.criadoEm}>{dataHora(item.criadoEm, 'dd/MM/yyyy HH:mm', '-0300')}</time>
                        {!item.lida && <span className="pf-badge pf-badge--blue">Não lida</span>}
                        <h2>{item.titulo}</h2>
                      </div>
                      <div className="acoes">
                        {!item.lida && <button type="button" className="pf-btn pf-btn--ghost" disabled={marcando} onClick={() => marcar(item.id)}>Marcar como lida</button>}
                        <button type="button" className="pf-btn pf-btn--ghost" disabled={marcando} onClick={() => abrir(item)}>{ROTULO_ABRIR[item.destino]}</button>
                      </div>
                    </li>
                  ))}
                </ul>
                {mais && (
                  <button type="button" className="pf-btn pf-btn--ghost" disabled={carregando} onClick={() => carregar(true)}>
                    {carregando ? 'Carregando…' : 'Carregar anteriores'}
                  </button>
                )}
              </>
            )}
          </>
        )}
      </div>
    </pf-notificacoes>
  );
}
