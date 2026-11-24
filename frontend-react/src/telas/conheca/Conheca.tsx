import { useEffect, useLayoutEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Icone } from '../../compartilhado/Icone';
import { Logo } from '../../compartilhado/Logo';
import { movimentoLivre } from '../../compartilhado/movimento';
import { useAuth } from '../../nucleo/estado/auth';
import { rotaInicial } from '../../nucleo/servicos/permissoes';
import { TopoPublico } from './TopoPublico';
import './conheca.scss';

gsap.registerPlugin(ScrollTrigger);

/**
 * Apresentação comercial do Park Flash (página inicial para quem não está logado).
 * Só descreve o que o sistema já faz — sem clientes, depoimentos, números ou preços.
 * As imagens são capturas reais da interface com dados de demonstração.
 */
const ETAPAS = [
  { icone: 'fichas', titulo: 'Lance o turno', texto: 'O operador registra a numeração inicial e final dos tickets, os cancelados, os recebimentos em dinheiro, cartão e Pix, a equipe e as despesas do dia. O rascunho fica salvo no aparelho enquanto ele preenche.' },
  { icone: 'enviar', titulo: 'Envie para conferência', texto: 'A ficha vai para a gestão com o saldo já calculado. Se algo não bate, a gestão devolve com o motivo ou sinaliza uma divergência.' },
  { icone: 'sucesso', titulo: 'Feche o caixa', texto: 'Ao confirmar o fechamento, a ficha fica bloqueada para alterações e o histórico de quem fez o quê permanece registrado.' },
  { icone: 'pagamentos', titulo: 'Pague a equipe', texto: 'As diárias reconhecidas aparecem com a chave Pix do manobrista. Você paga pelo seu banco e confirma no sistema.' },
];

const PERFIS = [
  {
    icone: 'socios', titulo: 'Proprietário', texto: 'Vê o resultado de todas as unidades e decide com números do mês.',
    itens: ['Painel com faturamento, custos e resultado', 'Relatórios em PDF e Excel', 'Divisão de lucro entre sócios', 'Usuários e permissões'],
  },
  {
    icone: 'usuarios', titulo: 'Gerente', texto: 'Confere o caixa e mantém a equipe paga em dia.',
    itens: ['Conferência e fechamento das fichas', 'Pagamentos de manobristas com chave Pix', 'Despesas, eventos e escalas', 'Notificações no celular'],
  },
  {
    icone: 'manobristas', titulo: 'Operador', texto: 'Lança o turno pelo celular, sem complicação.',
    itens: ['Nova ficha em etapas, feita para o polegar', 'Conta de carros e saldo automáticas', 'Rascunho salvo se a internet cair', 'Vê só o que precisa'],
  },
];

const RECURSOS = [
  { icone: 'carros', titulo: 'Controle de veículos', texto: 'Carros por turno a partir da numeração dos tickets, com cancelamentos e totais por dia, por mês e por unidade.' },
  { icone: 'relatorios', titulo: 'Relatórios em PDF e Excel', texto: 'Receita, custos das fichas, despesas fixas e resultado do período, com o detalhamento de carros por dia.' },
  { icone: 'lucro', titulo: 'Divisão de lucro', texto: 'O resultado de cada unidade dividido entre os sócios conforme a participação configurada.' },
  { icone: 'eventos', titulo: 'Calendário de eventos', texto: 'Veja quantos eventos há em cada dia, planeje a operação e organize as escalas da equipe.' },
  { icone: 'sinoAtivo', titulo: 'Notificações', texto: 'Avisos de fichas para conferir e pagamentos pendentes, também no celular quando ativados.' },
  { icone: 'busca', titulo: 'Busca rápida', texto: 'Pressione ⌘K ou Ctrl+K para ir a qualquer tela ou encontrar uma ficha pela data ou unidade.' },
  { icone: 'filtro', titulo: 'Filtros que viram link', texto: 'Mês, unidade e situação ficam no endereço da página: compartilhe e a outra pessoa vê a mesma lista.' },
  { icone: 'tour', titulo: 'Tour guiado', texto: 'No primeiro acesso, um passo a passo curto mostra o essencial para o perfil de cada pessoa.' },
  { icone: 'historico', titulo: 'Histórico de tudo', texto: 'Quem lançou, enviou, devolveu, fechou ou reabriu cada ficha, com data e motivo.' },
];

const CELULAR = [
  { icone: 'celular', titulo: 'Instala como aplicativo', texto: 'No Android, pelo Chrome; no iPhone, em Compartilhar → Adicionar à Tela de Início. Abre em tela cheia, sem barra do navegador.' },
  { icone: 'sinoAtivo', titulo: 'Avisos no celular', texto: 'Com as notificações ativadas, a gestão recebe os avisos mesmo com o celular bloqueado. A mensagem não mostra valores nem dados pessoais.' },
  { icone: 'documento', titulo: 'Rascunho automático', texto: 'O que o operador digita fica salvo no aparelho. Se a sessão expirar ou a internet cair, é só voltar e continuar.' },
  { icone: 'mais', titulo: 'Feito para uma mão', texto: 'Barra de navegação embaixo, botões grandes e listas que abrem na parte de baixo da tela, ao alcance do polegar.' },
];

const SEGURANCA = [
  { icone: 'seguro', titulo: 'Permissões no servidor', texto: 'Proprietário, gerente e operador veem apenas o que podem. A regra vale no servidor, não só na tela.' },
  { icone: 'chave', titulo: 'Senhas e chaves Pix protegidas', texto: 'Senhas guardadas com criptografia (BCrypt). Chaves Pix criptografadas e cada consulta da chave completa fica registrada.' },
  { icone: 'historico', titulo: 'Trilha de auditoria', texto: 'Alterações em fichas, pagamentos, usuários e unidades ficam no histórico, com autor e data.' },
  { icone: 'unidades', titulo: 'Acesso por unidade', texto: 'Gerentes e operadores só enxergam as unidades liberadas para eles.' },
];

const PERGUNTAS = [
  { p: 'Preciso instalar alguma coisa?', r: 'Não. O Park Flash funciona no navegador do computador e do celular. Se quiser, dá para instalar na tela inicial como um aplicativo.' },
  { p: 'Funciona no iPhone e no Android?', r: 'Sim. No iPhone (iOS 16.4 ou mais novo), as notificações exigem adicionar o Park Flash à Tela de Início.' },
  { p: 'O sistema faz a transferência para os manobristas?', r: 'Não. O Park Flash mostra o valor e a chave Pix; o pagamento é feito pelo seu banco e você confirma no sistema, que atualiza a situação e o histórico.' },
  { p: 'Posso ter mais de uma unidade?', r: 'Sim. Cada unidade tem suas fichas, despesas e relatórios, e você define quem acessa cada uma.' },
  { p: 'E se a internet cair no meio da ficha?', r: 'O que já foi digitado fica salvo no aparelho. Ao voltar para a tela, o sistema oferece continuar de onde parou.' },
];

export default function Conheca() {
  const raiz = useRef<HTMLDivElement>(null);
  const { hash } = useLocation();
  const logado = useAuth((s) => s.usuario?.nivel ?? null);
  const destino = logado ? rotaInicial(logado) : '/login';
  const rotuloEntrar = logado ? 'Abrir o sistema' : 'Entrar';

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
        .from(el.querySelector('.heroi__janela'), { opacity: 0, y: 40, rotateX: 8, transformPerspective: 1200, duration: 1.1 }, 0.15)
        .from(el.querySelector('.heroi__celular'), { opacity: 0, y: 60, x: 20, duration: 1.1 }, 0.35);
      gsap.to(el.querySelector('.heroi__celular'), { y: -60, ease: 'none', scrollTrigger: { trigger: '.heroi', start: 'top top', end: 'bottom top', scrub: 0.6 } });
      el.querySelectorAll<HTMLElement>('[data-revelar]').forEach((secao) => {
        gsap.from(secao.querySelectorAll('[data-item]'), {
          opacity: 0, y: 26, stagger: 0.07, duration: 0.8, ease: 'expo.out',
          scrollTrigger: { trigger: secao, start: 'top 80%' },
        });
      });
      gsap.fromTo(el.querySelector('.fluxo__linha-progresso'), { scaleY: 0 }, {
        scaleY: 1, ease: 'none', scrollTrigger: { trigger: '.fluxo__lista', start: 'top 70%', end: 'bottom 60%', scrub: 0.5 },
      });
      // Telefones da seção "celular" sobem em leque.
      gsap.from(el.querySelectorAll('.celulares figure'), {
        opacity: 0, y: 60, rotate: (i: number) => (i - 1) * 4, stagger: 0.12, duration: 1, ease: 'expo.out',
        scrollTrigger: { trigger: '.celulares', start: 'top 80%' },
      });
    });
    return () => media.revert();
  }, []);

  return (
    <pf-conheca>
      <div ref={raiz} className="lp">
        <TopoPublico />

        <main>
          <section className="heroi">
            <div className="heroi__texto">
              <p className="sobre" data-anima>Gestão para estacionamentos e serviços de valet</p>
              <h1 data-anima>Seu estacionamento, <span>sob controle.</span></h1>
              <p className="heroi__sub" data-anima>
                O Park Flash reúne o caixa de cada turno, o controle de veículos, o pagamento da equipe e os relatórios do mês em um só lugar — no computador e no celular.
              </p>
              <div className="heroi__acoes" data-anima>
                <Link className="pf-btn pf-btn--primary" to={destino}>{rotuloEntrar}<Icone nome="seta" tamanho={16} /></Link>
                <Link className="pf-btn pf-btn--ghost" to="/planos">Ver planos</Link>
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
              <figure className="heroi__celular">
                <img src="/midia/conheca/celular-ficha.webp" width={390} height={800} alt="" />
              </figure>
            </div>
          </section>

          <section id="como-funciona" className="secao fluxo" data-revelar>
            <div className="secao__cabeca" data-item>
              <p className="sobre">Como funciona</p>
              <h2>Do turno ao fechamento, sem planilha paralela</h2>
              <p>Cada etapa tem um responsável e fica registrada, para que o caixa feche com segurança.</p>
            </div>
            <ol className="fluxo__lista">
              <span className="fluxo__linha" aria-hidden="true"><span className="fluxo__linha-progresso" /></span>
              {ETAPAS.map((etapa, i) => (
                <li key={etapa.titulo} className="fluxo__etapa" data-item>
                  <span className="fluxo__numero"><Icone nome={etapa.icone} tamanho={18} /></span>
                  <div>
                    <p className="fluxo__passo">Etapa {i + 1}</p>
                    <h3>{etapa.titulo}</h3>
                    <p>{etapa.texto}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section className="secao perfis" data-revelar>
            <div className="secao__cabeca" data-item>
              <p className="sobre">Para cada pessoa da operação</p>
              <h2>Cada perfil vê o que precisa</h2>
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

          <section className="secao vitrine" data-revelar>
            <div className="secao__cabeca" data-item>
              <p className="sobre">Conferência</p>
              <h2>Tudo da ficha em um painel</h2>
              <p>Tickets, recebimentos, custos da equipe e saldo final lado a lado com a lista — e o histórico de cada alteração.</p>
            </div>
            <figure className="vitrine__imagem" data-item>
              <img src="/midia/conheca/ficha-detalhe.webp" width={1280} height={800} loading="lazy"
                alt="Tela de fichas do Park Flash com o painel de detalhe aberto, mostrando tickets, caixa e saldo final." />
            </figure>
          </section>

          <section id="recursos" className="secao recursos" data-revelar>
            <div className="secao__cabeca" data-item>
              <p className="sobre">Recursos</p>
              <h2>O que já está no Park Flash</h2>
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

          <section id="celular" className="secao celular" data-revelar>
            <div className="secao__cabeca" data-item>
              <p className="sobre">No celular</p>
              <h2>Feito para quem está no pátio</h2>
              <p>O operador lança a ficha de pé, com uma mão, e a gestão acompanha de onde estiver.</p>
            </div>
            <div className="celulares" aria-hidden="true">
              <figure><img src="/midia/conheca/celular-lista.webp" width={390} height={800} loading="lazy" alt="" /></figure>
              <figure><img src="/midia/conheca/celular-ficha.webp" width={390} height={800} loading="lazy" alt="" /></figure>
              <figure><img src="/midia/conheca/celular-calendario.webp" width={390} height={800} loading="lazy" alt="" /></figure>
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

          <section className="secao perguntas" data-revelar>
            <div className="secao__cabeca" data-item>
              <p className="sobre">Perguntas frequentes</p>
              <h2>Antes de começar</h2>
            </div>
            <div className="perguntas__lista">
              {PERGUNTAS.map((q) => (
                <details key={q.p} className="pergunta" data-item>
                  <summary>{q.p}<Icone nome="abrir" tamanho={18} /></summary>
                  <p>{q.r}</p>
                </details>
              ))}
            </div>
          </section>

          <section className="secao chamada" data-revelar>
            <div className="chamada__caixa" data-item>
              <h2>Pronto para organizar o próximo turno?</h2>
              <p>Veja os planos ou entre com o acesso fornecido pelo proprietário da sua operação.</p>
              <div className="chamada__acoes">
                <Link className="pf-btn pf-btn--primary" to="/planos">Ver planos<Icone nome="seta" tamanho={16} /></Link>
                <Link className="pf-btn chamada__secundario" to={destino}>{rotuloEntrar}</Link>
              </div>
            </div>
          </section>
        </main>

        <footer className="rodape">
          <Logo tamanho={15} />
          <nav aria-label="Rodapé"><Link to="/planos">Planos</Link><Link to="/login">Entrar</Link></nav>
          <p>As imagens mostram a interface real do sistema com dados de demonstração.</p>
        </footer>
      </div>
    </pf-conheca>
  );
}
