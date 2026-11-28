import { useLayoutEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { gsap } from 'gsap';
import { Icone } from '../../compartilhado/Icone';
import { movimentoLivre } from '../../compartilhado/movimento';
import { useSeo } from '../../compartilhado/useSeo';
import { COMPARACAO, CONTATO_COMERCIAL, PLANOS } from './planos-dados';
import { RodapePublico } from './RodapePublico';
import { TopoPublico } from './TopoPublico';
import './conheca.scss';

function linkContato(plano: string): string | null {
  const texto = encodeURIComponent(`Olá! Quero saber mais sobre o plano ${plano} do Park Flash.`);
  if (CONTATO_COMERCIAL.whatsapp) return `https://wa.me/${CONTATO_COMERCIAL.whatsapp}?text=${texto}`;
  if (CONTATO_COMERCIAL.email) return `mailto:${CONTATO_COMERCIAL.email}?subject=${encodeURIComponent(`Plano ${plano} — Park Flash`)}&body=${texto}`;
  return null;
}

/** Planos do Park Flash. Conteúdo em `planos.ts` (preços e contato só quando aprovados). */
export default function Planos() {
  const raiz = useRef<HTMLDivElement>(null);
  useSeo({
    titulo: 'Planos — Park Flash',
    descricao: 'Conheça os planos Essencial, Operação e Rede do Park Flash e compare o que cada um inclui. Valores sob consulta.',
    caminho: '/planos',
  });

  useLayoutEffect(() => {
    const el = raiz.current;
    if (!el) return;
    const media = gsap.matchMedia();
    media.add(movimentoLivre, () => {
      gsap.timeline({ defaults: { ease: 'expo.out', duration: 0.8 } })
        .from(el.querySelectorAll('.planos__cabeca > *'), { opacity: 0, y: 18, stagger: 0.07 })
        .from(el.querySelectorAll('.plano'), { opacity: 0, y: 30, stagger: 0.09 }, 0.15)
        .from(el.querySelector('.comparacao'), { opacity: 0, y: 20 }, 0.4);
    });
    return () => media.revert();
  }, []);

  return (
    <pf-conheca>
      <div ref={raiz} className="lp">
        <TopoPublico />
        <main id="conteudo" tabIndex={-1} className="planos">
          <div className="planos__cabeca">
            <p className="sobre">Planos</p>
            <h1>Escolha o tamanho da sua operação</h1>
            <p>Todos os planos incluem uso no computador e no celular, atualizações do sistema e os dados da sua operação guardados com segurança.</p>
          </div>

          <div className="planos__grade">
            {PLANOS.map((plano) => {
              const contato = linkContato(plano.nome);
              return (
                <article key={plano.id} className={`plano${plano.destaque ? ' plano--destaque' : ''}`} aria-labelledby={`plano-${plano.id}`}>
                  {plano.destaque && <span className="plano__selo">Indicado para equipes</span>}
                  <h2 id={`plano-${plano.id}`}>{plano.nome}</h2>
                  <p className="plano__resumo">{plano.resumo}</p>
                  <p className="plano__preco" data-sem-preco={plano.preco ? undefined : ''}>
                    {plano.preco ? <>{plano.preco}<span>{plano.periodo}</span></> : 'Sob consulta'}
                  </p>
                  {/* Com contato comercial cadastrado (planos-dados.ts) a ação vira o contato; até lá, leva à explicação. */}
                  {contato ? (
                    <a className={`pf-btn ${plano.destaque ? 'pf-btn--primary' : 'pf-btn--ghost'} pf-btn--block`} href={contato} target="_blank" rel="noreferrer">
                      Quero este plano<Icone nome="seta" tamanho={16} />
                    </a>
                  ) : (
                    <>
                      <Link className={`pf-btn ${plano.destaque ? 'pf-btn--primary' : 'pf-btn--ghost'} pf-btn--block plano__acao`} to="/conheca#como-funciona">
                        Ver como funciona<Icone nome="seta" tamanho={16} />
                      </Link>
                      <p className="plano__aviso">Contato comercial em breve.</p>
                    </>
                  )}
                  <ul>
                    {plano.recursos.map((r) => <li key={r}><Icone nome="check" tamanho={15} />{r}</li>)}
                  </ul>
                </article>
              );
            })}
          </div>

          <section className="comparacao" aria-labelledby="comparar">
            <h2 id="comparar">Compare os planos</h2>
            <div className="comparacao__tabela" tabIndex={0} role="region" aria-labelledby="comparar">
              <table>
                <thead>
                  <tr><th scope="col">Recurso</th>{PLANOS.map((p) => <th key={p.id} scope="col">{p.nome}</th>)}</tr>
                </thead>
                <tbody>
                  {COMPARACAO.map((linha) => (
                    <tr key={linha.recurso}>
                      <th scope="row">{linha.recurso}</th>
                      {PLANOS.map((p) => {
                        const v = linha.planos[p.id];
                        return (
                          <td key={p.id}>
                            {typeof v === 'string' ? v : v
                              ? <span className="sim"><Icone nome="check" tamanho={16} /><span className="pf-sr-only">Incluído</span></span>
                              : <span className="nao"><span aria-hidden="true">—</span><span className="pf-sr-only">Não incluído</span></span>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="planos__cliente">
            <div>
              <h2>Já usa o Park Flash?</h2>
              <p>Entre com o acesso fornecido pelo proprietário da sua operação.</p>
            </div>
            <Link className="pf-btn pf-btn--primary" to="/login">Entrar<Icone nome="seta" tamanho={16} /></Link>
          </section>
        </main>
        <RodapePublico atual="/planos" nota="Planos e condições sujeitos a proposta comercial." />
      </div>
    </pf-conheca>
  );
}
