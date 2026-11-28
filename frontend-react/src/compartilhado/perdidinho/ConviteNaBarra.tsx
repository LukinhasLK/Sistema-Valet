import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { CURVA, TRANSICAO } from '../movimento';
import { useNivel, useUsuario } from '../../nucleo/estado/auth';
import { onboardingServico, progressoDe, useOnboarding } from '../../nucleo/onboarding/estado';
import './balao-companheiro.scss';

/** O convite recolhe para o Perdidinho depois de tanto tempo sem interação (passar o mouse ou foco dentro pausa a contagem). */
export const RECOLHER_CONVITE_MS = 12_000;

/** Texto do convite (o mesmo que o AjudantePerdidinho anuncia na região viva única). */
export function textoDoConvite(primeiroNome: string, pausado: boolean): string {
  return pausado ? 'Continuar o tour? Você parou no meio do passo a passo.' : `Olá, ${primeiroNome}! Primeira vez por aqui? Um tour de 1 minuto mostra o essencial.`;
}

interface Props {
  /** Atraso da entrada (o aceno do mascote começa junto). */
  atrasoMs: number;
  reduzirMovimento: boolean;
}

/**
 * Convite de primeiro acesso no desktop: uma fala na barra superior, à esquerda do Perdidinho, com "Fazer o tour",
 * "Lembrar depois" e "Não mostrar mais". Não toma o foco, não é anunciado aqui (a região viva é a do Perdidinho)
 * e recolhe para o Perdidinho sozinho em 12 s, pausando com mouse ou foco dentro.
 * Em telas estreitas (barra apertada) os rótulos longos viram curtos; o nome acessível é sempre o completo.
 */
export function ConviteNaBarra({ atrasoMs, reduzirMovimento }: Props) {
  const usuario = useUsuario();
  const nivel = useNivel();
  const progresso = useOnboarding((s) => progressoDe(s.progresso, usuario?.id));
  const pausado = progresso.status === 'pausado' || progresso.status === 'em_andamento';
  const raiz = useRef<HTMLElement>(null);
  const [pausa, setPausa] = useState(false);
  const primeiroNome = usuario?.nome.split(' ')[0] ?? '';

  useEffect(() => {
    if (pausa) return;
    const t = setTimeout(() => onboardingServico.recolherConvite(true), RECOLHER_CONVITE_MS + atrasoMs);
    return () => clearTimeout(t);
  }, [pausa, atrasoMs]);

  const sair = reduzirMovimento ? { opacity: 0, transition: { duration: 0.12 } } : { opacity: 0, x: 4, transition: TRANSICAO.saida };
  return (
    <motion.div className="convite-barra"
      initial={{ opacity: 0, x: reduzirMovimento ? 0 : 8 }} animate={{ opacity: 1, x: 0 }} exit={sair}
      transition={{ duration: reduzirMovimento ? 0.12 : 0.19, ease: reduzirMovimento ? 'linear' : CURVA.saida, delay: atrasoMs / 1000 }}>
      <div>
        <pf-balao-companheiro ref={raiz} data-variante="barra" data-pronto="" data-convite=""
          onMouseEnter={() => setPausa(true)} onMouseLeave={() => setPausa(raiz.current?.contains(document.activeElement) ?? false)}
          onFocus={() => setPausa(true)} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setPausa(false); }}>
          <div className="balc__dobra">
            <div className="balc__cartao" role="group" aria-label="Convite para o tour">
              <div className="balc__texto">
                <span className="balc__longo">{textoDoConvite(primeiroNome, pausado)}</span>
                <span className="balc__curto">{pausado ? 'Continuar o tour?' : 'Primeira vez por aqui?'}</span>
              </div>
              <button type="button" className="balc__acao balc__acao--forte"
                onClick={() => (pausado ? onboardingServico.retomar(usuario?.id, nivel) : onboardingServico.iniciar(usuario?.id, nivel))}>
                {pausado ? 'Continuar' : 'Fazer o tour'}
              </button>
              <button type="button" className="balc__acao" aria-label="Lembrar depois" onClick={onboardingServico.adiarConvite}>
                <span className="balc__longo">Lembrar depois</span><span className="balc__curto" aria-hidden="true">Depois</span>
              </button>
              <button type="button" className="balc__acao" aria-label="Não mostrar mais" onClick={() => onboardingServico.pular(usuario?.id)}>
                <span className="balc__longo">Não mostrar mais</span><span className="balc__curto" aria-hidden="true">Não mostrar</span>
              </button>
            </div>
          </div>
        </pf-balao-companheiro>
      </div>
    </motion.div>
  );
}
