import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Icone } from '../../compartilhado/Icone';
import { useSeo } from '../../compartilhado/useSeo';
import { PerdidinhoTardio } from '../../compartilhado/perdidinho';
import { PerdidinhoDiz } from '../../compartilhado/perdidinho/PerdidinhoDiz';
import type { HumorMascote } from '../../nucleo/onboarding/mascote';
import { movimentoLivre, reduzido } from '../../compartilhado/movimento';
import { useAuth } from '../../nucleo/estado/auth';
import { rotaInicial } from '../../nucleo/servicos/permissoes';
import { AgendaExemplo } from './AgendaExemplo';
import { RodapePublico } from './RodapePublico';
import { TopoPublico } from './TopoPublico';
import './conheca.scss';

gsap.registerPlugin(ScrollTrigger);

/**
 * Apresentação comercial do Park Flash (página inicial para quem não está logado).
 * Só descreve o que o sistema já faz — sem clientes, depoimentos, números ou preços.
 * A demo e as imagens usam dados fictícios.
 */
/** A demo interativa carrega sob demanda (só quando a seção chega perto da tela). */
const DemoInterativa = lazy(() => import('./DemoInterativa'));

/** Verdadeiro quando a consulta de mídia vale (acompanha mudanças de largura). */
function useMidia(consulta: string): boolean {
  const [vale, setVale] = useState(() => window.matchMedia(consulta).matches);
  useEffect(() => {
    const m = window.matchMedia(consulta);
    const aoMudar = () => setVale(m.matches);
    aoMudar();
    m.addEventListener('change', aoMudar);
    return () => m.removeEventListener('change', aoMudar);
  }, [consulta]);
  return vale;
}

/** Vira verdadeiro (uma vez) quando `fracao` do elemento aparece na tela. Sem IntersectionObserver, já nasce verdadeiro. */
function useEntrouNaTela(ref: RefObject<Element>, fracao: number): boolean {
  const [entrou, setEntrou] = useState(() => !('IntersectionObserver' in window));
  useEffect(() => {
    const el = ref.current;
    if (entrou || !el) return;
    const observador = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setEntrou(true); observador.disconnect(); }
    }, { threshold: fracao });
    observador.observe(el);
    return () => observador.disconnect();
  }, [ref, fracao, entrou]);
  return entrou;
}

/** Verdadeiro enquanto qualquer parte do elemento está na tela (acompanha a rolagem). */
function useNaTela(ref: RefObject<Element>, ativo: boolean): boolean {
  const [naTela, setNaTela] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!ativo || !el || !('IntersectionObserver' in window)) { setNaTela(false); return; }
    const observador = new IntersectionObserver(([e]) => setNaTela(e.isIntersecting));
    observador.observe(el);
    return () => observador.disconnect();
  }, [ref, ativo]);
  return naTela;
}

/** Espera antes de o Perdidinho da chamada ficar feliz com "Ver planos" (passar o mouse de raspão não conta). */
const ESPERA_FELIZ_MS = 150;

const PERFIS = [
  {
    icone: 'manobristas', titulo: 'Operador', texto: 'Lança o turno pelo celular, sem complicação.',
    itens: ['Nova ficha em etapas, feita para o polegar', 'Conta de carros e saldo automáticas', 'Rascunho salvo se a internet cair', 'Vê só o que precisa'],
  },
  {
    icone: 'usuarios', titulo: 'Gerente', texto: 'Confere o caixa e mantém a equipe paga em dia.',
    itens: ['Conferência e fechamento das fichas', 'Pagamentos de manobristas com chave Pix', 'Despesas, eventos e escalas', 'Notificações no celular'],
  },
  {
    icone: 'socios', titulo: 'Proprietário', texto: 'Vê o resultado de todas as unidades e decide com números do mês.',
    itens: ['Painel com faturamento, custos e resultado', 'Relatórios em PDF e Excel', 'Divisão de lucro entre sócios', 'Usuários e permissões'],
  },
];

const RECURSOS = [
  { icone: 'carros', titulo: 'Controle de veículos', texto: 'Carros por turno a partir da numeração dos tickets, com cancelamentos e totais por dia, por mês e por unidade.' },
  { icone: 'relatorios', titulo: 'Relatórios em PDF e Excel', texto: 'Receita, custos das fichas, despesas fixas e resultado do período, com o detalhamento de carros por dia.' },
  { icone: 'lucro', titulo: 'Divisão de lucro', texto: 'O resultado de cada unidade dividido entre os sócios conforme a participação configurada.' },
  { icone: 'eventos', titulo: 'Calendário de eventos', texto: 'Veja quantos eventos há em cada dia, planeje a operação e organize as escalas da equipe. Tudo aparece também no seu Google Calendar.' },
  { icone: 'sinoAtivo', titulo: 'Notificações', texto: 'Avisos de fichas para conferir e pagamentos pendentes, também no celular quando ativados.' },
  { icone: 'busca', titulo: 'Busca rápida', texto: 'Pressione ⌘K ou Ctrl+K para ir a qualquer tela ou encontrar uma ficha pela data ou unidade.' },
  { icone: 'filtro', titulo: 'Filtros que viram link', texto: 'Mês, unidade e situação ficam no endereço da página: compartilhe e a outra pessoa vê a mesma lista.' },
  { icone: 'tour', titulo: 'Tour guiado', texto: 'No primeiro acesso, um passo a passo curto mostra o essencial para o perfil de cada pessoa.' },
  { icone: 'historico', titulo: 'Histórico de tudo', texto: 'Quem lançou, enviou, devolveu, fechou ou reabriu cada ficha, com data e motivo.' },
];

const CELULAR = [
  { icone: 'celular', titulo: 'Instala como aplicativo', texto: 'No Android, pelo Chrome; no iPhone, em Compartilhar → Adicionar à Tela de Início. Abre em tela cheia, sem barra do navegador.' },
  { icone: 'sinoAtivo', titulo: 'Avisos no celular', texto: 'Com as notificações ativadas, a gestão recebe os avisos mesmo com o celular bloqueado. A mensagem não mostra valores nem dados pessoais.' },
];

const SEGURANCA = [
  { icone: 'seguro', titulo: 'Permissões no servidor', texto: 'Proprietário, gerente e operador veem apenas o que podem. A regra vale no servidor, não só na tela.' },
  { icone: 'chave', titulo: 'Senhas e chaves Pix protegidas', texto: 'Senhas guardadas com criptografia (BCrypt). Chaves Pix criptografadas e cada consulta da chave completa fica registrada.' },
  { icone: 'historico', titulo: 'Trilha de auditoria', texto: 'Alterações em fichas, pagamentos, usuários e unidades ficam no histórico, com autor e data.' },
  { icone: 'unidades', titulo: 'Acesso por unidade', texto: 'Gerentes e operadores só enxergam as unidades liberadas para eles.' },
];

/** Como ligar a agenda: é mesmo uma sequência, por isso numerada. */
const PASSOS_AGENDA = [
  { titulo: 'Gere o link no seu Perfil', texto: 'Um clique em “Gerar link da agenda”. Cada pessoa tem o seu, e dá para desativar quando quiser.' },
  { titulo: 'Cole no Google Calendar', texto: 'O botão abre a tela “Adicionar agenda por URL”. Cole o link, e a agenda Park Flash aparece no computador e no celular.' },
  { titulo: 'Pronto: a operação na sua agenda', texto: 'Eventos e escalas das suas unidades, com local, contratante e equipe. O que muda no Park Flash chega lá sozinho.' },
];

const PERGUNTAS = [
  { p: 'Preciso instalar alguma coisa?', r: 'Não. O Park Flash funciona no navegador do computador e do celular. Se quiser, dá para instalar na tela inicial como um aplicativo.' },
  { p: 'Funciona no iPhone e no Android?', r: 'Sim. No iPhone (iOS 16.4 ou mais novo), as notificações exigem adicionar o Park Flash à Tela de Início.' },
  { p: 'O sistema faz a transferência para os manobristas?', r: 'Não. O Park Flash mostra o valor e a chave Pix; o pagamento é feito pelo seu banco e você confirma no sistema, que atualiza a situação e o histórico.' },
  { p: 'Posso ter mais de uma unidade?', r: 'Sim. Cada unidade tem suas fichas, despesas e relatórios, e você define quem acessa cada uma.' },
  { p: 'Funciona com o Google Calendar?', r: 'Sim. Gerentes e proprietários geram, no Perfil, um link da agenda e colam no Google Calendar. Os eventos e as escalas das unidades de cada um aparecem lá e se atualizam sozinhos, em algumas horas. Também funciona no calendário do iPhone e no Outlook.' },
  { p: 'E se a internet cair no meio da ficha?', r: 'O que já foi digitado fica salvo no aparelho. Ao voltar para a tela, o sistema oferece continuar de onde parou.' },
];

const TEXTO_GUIA_FAQ = 'Ficou com alguma dúvida? Abra uma pergunta.';

export default function Conheca() {
  useSeo({
    titulo: 'Park Flash — Gestão para estacionamentos e valet',
    descricao: 'Park Flash reúne fichas de caixa por turno, equipe, pagamentos de manobristas e relatórios do seu estacionamento em um só lugar.',
    caminho: '/conheca',
  });
  const raiz = useRef<HTMLDivElement>(null);
  const { hash } = useLocation();
  const logado = useAuth((s) => s.usuario?.nivel ?? null);
  const destino = logado ? rotaInicial(logado) : '/login';
  const rotuloEntrar = logado ? 'Abrir o sistema' : 'Entrar';
  const telaEstreita = useMidia('(max-width: 640px)');

  // A demo só é baixada e montada quando a seção entra na tela; a reserva de altura evita salto de layout.
  const reservaDemo = useRef<HTMLDivElement>(null);
  const demoMontada = useEntrouNaTela(reservaDemo, 0);

  // FAQ: o Perdidinho explica até a primeira pergunta aberta, e daí fica feliz (o texto não muda).
  const secaoFaq = useRef<HTMLElement>(null);
  const guiaFaq = useRef<HTMLDivElement>(null);
  const faqMontado = useEntrouNaTela(secaoFaq, 0.4);
  const faqNaTela = useNaTela(guiaFaq, faqMontado);
  const [faqAberto, setFaqAberto] = useState(false);

  // Chamada final: acena; fica feliz ao mirar "Ver planos". Some enquanto o do FAQ estiver na tela
  // (as duas seções são vizinhas; nunca dois Perdidinhos à vista ao mesmo tempo).
  const secaoChamada = useRef<HTMLElement>(null);
  const chamadaMontada = useEntrouNaTela(secaoChamada, 0.5);
  const [humorChamada, setHumorChamada] = useState<HumorMascote>('acenando');
  const esperaFeliz = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(esperaFeliz.current), []);
  const mirarPlanos = () => {
    clearTimeout(esperaFeliz.current);
    esperaFeliz.current = setTimeout(() => setHumorChamada('feliz'), ESPERA_FELIZ_MS);
  };
  const soltarPlanos = () => {
    clearTimeout(esperaFeliz.current);
    setHumorChamada('acenando');
  };

  // Links do menu (/#recursos) levam até a seção.
  useEffect(() => {
    if (!hash) return;
    requestAnimationFrame(() => document.querySelector(hash)?.scrollIntoView({ behavior: 'smooth' }));
  }, [hash]);

  useLayoutEffect(() => {
    const el = raiz.current;
    if (!el) return;
    const media = gsap.matchMedia();
    media.add(movimentoLivre, () => {
      gsap.timeline({ defaults: { ease: 'expo.out', duration: 0.9 } })
        .from(el.querySelectorAll('.heroi [data-anima]'), { opacity: 0, y: 22, stagger: 0.08 })
        .from(el.querySelector('.heroi__janela'), { opacity: 0, y: 40, rotateX: 8, transformPerspective: 1200, duration: 1.1 }, 0.15);
      el.querySelectorAll<HTMLElement>('[data-revelar]').forEach((secao) => {
        gsap.from(secao.querySelectorAll('[data-item]'), {
          opacity: 0, y: 26, stagger: 0.07, duration: 0.8, ease: 'expo.out',
          scrollTrigger: { trigger: secao, start: 'top 80%' },
        });
      });
    });
    return () => media.revert();
  }, []);

  return (
    <pf-conheca>
      <div ref={raiz} className="lp">
        <TopoPublico />

        <main id="conteudo" tabIndex={-1}>
          <section className="heroi">
            <div className="heroi__texto">
              <p className="sobre" data-anima>Gestão para estacionamentos e serviços de valet</p>
              <h1 data-anima>Seu estacionamento, <span>sob controle.</span></h1>
              <p className="heroi__sub" data-anima>
                O Park Flash reúne o caixa de cada turno, o controle de veículos, o pagamento da equipe e os relatórios do mês em um só lugar — no computador e no celular. Teste o turno completo logo abaixo, com dados fictícios.
              </p>
              <div className="heroi__acoes" data-anima>
                <a className="pf-btn pf-btn--primary" href="#como-funciona">Experimente em 1 minuto<Icone nome="seta" tamanho={16} /></a>
                <Link className="pf-btn pf-btn--ghost" to={destino}>{rotuloEntrar}</Link>
              </div>
              <ul className="heroi__selos" data-anima>
                <li><Icone nome="check" tamanho={14} />Funciona no navegador</li>
                <li><Icone nome="check" tamanho={14} />Instala no celular</li>
                <li><Icone nome="check" tamanho={14} />Sem planilha paralela</li>
              </ul>
            </div>
            <div className="heroi__visual" aria-hidden="true">
              <figure className="heroi__janela">
                <div className="janela__barra"><span /><span /><span /></div>
                <img src="/midia/conheca/fichas.webp" width={1280} height={800} alt="" />
              </figure>
            </div>
          </section>

          <section id="como-funciona" className="secao fluxo" data-revelar>
            <div className="secao__cabeca" data-item>
              <p className="sobre">Como funciona</p>
              <h2>Do lançamento ao pagamento da equipe</h2>
              <p>Experimente: quatro passos, com dados fictícios. Nada é enviado.</p>
            </div>
            <div ref={reservaDemo} className="demo-reserva">
              {demoMontada && (
                <Suspense fallback={null}>
                  <DemoInterativa />
                </Suspense>
              )}
            </div>
          </section>

          <section className="secao perfis" data-revelar>
            <div className="secao__cabeca" data-item>
              <p className="sobre">Para cada pessoa da operação</p>
              <h2>Quem faz cada parte do turno que você acabou de ver</h2>
              <p>As telas e o menu se adaptam ao perfil de quem entra.</p>
            </div>
            <div className="perfis__grade">
              {PERFIS.map((p) => (
                <article key={p.titulo} className="perfil" data-item>
                  <span className="recurso__icone"><Icone nome={p.icone} tamanho={20} /></span>
                  <h3>{p.titulo}</h3>
                  <p>{p.texto}</p>
                  <ul>{p.itens.map((i) => <li key={i}><Icone nome="check" tamanho={14} />{i}</li>)}</ul>
                </article>
              ))}
            </div>
          </section>

          <section id="recursos" className="secao recursos" data-revelar>
            <div className="secao__cabeca" data-item>
              <p className="sobre">Recursos</p>
              <h2>Além do turno: o que mais já está no Park Flash</h2>
            </div>
            <div className="recursos__grade">
              {RECURSOS.map((r) => (
                <article key={r.titulo} className="recurso" data-item>
                  <span className="recurso__icone"><Icone nome={r.icone} tamanho={20} /></span>
                  <h3>{r.titulo}</h3>
                  <p>{r.texto}</p>
                </article>
              ))}
            </div>
          </section>

          <section id="agenda" className="secao agenda" data-revelar>
            <div className="agenda__texto">
              <div className="secao__cabeca" data-item>
                <p className="sobre">Google Calendar</p>
                <h2>A agenda da operação no seu Google Calendar</h2>
                <p>Eventos e escalas aparecem junto com os seus compromissos, no computador e no celular, sem digitar nada duas vezes.</p>
              </div>
              <ol className="agenda__passos">
                {PASSOS_AGENDA.map((passo, i) => (
                  <li key={passo.titulo} data-item>
                    <span className="agenda__numero">{i + 1}</span>
                    <div><h3>{passo.titulo}</h3><p>{passo.texto}</p></div>
                  </li>
                ))}
              </ol>
              <p className="agenda__nota" data-item>Também funciona no calendário do iPhone e no Outlook. Operadores não recebem o link.</p>
              <Link className="pf-btn pf-btn--ghost agenda__mais" to="/google-calendar" data-item>Ver tudo sobre a integração<Icone nome="seta" tamanho={16} /></Link>
            </div>

            <AgendaExemplo />
          </section>

          <section id="celular" className="secao celular" data-revelar>
            <div className="secao__cabeca" data-item>
              <p className="sobre">No celular</p>
              <h2>Feito para quem está no pátio</h2>
              <p>O operador lança a ficha de pé, com uma mão, e a gestão acompanha de onde estiver.</p>
            </div>
            <div className="celular__grade">
              {CELULAR.map((c) => (
                <article key={c.titulo} className="celular__item" data-item>
                  <span className="recurso__icone"><Icone nome={c.icone} tamanho={20} /></span>
                  <div><h3>{c.titulo}</h3><p>{c.texto}</p></div>
                </article>
              ))}
            </div>
          </section>

          <section id="seguranca" className="secao seguranca" data-revelar>
            <div className="secao__cabeca" data-item>
              <p className="sobre">Segurança</p>
              <h2>Dinheiro e dados da equipe tratados com cuidado</h2>
            </div>
            <div className="recursos__grade recursos__grade--4">
              {SEGURANCA.map((r) => (
                <article key={r.titulo} className="recurso" data-item>
                  <span className="recurso__icone"><Icone nome={r.icone} tamanho={20} /></span>
                  <h3>{r.titulo}</h3>
                  <p>{r.texto}</p>
                </article>
              ))}
            </div>
          </section>

          <section ref={secaoFaq} className="secao perguntas" data-revelar>
            <div className="secao__cabeca" data-item>
              <p className="sobre">Perguntas frequentes</p>
              <h2>Antes de começar</h2>
              {/* O espaço do balão fica reservado (cópia invisível do texto), então nada pula ao montar. */}
              <div ref={guiaFaq} className="perguntas__guia" style={{ '--guia-tamanho': `${telaEstreita ? 40 : 48}px` } as CSSProperties}>
                <div className="perguntas__reserva" aria-hidden="true">{TEXTO_GUIA_FAQ}</div>
                {faqMontado && (
                  <div className="perguntas__guia-entra">
                    <PerdidinhoDiz humor={faqAberto ? 'feliz' : 'explicando'} texto={TEXTO_GUIA_FAQ}
                      lado="esquerda" tamanho={telaEstreita ? 40 : 48} anunciar={false} />
                  </div>
                )}
              </div>
            </div>
            <div className="perguntas__lista">
              {PERGUNTAS.map((q) => (
                <details key={q.p} className="pergunta" data-item
                  onToggle={(e) => { if (e.currentTarget.open) setFaqAberto(true); }}>
                  <summary>{q.p}<Icone nome="abrir" tamanho={18} /></summary>
                  <p>{q.r}</p>
                </details>
              ))}
            </div>
          </section>

          <section ref={secaoChamada} className="secao chamada" data-revelar>
            {/* A caixa corta o que passa da borda (overflow): o Perdidinho fica no invólucro, sentado na borda de cima. */}
            <div className="chamada__moldura">
              <div className="chamada__guia" aria-hidden="true" data-visivel={(chamadaMontada && !faqNaTela) || undefined}
                style={{ '--guia-tamanho': `${telaEstreita ? 48 : 64}px` } as CSSProperties}>
                {chamadaMontada && (
                  <PerdidinhoTardio decorativo tamanho={telaEstreita ? 48 : 64} humor={humorChamada} falando={false}
                    passo={`chamada-${humorChamada}`} lado="centro" reduzirMovimento={reduzido()} />
                )}
              </div>
              <div className="chamada__caixa" data-item>
                <h2>Pronto para organizar o próximo turno?</h2>
                <p>Veja os planos ou entre com o acesso fornecido pelo proprietário da sua operação.</p>
                <div className="chamada__acoes">
                  <Link className="pf-btn pf-btn--primary" to="/planos" onMouseEnter={mirarPlanos} onFocus={mirarPlanos}
                    onMouseLeave={soltarPlanos} onBlur={soltarPlanos}>Ver planos<Icone nome="seta" tamanho={16} /></Link>
                  <Link className="pf-btn chamada__secundario" to={destino}>{rotuloEntrar}</Link>
                </div>
              </div>
            </div>
          </section>
        </main>

        <RodapePublico atual="/conheca" nota="A demonstração e as imagens usam dados fictícios." />
      </div>
    </pf-conheca>
  );
}
