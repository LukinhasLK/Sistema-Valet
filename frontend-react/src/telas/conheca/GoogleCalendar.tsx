import { useLayoutEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { gsap } from 'gsap';
import { Icone } from '../../compartilhado/Icone';
import { Logo } from '../../compartilhado/Logo';
import { movimentoLivre } from '../../compartilhado/movimento';
import { useAuth } from '../../nucleo/estado/auth';
import { podeAcessar } from '../../nucleo/servicos/permissoes';
import { AgendaExemplo } from './AgendaExemplo';
import { TopoPublico } from './TopoPublico';
import './conheca.scss';

/** O que vai para a agenda: os mesmos campos que o servidor publica no link (.ics). */
const CONTEUDO = [
  {
    icone: 'eventos',
    titulo: 'Eventos',
    texto: 'Casamentos, festas, formaturas e tudo o que a operação atende fora da rotina.',
    itens: ['Nome, local e horário de início e fim', 'Contratante e responsável', 'Veículos e equipe previstos', 'Confirmado ou provisório (planejado)'],
  },
  {
    icone: 'escalas',
    titulo: 'Escalas',
    texto: 'Quem trabalha em cada turno, ligado ao evento quando houver um.',
    itens: ['Horário da escala', 'Unidade ou evento', 'Responsável', 'Nomes dos manobristas escalados'],
  },
];

/** Como assinar o link em cada aplicativo de agenda. É sequência, por isso numerada. */
const APLICATIVOS = [
  {
    nome: 'Google Calendar',
    onde: 'No computador',
    passos: [
      'No Park Flash, abra Meu perfil e clique em “Gerar link da agenda”.',
      'Clique em “Abrir Google Calendar”: abre a tela “Adicionar agenda por URL”.',
      'Cole o link e clique em “Adicionar agenda”.',
      'No celular, a agenda Park Flash aparece no app Google Agenda. Se não aparecer, ative-a nas configurações do app.',
    ],
  },
  {
    nome: 'iPhone',
    onde: 'Calendário da Apple',
    passos: [
      'Gere o link no Perfil e copie.',
      'Abra Ajustes, depois Calendário e Contas.',
      'Toque em Adicionar Conta, Outra e Adicionar Calendário Assinado.',
      'Cole o link e salve. Os eventos aparecem no app Calendário.',
    ],
  },
  {
    nome: 'Outlook',
    onde: 'Web ou computador',
    passos: [
      'Gere o link no Perfil e copie.',
      'No calendário do Outlook, escolha Adicionar calendário.',
      'Escolha a opção de assinar pela internet (da Web).',
      'Cole o link e dê um nome, por exemplo “Park Flash”.',
    ],
  },
];

const PERFIS = [
  { titulo: 'Proprietário', texto: 'Vê os eventos e as escalas de todas as unidades.', pode: true },
  { titulo: 'Gerente', texto: 'Vê só as unidades liberadas para ele.', pode: true },
  { titulo: 'Operador', texto: 'Não gera link. Continua lançando as fichas pelo sistema.', pode: false },
  { titulo: 'Sócio', texto: 'Não gera link. Acompanha a própria sociedade no sistema.', pode: false },
];

const SEGURANCA = [
  { icone: 'chave', titulo: 'Link pessoal e difícil de adivinhar', texto: 'Cada pessoa recebe um código longo e aleatório. O servidor guarda só uma versão embaralhada dele.' },
  { icone: 'atualizar', titulo: 'Troque ou desative quando quiser', texto: 'Gerar um link novo derruba o anterior na hora. Também dá para desativar com um clique no Perfil.' },
  { icone: 'seguro', titulo: 'Acompanha as permissões', texto: 'Se o usuário for desativado ou perder o acesso, o link para de funcionar sozinho.' },
  { icone: 'ocultar', titulo: 'Sem valores financeiros', texto: 'A agenda mostra horários, locais e equipe. Valor contratado, despesas e resultados ficam só no Park Flash.' },
];

const PERGUNTAS = [
  { p: 'De quanto em quanto tempo a agenda atualiza?', r: 'O Park Flash pede atualização a cada hora, mas quem decide é o aplicativo de agenda. O Google costuma buscar algumas vezes por dia, então uma mudança pode levar algumas horas para aparecer. iPhone e Outlook costumam ser mais rápidos.' },
  { p: 'Posso editar um evento pelo Google Calendar?', r: 'Não. A agenda é só para consulta. Para mudar horário, equipe ou situação, altere no Park Flash, e a mudança chega à agenda na próxima atualização.' },
  { p: 'O que acontece quando um evento é cancelado?', r: 'Ele sai da agenda na próxima atualização. Eventos planejados aparecem como provisórios e viram confirmados quando forem confirmados no sistema.' },
  { p: 'Perdi o link. E agora?', r: 'Por segurança, o link aparece só no momento em que é gerado. Gere outro no Perfil: o anterior para de funcionar, e é só colar o novo no Google Calendar.' },
  { p: 'Posso mandar o link para outra pessoa?', r: 'Não é recomendado: quem tiver o link vê a agenda das suas unidades. Cada gerente ou proprietário deve gerar o próprio link.' },
  { p: 'Quais datas aparecem?', r: 'Os últimos 60 dias e os próximos 12 meses, para a agenda ficar leve e útil para o planejamento.' },
];

/** Página pública sobre a integração com o Google Calendar (e outras agendas). */
export default function GoogleCalendar() {
  const raiz = useRef<HTMLDivElement>(null);
  const nivel = useAuth((s) => s.usuario?.nivel ?? null);
  const podeGerar = podeAcessar(nivel, 'eventos');
  const destino = podeGerar ? '/app/perfil' : nivel ? '/app' : `/login?redirectTo=${encodeURIComponent('/app/perfil')}`;
  const rotuloAcao = podeGerar ? 'Gerar meu link agora' : nivel ? 'Abrir o sistema' : 'Entrar e gerar meu link';

  useLayoutEffect(() => {
    const el = raiz.current;
    if (!el) return;
    const media = gsap.matchMedia();
    media.add(movimentoLivre, () => {
      gsap.timeline({ defaults: { ease: 'expo.out', duration: 0.8 } })
        .from(el.querySelectorAll('.gc__heroi-texto > *'), { opacity: 0, y: 18, stagger: 0.07 })
        .from(el.querySelector('.gc__heroi .agenda__exemplo'), { opacity: 0, y: 30, duration: 1 }, 0.15);
    });
    return () => media.revert();
  }, []);

  return (
    <pf-conheca>
      <div ref={raiz} className="lp">
        <TopoPublico />
        <main className="gc">
          <section className="gc__heroi">
            <div className="gc__heroi-texto">
              <p className="sobre">Integração com o Google Calendar</p>
              <h1>A agenda da operação junto com os seus compromissos</h1>
              <p className="gc__sub">
                Os eventos e as escalas do Park Flash aparecem no Google Calendar, no computador e no celular. Você liga uma vez,
                e o que muda no sistema chega à agenda sozinho, sem digitar nada duas vezes.
              </p>
              <div className="gc__acoes">
                <Link className="pf-btn pf-btn--primary" to={destino}>{rotuloAcao}<Icone nome="seta" tamanho={16} /></Link>
                <a className="pf-btn pf-btn--ghost" href="#como-ligar">Ver como ligar</a>
              </div>
              <ul className="heroi__selos">
                <li><Icone nome="check" tamanho={14} />Leva 1 minuto</li>
                <li><Icone nome="check" tamanho={14} />Atualiza sozinho</li>
                <li><Icone nome="check" tamanho={14} />iPhone e Outlook também</li>
              </ul>
            </div>
            <AgendaExemplo />
          </section>

          <section className="gc__bloco" aria-labelledby="gc-conteudo">
            <div className="secao__cabeca">
              <h2 id="gc-conteudo">O que aparece na sua agenda</h2>
              <p>Tudo o que a gestão precisa para planejar a semana, com os detalhes dentro de cada item.</p>
            </div>
            <div className="gc__conteudo">
              {CONTEUDO.map((c) => (
                <article key={c.titulo} className="recurso">
                  <span className="recurso__icone"><Icone nome={c.icone} tamanho={20} /></span>
                  <h3>{c.titulo}</h3>
                  <p>{c.texto}</p>
                  <ul className="gc__lista">{c.itens.map((i) => <li key={i}><Icone nome="check" tamanho={14} />{i}</li>)}</ul>
                </article>
              ))}
              <article className="gc__detalhe" aria-label="Exemplo do detalhe de um evento na agenda">
                <p className="gc__detalhe-titulo">Evento: Casamento Silva</p>
                <p className="gc__detalhe-quando">Sexta, 12 · 18:00 – 23:30</p>
                <p className="gc__detalhe-onde"><Icone nome="local" tamanho={14} />Rua das Flores, 100</p>
                <dl>
                  <div><dt>Contratante</dt><dd>Buffet Alfa</dd></div>
                  <div><dt>Responsável</dt><dd>Pedro</dd></div>
                  <div><dt>Unidade</dt><dd>Optum</dd></div>
                  <div><dt>Veículos previstos</dt><dd>120</dd></div>
                  <div><dt>Equipe prevista</dt><dd>6</dd></div>
                  <div><dt>Situação</dt><dd>Confirmado</dd></div>
                </dl>
              </article>
            </div>
          </section>

          <section id="como-ligar" className="gc__bloco" aria-labelledby="gc-ligar">
            <div className="secao__cabeca">
              <h2 id="gc-ligar">Como ligar, passo a passo</h2>
              <p>O link é o mesmo para qualquer agenda. Escolha onde você quer ver os eventos.</p>
            </div>
            <div className="gc__apps">
              {APLICATIVOS.map((app) => (
                <article key={app.nome} className="gc__app">
                  <h3>{app.nome}</h3>
                  <p className="gc__app-onde">{app.onde}</p>
                  <ol>{app.passos.map((passo) => <li key={passo}>{passo}</li>)}</ol>
                </article>
              ))}
            </div>
          </section>

          <section className="gc__bloco" aria-labelledby="gc-quem">
            <div className="secao__cabeca">
              <h2 id="gc-quem">Quem pode usar</h2>
              <p>A agenda segue as mesmas permissões do sistema.</p>
            </div>
            <ul className="gc__perfis">
              {PERFIS.map((p) => (
                <li key={p.titulo} className={p.pode ? 'gc__perfil gc__perfil--sim' : 'gc__perfil'}>
                  <Icone nome={p.pode ? 'sucesso' : 'fechar'} tamanho={18} />
                  <div><strong>{p.titulo}</strong><span>{p.texto}</span></div>
                </li>
              ))}
            </ul>
          </section>

          <section className="gc__bloco" aria-labelledby="gc-seguranca">
            <div className="secao__cabeca">
              <h2 id="gc-seguranca">Seguro por padrão</h2>
            </div>
            <div className="recursos__grade recursos__grade--4">
              {SEGURANCA.map((s) => (
                <article key={s.titulo} className="recurso">
                  <span className="recurso__icone"><Icone nome={s.icone} tamanho={20} /></span>
                  <h3>{s.titulo}</h3>
                  <p>{s.texto}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="gc__bloco perguntas" aria-labelledby="gc-perguntas">
            <div className="secao__cabeca">
              <h2 id="gc-perguntas">Perguntas frequentes</h2>
            </div>
            <div className="perguntas__lista">
              {PERGUNTAS.map((q) => (
                <details key={q.p} className="pergunta">
                  <summary>{q.p}<Icone nome="abrir" tamanho={18} /></summary>
                  <p>{q.r}</p>
                </details>
              ))}
            </div>
          </section>

          <section className="planos__cliente">
            <div>
              <h2>Pronto para ver a operação na sua agenda?</h2>
              <p>Gerentes e proprietários geram o link em Meu perfil, em menos de um minuto.</p>
            </div>
            <Link className="pf-btn pf-btn--primary" to={destino}>{rotuloAcao}<Icone nome="seta" tamanho={16} /></Link>
          </section>
        </main>
        <footer className="rodape">
          <Logo tamanho={15} />
          <nav aria-label="Rodapé"><Link to="/conheca">Apresentação</Link><Link to="/planos">Planos</Link><Link to="/login">Entrar</Link></nav>
          <p>Google Calendar é marca do Google. O Park Flash publica um link de agenda no formato padrão (iCalendar).</p>
        </footer>
      </div>
    </pf-conheca>
  );
}
