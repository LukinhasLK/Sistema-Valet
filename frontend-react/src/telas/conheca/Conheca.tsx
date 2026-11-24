import { useLayoutEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Icone } from '../../compartilhado/Icone';
import { Logo } from '../../compartilhado/Logo';
import { movimentoLivre } from '../../compartilhado/movimento';
import { useAuth } from '../../nucleo/estado/auth';
import { rotaInicial } from '../../nucleo/servicos/permissoes';
import './conheca.scss';

gsap.registerPlugin(ScrollTrigger);

/**
 * Apresentação comercial do Park Flash.
 * Só descreve o que o sistema já faz — sem clientes, depoimentos, números ou preços.
 * As imagens são capturas reais da interface com dados de demonstração.
 */
const ETAPAS = [
  { icone: 'fichas', titulo: 'Lance o turno', texto: 'O operador registra a numeração inicial e final dos tickets, os cancelados, os recebimentos em dinheiro, cartão e Pix, a equipe e as despesas do dia.' },
  { icone: 'enviar', titulo: 'Envie para conferência', texto: 'A ficha vai para a gestão com o saldo já calculado. Se algo não bate, a gestão devolve com o motivo ou sinaliza uma divergência.' },
  { icone: 'sucesso', titulo: 'Feche o caixa', texto: 'Ao confirmar o fechamento, a ficha fica bloqueada para alterações e todo o histórico de quem fez o quê permanece registrado.' },
  { icone: 'pagamentos', titulo: 'Pague a equipe', texto: 'As diárias reconhecidas aparecem com a chave Pix do manobrista. Você paga pelo seu banco e confirma no sistema.' },
];

const RECURSOS = [
  { icone: 'carros', titulo: 'Controle de veículos', texto: 'Carros por turno a partir da numeração dos tickets, com cancelamentos e totais por mês e por unidade.' },
  { icone: 'relatorios', titulo: 'Relatórios em PDF e Excel', texto: 'Receita, custos das fichas, despesas fixas e resultado do período, prontos para baixar.' },
  { icone: 'lucro', titulo: 'Divisão de lucro', texto: 'O resultado de cada unidade dividido entre os sócios conforme a participação configurada.' },
  { icone: 'seguro', titulo: 'Permissões por perfil', texto: 'Proprietário, gerente e operador veem apenas o que precisam. As regras valem também no servidor.' },
  { icone: 'sinoAtivo', titulo: 'Notificações', texto: 'Central de avisos sobre fichas e pagamentos, com notificação no aparelho quando ativada.' },
  { icone: 'eventos', titulo: 'Eventos e escalas', texto: 'Planeje a operação de eventos e organize os turnos da equipe por unidade.' },
];

export default function Conheca() {
  const raiz = useRef<HTMLDivElement>(null);
  const logado = useAuth((s) => s.usuario?.nivel ?? null);
  const destino = logado ? rotaInicial(logado) : '/login';
  const rotuloEntrar = logado ? 'Abrir o sistema' : 'Entrar';

  useLayoutEffect(() => {
    const el = raiz.current;
    if (!el) return;
    const media = gsap.matchMedia();
    media.add(movimentoLivre, () => {
      // Abertura: título, texto, botões e as telas do produto.
      gsap.timeline({ defaults: { ease: 'expo.out', duration: 0.9 } })
        .from(el.querySelectorAll('.heroi [data-anima]'), { opacity: 0, y: 22, stagger: 0.08 })
        .from(el.querySelector('.heroi__janela'), { opacity: 0, y: 40, rotateX: 8, transformPerspective: 1200, duration: 1.1 }, 0.15)
        .from(el.querySelector('.heroi__celular'), { opacity: 0, y: 60, x: 20, duration: 1.1 }, 0.35);

      // Parallax suave das telas enquanto a página rola.
      gsap.to(el.querySelector('.heroi__celular'), { y: -60, ease: 'none', scrollTrigger: { trigger: '.heroi', start: 'top top', end: 'bottom top', scrub: 0.6 } });

      // Seções entram ao chegar na tela.
      el.querySelectorAll<HTMLElement>('[data-revelar]').forEach((secao) => {
        gsap.from(secao.querySelectorAll('[data-item]'), {
          opacity: 0, y: 26, stagger: 0.08, duration: 0.8, ease: 'expo.out',
          scrollTrigger: { trigger: secao, start: 'top 78%' },
        });
      });

      // Linha do fluxo "do turno ao fechamento" se desenha com a rolagem.
      gsap.fromTo(el.querySelector('.fluxo__linha-progresso'), { scaleY: 0 }, {
        scaleY: 1, ease: 'none', scrollTrigger: { trigger: '.fluxo__lista', start: 'top 70%', end: 'bottom 60%', scrub: 0.5 },
      });
    });
    return () => media.revert();
  }, []);

  return (
    <pf-conheca>
      <div ref={raiz} className="lp">
        <header className="topo">
          <Link to="/conheca" aria-label="Park Flash"><Logo tamanho={19} /></Link>
          <nav className="topo__nav" aria-label="Seções">
            <a href="#como-funciona">Como funciona</a>
            <a href="#recursos">Recursos</a>
            <a href="#celular">No celular</a>
          </nav>
          <Link className="pf-btn pf-btn--primary pf-btn--sm" to={destino}>{rotuloEntrar}</Link>
        </header>

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
                <a className="pf-btn pf-btn--ghost" href="#como-funciona">Ver como funciona</a>
              </div>
            </div>
            <div className="heroi__visual" aria-hidden="true">
              <figure className="heroi__janela">
                <div className="janela__barra"><span /><span /><span /></div>
                <img src="/conheca/fichas.webp" width={1280} height={800} alt="" />
              </figure>
              <figure className="heroi__celular">
                <img src="/conheca/celular-ficha.webp" width={390} height={800} alt="" />
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

          <section className="secao vitrine" data-revelar>
            <div className="secao__cabeca" data-item>
              <p className="sobre">Conferência</p>
              <h2>Tudo da ficha em um painel</h2>
              <p>Tickets, recebimentos, custos da equipe e saldo final lado a lado com a lista — e o histórico de cada alteração.</p>
            </div>
            <figure className="vitrine__imagem" data-item>
              <img src="/conheca/ficha-detalhe.webp" width={1280} height={800} loading="lazy"
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
            <div className="celular__texto" data-item>
              <p className="sobre">No celular</p>
              <h2>Feito para quem está no pátio</h2>
              <ul>
                <li><Icone nome="check" tamanho={16} />Botões grandes e navegação pelo polegar</li>
                <li><Icone nome="check" tamanho={16} />Instalável na tela inicial como aplicativo</li>
                <li><Icone nome="check" tamanho={16} />Busca rápida de telas e fichas pela data</li>
              </ul>
            </div>
            <figure className="celular__imagem" data-item>
              <img src="/conheca/celular-ficha.webp" width={390} height={800} loading="lazy"
                alt="Detalhe de uma ficha no celular, com tickets, caixa e o botão de enviar para conferência." />
            </figure>
          </section>

          <section className="secao chamada" data-revelar>
            <div className="chamada__caixa" data-item>
              <h2>Pronto para organizar o próximo turno?</h2>
              <p>Entre com o acesso fornecido pelo proprietário da sua operação.</p>
              <Link className="pf-btn pf-btn--primary" to={destino}>{rotuloEntrar}<Icone nome="seta" tamanho={16} /></Link>
            </div>
          </section>
        </main>

        <footer className="rodape">
          <Logo tamanho={15} />
          <p>As imagens mostram a interface real do sistema com dados de demonstração.</p>
        </footer>
      </div>
    </pf-conheca>
  );
}
