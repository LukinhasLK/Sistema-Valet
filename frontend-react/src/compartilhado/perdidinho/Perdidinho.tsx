import { useEffect, useId, useLayoutEffect, useRef } from 'react';
import { gsap } from 'gsap';
import type { HumorMascote, PropsMascote } from '../../nucleo/onboarding/mascote';
import { reduzido } from '../movimento';
import './perdidinho.scss';

export type Direcao = { x: number; y: number };
export type Pose = { x: number; y: number; rotation: number; scaleX: number; scaleY: number };
/** Desenho dos olhos de cada humor. */
export type Olhos = 'abertos' | 'alegres' | 'piscadela' | 'mirando' | 'redondos' | 'tristes' | 'arregalados' | 'fechados';

/** Olhos que podem ser pedidos por fora: os do humor ou `espiando` (um fechado, outro aberto). */
export type OlhosPerdidinho = Olhos | 'espiando';

export interface PropsPerdidinho extends PropsMascote {
  /** Uso só ilustrativo (ex.: apresentação, ao lado de um balão): some para o leitor de tela. */
  decorativo?: boolean;
  tamanho?: number;
  /** Olhar fixo (−1..1 em x e y). Substitui o olhar do humor e desliga o olhar seguindo o cursor. */
  olhar?: Direcao;
  /** Substitui os olhos do humor (a troca usa a piscada de transição). */
  olhos?: OlhosPerdidinho;
  /** false desliga só os loops periódicos dos gestos (aceninho, quique...). Respiração e piscar continuam. */
  ciclos?: boolean;
  /** Vira o corpo de leve (−6° e −2 px), como quem dá as costas. 200 ms; instantâneo com reduzir movimento. */
  virado?: boolean;
}

/*
 * Linguagem de movimento do Perdidinho (GSAP, só transform/opacity):
 * - "saida" power3.out para o que chega/sobe; "entrada" power2.in para o que cai/sai;
 *   "mola" back.out para assentar; "amortecer" elastic.out curto só no pouso (sem quicar demais).
 * - Gestos de UI entre 60 e 300 ms por trecho; ciclos de repouso lentos (1,7 a 2,6 s por meia volta).
 */
const EASE = { saida: 'power3.out', entrada: 'power2.in', mola: 'back.out(2)', amortecer: 'elastic.out(1, 0.6)', suave: 'sine.inOut' } as const;
const NEUTRA: Pose = { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 };
/** Remontagem dentro desta janela (ms) continua de onde o Perdidinho anterior parou, sem nova entrada. */
const JANELA_CONTINUIDADE = 450;

// Última pose de quem desmontou: o tour troca o cartão a cada passo e o mascote é recriado.
let ultimaSaida: { t: number; pose: Pose } | null = null;
// Última postura (transform CSS) de quem desmontou: o próximo transita a partir dela.
let ultimaPostura: { t: number; transform: string } | null = null;

/**
 * Para onde fica o item destacado, visto do cartão. `lado` diz onde o cartão está em relação
 * ao item; o Perdidinho aponta para o lado oposto (cartão embaixo = item em cima).
 */
export function direcaoDoAlvo(lado: PropsMascote['lado']): Direcao {
  switch (lado) {
    case 'bottom': return { x: 0, y: -1 };
    case 'top': return { x: 0, y: 1 };
    case 'right': return { x: -1, y: 0 };
    case 'left': return { x: 1, y: 0 };
    default: return { x: 0, y: 0 };
  }
}

export function olhosDoHumor(humor: HumorMascote): Olhos {
  switch (humor) {
    case 'feliz':
    case 'comemorando': return 'alegres';
    case 'acenando': return 'piscadela';
    case 'triste':
    case 'chorando': return 'tristes';
    case 'surpreso': return 'arregalados';
    case 'pensando': return 'redondos';
    case 'apontando': return 'mirando';
    case 'dormindo': return 'fechados';
    default: return 'abertos';
  }
}

/**
 * Sobrancelhas: elas é que separam os humores de olhos parecidos no tamanho pequeno (28–42 px).
 * - `tristes`: baixas, encostadas na pálpebra, pontas de fora caídas (erro, sem conexão);
 * - `preocupadas`: altas e bem inclinadas, pontas de dentro para cima (prejuízo, "hmm, isso não está bom");
 * - `levantadas`: arcos altos e afastados (susto, urgente);
 * - `calmas`: arcos suaves e simétricos, altura normal (explicando: atento, sem alarme);
 * - `alerta`: UMA só, bem levantada, do lado para onde ele olha (apontando: "olha ali!").
 * Sem sobrancelha: feliz/comemorando (o ^^ basta), acenando (piscadela) e dormindo.
 */
export type Sobrancelhas = 'tristes' | 'preocupadas' | 'levantadas' | 'calmas' | 'alerta';
export function sobrancelhasDoHumor(humor: HumorMascote): Sobrancelhas | null {
  switch (humor) {
    case 'triste':
    case 'chorando': return 'tristes';
    case 'pensando': return 'preocupadas';
    case 'surpreso': return 'levantadas';
    case 'explicando': return 'calmas';
    case 'apontando': return 'alerta';
    default: return null;
  }
}

/** Para onde o "apontando" aponta: o item destacado ou, sem lado (companheiro do canto), para cima e à esquerda. */
export function direcaoApontada(lado: PropsMascote['lado']): Direcao {
  return lado === 'centro' ? { x: -0.7, y: -0.6 } : direcaoDoAlvo(lado);
}

/**
 * Postura de repouso de cada humor (camada própria, CSS): é ela que fica, inclusive com "reduzir
 * movimento", e transita em 300 ms na troca de humor. Os gestos do GSAP partem dela e voltam a ela.
 */
export function posturaDoHumor(humor: HumorMascote, lado: PropsMascote['lado']): Pose {
  switch (humor) {
    case 'apontando': {
      // Inclina o corpo para o alvo (e estica de leve quando ele está acima).
      const d = direcaoApontada(lado);
      return { x: d.x * 2, y: d.y * 0.8, rotation: d.x * 11, scaleX: d.y < 0 ? 0.985 : 1, scaleY: d.y < 0 ? 1.02 : 1 };
    }
    case 'explicando': return { ...NEUTRA, rotation: 3 };           // cabeça de lado, de conversa
    case 'acenando': return { ...NEUTRA, rotation: -4 };            // o charme do "oi"
    case 'pensando': return { ...NEUTRA, y: 0.6, scaleX: 1.02, scaleY: 0.97 }; // encolhido, tenso
    case 'surpreso': return { ...NEUTRA, y: -1, scaleX: 0.97, scaleY: 1.04 };  // espichado, em alerta
    case 'triste':
    case 'chorando': return { x: 0, y: 1.5, rotation: -2, scaleX: 1.03, scaleY: 0.94 }; // murcho
    case 'dormindo': return { ...NEUTRA, y: 0.5, rotation: -6 };    // cabeça pendendo
    default: return NEUTRA;
  }
}

const transformPostura = (p: Pose) => ehNeutra(p) ? 'none'
  : `translate(${p.x.toFixed(2)}px, ${p.y.toFixed(2)}px) rotate(${p.rotation.toFixed(2)}deg) scale(${p.scaleX}, ${p.scaleY})`;

/**
 * Transform fixo do rosto (olhos e sobrancelhas), independente do olhar: vale mesmo com `olhar` fixo
 * por fora (o companheiro fixa o olhar). No "apontando" o rosto vai para o alvo e, se o alvo está à
 * direita, espelha (a sobrancelha levantada e o olho aberto ficam do lado do alvo).
 */
export function rostoDoHumor(humor: HumorMascote, lado: PropsMascote['lado']): string | undefined {
  if (humor === 'apontando') {
    const d = direcaoApontada(lado);
    const mover = `translate(${(d.x * 3.8).toFixed(2)} ${(d.y * 3.4).toFixed(2)})`;
    return d.x > 0 ? `${mover} translate(56 0) scale(-1 1)` : mover;
  }
  if (humor === 'triste' || humor === 'chorando') return 'translate(0 1.6)'; // olhos baixos
  return undefined;
}

/** Olhos que piscam (os outros já estão fechados ou em arco). */
const PISCAM: ReadonlySet<OlhosPerdidinho> = new Set(['abertos', 'mirando', 'redondos', 'tristes', 'arregalados']);

/** Olhar fixo de cada humor (null = livre: segue o mouse em ponteiro fino). */
function olharDoHumor(humor: HumorMascote, lado: PropsMascote['lado']): Direcao | null {
  if (humor === 'pensando') return { x: -0.5, y: -1 };
  if (humor === 'apontando') return direcaoApontada(lado);
  if (humor === 'triste' || humor === 'chorando') return { x: 0, y: 0.8 };
  if (humor === 'dormindo') return { x: 0, y: 0 };
  return null;
}

const transformOlhar = (d: Direcao) => `translate(${(Math.max(-1, Math.min(1, d.x)) * 3.2).toFixed(2)}px, ${(Math.max(-1, Math.min(1, d.y)) * 2.6).toFixed(2)}px)`;

const ehNeutra = (p: Pose) => Math.abs(p.x) + Math.abs(p.y) + Math.abs(p.rotation) + Math.abs(p.scaleX - 1) + Math.abs(p.scaleY - 1) < 0.05;

function poseAtual(el: Element): Pose {
  const ler = (prop: keyof Pose) => Number(gsap.getProperty(el, prop)) || 0;
  return { x: ler('x'), y: ler('y'), rotation: ler('rotation'), scaleX: ler('scaleX') || 1, scaleY: ler('scaleY') || 1 };
}

/** Gota com a ponta em (x, y): 4,8 de largura por 7 de altura (legível a partir de 40 px). */
const gota = (x: number, y: number) =>
  `M${x} ${y} C${x + 1.6} ${y + 2.4} ${x + 2.4} ${y + 3.6} ${x + 2.4} ${y + 4.6} A2.4 2.4 0 0 1 ${x - 2.4} ${y + 4.6} C${x - 2.4} ${y + 3.6} ${x - 1.6} ${y + 2.4} ${x} ${y} Z`;

// Espessura: a mesma forma repetida em diagonal, atrás da face.
const PROFUNDIDADE = [4, 3.5, 3, 2.5, 2, 1.5, 1, 0.5];

/**
 * Perdidinho, o guia do Park Flash: cubinho 2,5D (face azul da marca, laterais azul-marinho,
 * olhos claros e um raio âmbar do logo). Implementa `PropsMascote` do tour guiado.
 *
 * Camadas do SVG (cada uma com um dono de movimento, para nada brigar):
 * - `entrada`: aparece uma vez ao montar (opacidade + escala a partir da base);
 * - `respira`: ciclo de repouso (escala vertical mínima, ancorada na base);
 * - `gesto`: o gesto do humor (antecipação, pulo, pouso), sempre começando da pose anterior;
 * - `olhar` (CSS transition) e `olhos` (piscar com GSAP).
 *
 * Tudo vive em `gsap.context` revertido ao trocar de passo ou desmontar. Ciclos infinitos param
 * quando o mascote sai da tela. Com "reduzir movimento" (prop ou sistema) nada se move: só a expressão muda.
 */
/** Sem boca: a expressão é só dos olhos. `falando` faz parte do contrato do tour e é ignorado aqui. */
export function Perdidinho({
  humor, passo, lado, reduzirMovimento, decorativo = false, tamanho = 64,
  olhar: olharPedido, olhos: olhosPedidos, ciclos: comCiclos = true, virado = false,
}: PropsPerdidinho) {
  const id = useId().replace(/:/g, '');
  const svg = useRef<SVGSVGElement>(null);
  const entrada = useRef<SVGGElement>(null);
  const respira = useRef<SVGGElement>(null);
  const vira = useRef<SVGGElement>(null);
  const postura = useRef<SVGGElement>(null);
  const suor = useRef<SVGPathElement>(null);
  const gesto = useRef<SVGGElement>(null);
  const sombra = useRef<SVGEllipseElement>(null);
  const olhar = useRef<SVGGElement>(null);
  const olhos = useRef<SVGGElement>(null);
  const sobrancelhas = useRef<SVGGElement>(null);
  const lagrimas = useRef<SVGGElement>(null);
  const zzz = useRef<SVGGElement>(null);

  // Estado de movimento entre execuções (não afeta o desenho, por isso não é state).
  const entrou = useRef(false);
  const poseHerdada = useRef<Pose | null>(null);
  const humorAnterior = useRef<HumorMascote | null>(null);
  const olhosAnteriores = useRef<OlhosPerdidinho | null>(null);
  const viradoAntes = useRef<boolean | null>(null);
  const visivel = useRef(true);
  const ciclos = useRef(new Set<gsap.core.Animation>());

  const parado = reduzirMovimento || reduzido();
  const tipoOlhos: OlhosPerdidinho = olhosPedidos ?? olhosDoHumor(humor);
  const tipoSobrancelhas = sobrancelhasDoHumor(humor);
  const olharFixo = olharPedido ?? olharDoHumor(humor, lado);
  const olharX = olharFixo?.x ?? 0;
  const olharY = olharFixo?.y ?? 0;
  const posturaCss = transformPostura(posturaDoHumor(humor, lado));
  const rosto = rostoDoHumor(humor, lado);

  /** Registra um ciclo infinito: ele pausa fora da tela e volta ao reaparecer. */
  const ciclo = <T extends gsap.core.Animation>(anim: T): T => {
    ciclos.current.add(anim);
    if (!visivel.current) anim.pause();
    return anim;
  };

  // Gesto de cada humor. Reexecuta a cada passo; começa da pose em que o anterior parou.
  useLayoutEffect(() => {
    const corpo = gesto.current;
    const chao = sombra.current;
    if (parado || !corpo || !chao) return;
    const registrados = ciclos.current;
    const agora = performance.now();
    const recente = ultimaSaida && agora - ultimaSaida.t < JANELA_CONTINUIDADE ? ultimaSaida.pose : null;
    const herdada = poseHerdada.current ?? (!entrou.current ? recente : null);
    poseHerdada.current = null;
    const meus: gsap.core.Animation[] = [];

    const ctx = gsap.context(() => {
      gsap.set(corpo, { transformOrigin: '50% 100%' });
      gsap.set(chao, { transformOrigin: '50% 50%' });

      // Entrada: só na primeira vez (e não quando é a continuação de um passo do tour).
      if (!entrou.current && !recente && entrada.current) {
        gsap.from(entrada.current, {
          opacity: 0, scale: 0.9, y: 3, transformOrigin: '50% 100%', duration: 0.28, ease: 'back.out(1.6)',
          onComplete: () => { entrou.current = true; },
        });
      } else {
        entrou.current = true;
      }

      // Continuidade: volta da pose anterior para a neutra antes do novo gesto (sem "salto").
      const t0 = herdada && !ehNeutra(herdada) ? 0.2 : 0.12;
      if (herdada && !ehNeutra(herdada)) gsap.fromTo(corpo, { ...herdada }, { ...NEUTRA, duration: 0.2, ease: 'power2.out' });

      const loop = (vars: gsap.TimelineVars) => {
        const tl = ciclo(gsap.timeline({ repeat: -1, ...vars }));
        meus.push(tl);
        return tl;
      };
      // Loops periódicos do gesto: com `ciclos={false}` viram uma linha do tempo pausada (nunca toca).
      const repete = (vars: gsap.TimelineVars) => (comCiclos ? loop(vars) : gsap.timeline({ paused: true }));

      // Sombra acompanha a altura: encolhe e clareia no ar.
      const sombraNoAr = (fator: number, duracao: number) => gsap.to(chao, { scaleX: 1 - 0.3 * fator, opacity: 0.22 - 0.1 * fator, duration: duracao, ease: EASE.saida });
      const sombraNoChao = (duracao: number) => gsap.to(chao, { scaleX: 1, opacity: 0.22, duration: duracao, ease: EASE.entrada });

      /** Pulo com antecipação (agacha), esticada na subida, queda e pouso amortecido. */
      const pulo = (altura: number, giro = 0) => gsap.timeline()
        .to(corpo, { scaleX: 1.1, scaleY: 0.86, duration: 0.1, ease: EASE.entrada })
        .to(corpo, { y: -altura, rotation: giro, scaleX: 0.94, scaleY: 1.08, duration: 0.18, ease: EASE.saida })
        .add(sombraNoAr(altura / 11, 0.18), '<')
        .to(corpo, { scaleX: 1, scaleY: 1, duration: 0.06, ease: 'sine.out' })
        .to(corpo, { y: 0, rotation: 0, scaleX: 0.97, scaleY: 1.04, duration: 0.16, ease: EASE.entrada })
        .add(sombraNoChao(0.16), '<')
        .to(corpo, { scaleX: 1.12, scaleY: 0.86, duration: 0.06, ease: 'power1.out' })
        .to(corpo, { scaleX: 1, scaleY: 1, duration: 0.34, ease: EASE.amortecer });

      if (humor === 'acenando') {
        // "Oi!": recolhe para trás, sobe inclinado, balança três vezes cada vez menos e pousa.
        // No fim inclina a cabeça e segura um instante (o charme do aceno).
        const tl = gsap.timeline({ delay: t0 })
          .to(corpo, { rotation: 5, scaleX: 1.05, scaleY: 0.94, duration: 0.12, ease: EASE.entrada })
          .to(corpo, { rotation: -13, y: -6, scaleX: 0.96, scaleY: 1.05, duration: 0.16, ease: EASE.saida })
          .add(sombraNoAr(0.5, 0.16), '<')
          .to(corpo, { rotation: 11, scaleX: 1, scaleY: 1, duration: 0.18, ease: EASE.suave })
          .to(corpo, { rotation: -8, duration: 0.16, ease: EASE.suave })
          .to(corpo, { rotation: 4, duration: 0.14, ease: EASE.suave })
          .to(corpo, { rotation: 0, y: 0, duration: 0.16, ease: EASE.entrada })
          .add(sombraNoChao(0.16), '<')
          .to(corpo, { scaleX: 1.07, scaleY: 0.93, duration: 0.06, ease: 'power1.out' })
          .to(corpo, { scaleX: 1, scaleY: 1, duration: 0.3, ease: EASE.amortecer })
          .to(corpo, { rotation: -3, duration: 0.3, ease: EASE.saida }, '+=0.1')
          .to(corpo, { rotation: 0, duration: 0.5, ease: EASE.suave }, '+=0.6');
        const fimIntro = t0 + tl.duration();
        // De vez em quando, um aceninho curto (lembra que ele está ali, sem chamar demais).
        repete({ delay: fimIntro + 3.5, repeatDelay: 4.5 })
          .to(corpo, { rotation: -7, duration: 0.16, ease: EASE.saida })
          .to(corpo, { rotation: 6, duration: 0.16, ease: EASE.suave })
          .to(corpo, { rotation: 0, duration: 0.3, ease: EASE.mola });
      }

      if (humor === 'explicando') {
        // Balanço calmo de quem conversa.
        repete({ delay: t0, defaults: { ease: EASE.suave } })
          .to(corpo, { y: -2.5, rotation: -1.5, duration: 1.1 })
          .to(corpo, { y: -1.5, rotation: 1.5, duration: 1.4 })
          .to(corpo, { y: 0, rotation: 0, duration: 1.1 });
      }

      if (humor === 'apontando') {
        // Recolhe para o lado oposto (antecipação), lança-se para o item e assenta na metade.
        // Na vertical, estica ao apontar para cima e amassa ao apontar para baixo.
        // A inclinação que fica é da postura (CSS); o gesto é só o "lance" por cima dela e volta ao zero.
        const d = direcaoApontada(lado);
        const esticar = d.y < 0 ? { scaleX: 0.96, scaleY: 1.06 } : d.y > 0 ? { scaleX: 1.05, scaleY: 0.95 } : { scaleX: 0.97, scaleY: 1.02 };
        const tl = gsap.timeline({ delay: t0 })
          .to(corpo, { rotation: -d.x * 4, x: -d.x * 1.5, y: -d.y * 1.5, scaleX: 1.03, scaleY: 0.96, duration: 0.12, ease: EASE.entrada })
          .to(corpo, { rotation: d.x * 6, x: d.x * 2.5, y: d.y * 2.5, ...esticar, duration: 0.2, ease: EASE.saida })
          .to(corpo, { ...NEUTRA, duration: 0.45, ease: EASE.mola });
        const fimIntro = t0 + tl.duration();
        // "Cutuca" de novo de tempos em tempos.
        repete({ delay: fimIntro + 1.6, repeatDelay: 2.2 })
          .to(corpo, { rotation: d.x * 5, x: d.x * 2, y: d.y * 2, duration: 0.18, ease: EASE.saida })
          .to(corpo, { ...NEUTRA, duration: 0.4, ease: EASE.mola });
      }

      if (humor === 'comemorando') {
        // Dois pulinhos (o segundo menor, girando para o outro lado) e, de vez em quando, mais um.
        const tl = gsap.timeline({ delay: t0 }).add(pulo(11, -6)).add(pulo(7, 6), '+=0.06');
        const fimIntro = t0 + tl.duration();
        repete({ delay: fimIntro + 3, repeatDelay: 4 }).add(pulo(5));
      }

      if (humor === 'feliz') {
        // Quique de alegria: dois saltinhos curtos (o segundo menor), inclinando de um lado e do
        // outro, e de novo de tempos em tempos. Bem menor que o pulo do "comemorando".
        const quique = (altura: number, giro: number) => gsap.timeline()
          .to(corpo, { scaleX: 1.04, scaleY: 0.96, duration: 0.06, ease: EASE.entrada })
          .to(corpo, { y: -altura, rotation: giro, scaleX: 0.96, scaleY: 1.04, duration: 0.14, ease: EASE.saida })
          .add(sombraNoAr(altura / 11, 0.14), '<')
          .to(corpo, { y: 0, rotation: 0, scaleX: 1, scaleY: 1, duration: 0.14, ease: EASE.entrada })
          .add(sombraNoChao(0.14), '<')
          .to(corpo, { scaleX: 1.05, scaleY: 0.95, duration: 0.05, ease: 'power1.out' })
          .to(corpo, { scaleX: 1, scaleY: 1, duration: 0.24, ease: EASE.mola });
        const duplo = () => gsap.timeline().add(quique(3.5, -2)).add(quique(2.5, 2), '-=0.16');
        const tl = gsap.timeline({ delay: t0 }).add(duplo());
        repete({ delay: t0 + tl.duration() + 2.2, repeatDelay: 2.6 }).add(duplo());
      }

      if (humor === 'pensando') {
        // Preocupado: a postura encolhida é do CSS; aqui só um balanço lento de inquietação.
        repete({ delay: t0 + 0.3, yoyo: true }).to(corpo, { rotation: -2, duration: 1.6, ease: EASE.suave });
      }

      if (humor === 'triste' || humor === 'chorando') {
        // Murchar é da postura (CSS, 300 ms); aqui só o suspiro/soluço por cima dela.
        const fimIntro = t0 + 0.43;
        if (humor === 'triste') {
          // Suspira de tempos em tempos.
          repete({ delay: fimIntro + 1.4, repeatDelay: 3.2 })
            .to(corpo, { y: 0.7, scaleX: 1.015, scaleY: 0.97, duration: 0.7, ease: EASE.suave })
            .to(corpo, { ...NEUTRA, duration: 1.1, ease: EASE.suave });
        } else {
          // Soluço: dois trancos curtos para cima e volta a murchar.
          repete({ delay: fimIntro + 0.6, repeatDelay: 1.8 })
            .to(corpo, { y: -1.2, scaleX: 0.985, scaleY: 1.03, duration: 0.08, ease: EASE.saida })
            .to(corpo, { ...NEUTRA, duration: 0.16, ease: EASE.entrada })
            .to(corpo, { y: -0.9, scaleX: 0.99, scaleY: 1.02, duration: 0.07, ease: EASE.saida }, '+=0.05')
            .to(corpo, { ...NEUTRA, duration: 0.22, ease: 'power2.inOut' });
          // Lágrimas: brotam no canto de baixo de cada olho, escorrem e somem, alternando os olhos.
          const gotas = lagrimas.current ? [...lagrimas.current.children] : [];
          gotas.forEach((gota, i) => {
            loop({ delay: 0.3 + i * 0.75, repeatDelay: 0.5 })
              .fromTo(gota, { opacity: 0, y: 0, scale: 0.5, transformOrigin: '50% 0%' }, { opacity: 1, scale: 1, duration: 0.22, ease: 'power2.out' })
              .to(gota, { y: 10, duration: 0.95, ease: EASE.entrada })
              .to(gota, { opacity: 0, duration: 0.22, ease: 'power1.in' }, '-=0.22');
          });
        }
      }

      if (humor === 'surpreso') {
        // Susto: pulinho curto e seco, levemente para trás (os olhos crescem no efeito do olhar).
        gsap.timeline({ delay: t0 - 0.06 })
          .to(corpo, { scaleX: 1.04, scaleY: 0.95, duration: 0.06, ease: EASE.entrada })
          .to(corpo, { y: -6, rotation: 2, scaleX: 0.95, scaleY: 1.08, duration: 0.12, ease: EASE.saida })
          .add(sombraNoAr(0.55, 0.12), '<')
          .to(corpo, { scaleX: 1, scaleY: 1, duration: 0.05, ease: 'sine.out' })
          .to(corpo, { y: 0, rotation: 0, duration: 0.14, ease: EASE.entrada })
          .add(sombraNoChao(0.14), '<')
          .to(corpo, { scaleX: 1.06, scaleY: 0.94, duration: 0.05, ease: 'power1.out' })
          .to(corpo, { scaleX: 1, scaleY: 1, duration: 0.28, ease: 'back.out(2.5)' });
      }

      if (humor === 'dormindo') {
        // A cabeça pendida é da postura (CSS); os "z" sobem e somem, um depois do outro.
        const zs = zzz.current ? [...zzz.current.children] : [];
        zs.forEach((z, i) => {
          loop({ delay: 0.4 + i * 1.6, repeatDelay: 0.6 })
            .fromTo(z, { opacity: 0, x: 0, y: 2 }, { opacity: 0.85, x: 1, y: -3, duration: 1.2, ease: 'sine.out' })
            .to(z, { opacity: 0, x: 2.5, y: -8, duration: 1.4, ease: 'sine.in' });
        });
      }
    }, svg);

    return () => {
      // Guarda a pose de agora: o próximo gesto (ou o próximo Perdidinho do tour) parte dela.
      const pose = poseAtual(corpo);
      poseHerdada.current = ehNeutra(pose) ? null : pose;
      // Só conta como "continuação" quem já tinha terminado de entrar (no StrictMode o
      // primeiro efeito é desfeito antes disso, e a entrada não pode ser pulada).
      if (entrou.current) ultimaSaida = { t: performance.now(), pose };
      meus.forEach((a) => registrados.delete(a));
      ctx.revert();
    };
  }, [humor, passo, lado, parado, comCiclos]);

  // Respiração em repouso, ancorada na base (mais lenta e funda dormindo; curta e cansada triste).
  const ritmo = humor === 'dormindo' ? 'lento' : humor === 'triste' || humor === 'chorando' ? 'cansado' : 'normal';
  useLayoutEffect(() => {
    const el = respira.current;
    if (parado || !el) return;
    const registrados = ciclos.current;
    const forma = { normal: { scaleY: 1.018, scaleX: 0.992, duration: 1.7 }, cansado: { scaleY: 1.012, scaleX: 0.995, duration: 2.1 }, lento: { scaleY: 1.04, scaleX: 0.985, duration: 2.6 } }[ritmo];
    let anim: gsap.core.Animation | null = null;
    const ctx = gsap.context(() => {
      anim = ciclo(gsap.to(el, { ...forma, transformOrigin: '50% 100%', ease: EASE.suave, yoyo: true, repeat: -1, delay: 0.6 }));
    }, svg);
    return () => {
      if (anim) registrados.delete(anim);
      ctx.revert();
    };
  }, [ritmo, parado]);

  // Olhos: na troca de humor abrem já na nova expressão (piscada de transição); depois piscam
  // em intervalos irregulares, às vezes duas vezes seguidas.
  useLayoutEffect(() => {
    const el = olhos.current;
    const anterior = humorAnterior.current;
    const olhosAntes = olhosAnteriores.current;
    humorAnterior.current = humor;
    olhosAnteriores.current = tipoOlhos;
    // Só os olhos mudaram (prop `olhos`): pisca para a nova forma, sem refazer as sobrancelhas.
    const soOlhos = anterior === humor && olhosAntes !== null && olhosAntes !== tipoOlhos;
    if (parado || !el) return;
    const registrados = ciclos.current;
    let relogio: gsap.core.Animation | null = null;
    const ctx = gsap.context(() => {
      gsap.set(el, { transformOrigin: '50% 50%' });
      if (tipoOlhos === 'arregalados') {
        gsap.from(el, { scale: 0.7, duration: 0.34, ease: 'back.out(3)', delay: 0.08 });
      } else if ((anterior && anterior !== humor) || soOlhos) {
        gsap.from(el, { scaleY: 0.1, duration: 0.16, ease: EASE.saida });
      }
      // Sobrancelhas chegam junto com os olhos: sobem de susto, caem na tristeza, arqueiam no "hmm".
      const sb = sobrancelhas.current;
      if (sb && !soOlhos) {
        if (tipoSobrancelhas === 'levantadas') gsap.from(sb, { y: 2.5, duration: 0.26, ease: 'back.out(3)', delay: 0.08 });
        else if (tipoSobrancelhas === 'tristes') gsap.from(sb, { y: -1.5, opacity: 0, duration: 0.4, ease: 'power2.out' });
        else gsap.from(sb, { y: 1, opacity: 0, duration: 0.3, ease: EASE.saida, delay: 0.1 });
      }
      // Gotinha de suor do preocupado: aparece escorregando 1 px, uma vez (sem laço).
      if (suor.current && !soOlhos) gsap.from(suor.current, { opacity: 0, y: -1.5, duration: 0.3, ease: EASE.saida, delay: 0.12 });
      if (!PISCAM.has(tipoOlhos)) return;

      const lenta = tipoOlhos === 'tristes';
      const fechar = { scaleY: 0.1, duration: lenta ? 0.1 : 0.07, ease: EASE.entrada };
      const abrir = { scaleY: 1, duration: lenta ? 0.2 : 0.12, ease: EASE.saida };
      const simples = gsap.timeline({ paused: true }).to(el, fechar).to(el, abrir);
      const dupla = gsap.timeline({ paused: true }).to(el, fechar).to(el, abrir).to(el, { ...fechar, duration: 0.06 }, '+=0.08').to(el, abrir);
      const intervalo = () => gsap.utils.random(2.4, 5.6);
      // Um só relógio, reaproveitado: nada se acumula em sessões longas.
      const r = gsap.delayedCall(intervalo(), () => {
        (Math.random() < 0.22 ? dupla : simples).restart();
        r.delay(intervalo()).restart(true);
      });
      relogio = ciclo(r);
    }, svg);
    return () => {
      if (relogio) registrados.delete(relogio);
      ctx.revert();
    };
  }, [humor, tipoOlhos, tipoSobrancelhas, parado]);

  // Postura: o React aplica o transform (estilo); a transição CSS faz a troca entre humores. Se este
  // Perdidinho continua um que acabou de desmontar (tour), parte da postura dele para não "saltar".
  const posturaAtual = useRef(posturaCss);
  posturaAtual.current = posturaCss;
  useLayoutEffect(() => {
    const el = postura.current;
    const antes = ultimaPostura;
    if (el && !parado && antes && performance.now() - antes.t < JANELA_CONTINUIDADE && antes.transform !== posturaAtual.current) {
      el.style.transform = antes.transform;
      el.getBoundingClientRect(); // fixa o ponto de partida da transição
      el.style.transform = posturaAtual.current;
    }
    return () => { ultimaPostura = { t: performance.now(), transform: posturaAtual.current }; };
  }, [parado]);

  // Virar: camada própria entre a respiração e o gesto (os gestos também mexem em rotation/x).
  // Primeira pintura já na pose pedida; depois, 200 ms power2.out (instantâneo se parado).
  useLayoutEffect(() => {
    const el = vira.current;
    const antes = viradoAntes.current;
    viradoAntes.current = virado;
    if (!el || (!virado && !antes)) return;
    const pose = { rotation: virado ? -6 : 0, x: virado ? -2 : 0, transformOrigin: '50% 100%' };
    if (parado || antes === null) {
      gsap.set(el, pose);
      return;
    }
    const tw = gsap.to(el, { ...pose, duration: 0.2, ease: 'power2.out', overwrite: 'auto' });
    return () => { tw.kill(); };
  }, [virado, parado]);

  // Fora da tela, os ciclos infinitos param (economia em páginas longas e no celular).
  useEffect(() => {
    const el = svg.current;
    if (parado || !el || typeof IntersectionObserver === 'undefined') return;
    const registrados = ciclos.current;
    const observador = new IntersectionObserver(([e]) => {
      visivel.current = e.isIntersecting;
      registrados.forEach((a) => (e.isIntersecting ? a.resume() : a.pause()));
    });
    observador.observe(el);
    return () => {
      observador.disconnect();
      visivel.current = true;
    };
  }, [parado]);

  // Olhos seguem o mouse só em ponteiro fino, com movimento permitido e sem olhar fixo.
  // A transição CSS do olhar dá o pequeno atraso (os olhos "alcançam" o ponteiro).
  const olharLivre = !olharFixo;
  // Pose de olhar que o React aplicou por último: a limpeza volta para ela (e não para "vazio"),
  // senão, ao trocar para um olhar fixo, a limpeza roda depois do commit e apaga o transform novo.
  const olharAtual = useRef({ x: olharX, y: olharY });
  olharAtual.current = { x: olharX, y: olharY };
  useEffect(() => {
    const el = olhar.current;
    if (parado || !olharLivre || !el || !window.matchMedia('(pointer: fine)').matches) return;
    let quadro = 0;
    let ultimo: PointerEvent | null = null;
    const atualizar = () => {
      quadro = 0;
      if (!ultimo || !visivel.current) return;
      const r = svg.current?.getBoundingClientRect();
      if (!r) return;
      const cx = r.left + r.width * 0.44;
      const cy = r.top + r.height * 0.55;
      el.style.transform = transformOlhar({ x: (ultimo.clientX - cx) / 220, y: (ultimo.clientY - cy) / 220 });
    };
    const aoMover = (e: PointerEvent) => {
      ultimo = e;
      if (!quadro) quadro = requestAnimationFrame(atualizar);
    };
    window.addEventListener('pointermove', aoMover, { passive: true });
    return () => {
      window.removeEventListener('pointermove', aoMover);
      cancelAnimationFrame(quadro);
      el.style.transform = transformOlhar(olharAtual.current);
    };
  }, [parado, olharLivre]);

  return (
    <pf-perdidinho {...(decorativo ? { 'aria-hidden': true } : { role: 'img', 'aria-label': 'Perdidinho, o guia do Park Flash' })} data-humor={humor} data-olhos={tipoOlhos} data-sobrancelhas={tipoSobrancelhas ?? undefined}>
      <svg ref={svg} className={`perdidinho${parado ? '' : ' perdidinho--vivo'}`} viewBox="0 0 64 64" width={tamanho} height={tamanho} aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id={`${id}-face`} x1="0" y1="0" x2="1" y2="1">
            <stop className="perdidinho__luz-a" offset="0" />
            <stop className="perdidinho__luz-b" offset="1" />
          </linearGradient>
        </defs>
        <g ref={entrada}>
          <ellipse ref={sombra} className="perdidinho__sombra" cx="29" cy="61.5" rx="17" ry="2.4" />
          <g ref={respira}>
            <g ref={vira}>
            <g ref={postura} className="perdidinho__postura" style={{ transform: posturaCss }}>
            <g ref={gesto}>
              <g className="perdidinho__lado">
                {PROFUNDIDADE.map((d) => <rect key={d} x={6 + d} y={14 - d} width="44" height="44" rx="12" />)}
              </g>
              <path className="perdidinho__aresta" d="M22 10 H44 Q54 10 54 20 V42" strokeWidth="1" strokeOpacity="0.6" fill="none" strokeLinecap="round" />
              <rect x="6" y="14" width="44" height="44" rx="12" fill={`url(#${id}-face)`} />
              <path className="perdidinho__brilho" d="M10.8 22.6 Q11.2 18.6 15.2 18" strokeOpacity="0.28" strokeWidth="2.2" strokeLinecap="round" fill="none" />
              {/* Raio âmbar do logo, no canto da face. */}
              <path className="perdidinho__raio" d="M44.6 44.5 L40.4 50.2 H43.2 L41.8 55.2 L46.2 49 H43.4 Z" />
              {humor === 'pensando' && (
                // Preocupado: gotinha de suor na têmpora (o único sinal além do rosto, bem discreto).
                <path ref={suor} className="perdidinho__suor" d={gota(44.6, 17.6)} strokeWidth="0.9" strokeLinejoin="round" />
              )}
              <g ref={olhar} className="perdidinho__olhar" style={{ transform: transformOlhar({ x: olharX, y: olharY }) }}>
              <g className="perdidinho__rosto" transform={rosto}>
                <g ref={olhos}>
                  {tipoOlhos === 'alegres' && (
                    // Arcos altos e grossos (^^): no tamanho pequeno são o que separa o feliz do resto.
                    <g className="perdidinho__alegre perdidinho__traco" strokeWidth="3.6" strokeLinecap="round" fill="none">
                      <path d="M16.6 38.4 Q20.5 30.6 24.4 38.4" />
                      <path d="M31.6 38.4 Q35.5 30.6 39.4 38.4" />
                    </g>
                  )}
                  {tipoOlhos === 'piscadela' && (
                    // "Oi!": o esquerdo em ^ (mesmo arco do feliz) e o direito aberto. Assimetria = aceno, não "feliz".
                    <g className="perdidinho__piscadela">
                      <path className="perdidinho__traco" d="M16.6 38.4 Q20.5 30.6 24.4 38.4" strokeWidth="3.6" strokeLinecap="round" fill="none" />
                      <rect className="perdidinho__olhos" x="32.5" y="29" width="6" height="12" rx="3" />
                    </g>
                  )}
                  {tipoOlhos === 'mirando' && (
                    // "Olha ali!": o olho do lado do alvo aberto e mais alto; o outro semicerrado (topo reto, menor).
                    <g className="perdidinho__olhos perdidinho__mirando">
                      <rect x="17.2" y="28.4" width="6.6" height="12.6" rx="3.3" />
                      <path d="M32.5 33.2 H38.5 V38 A3 3 0 0 1 32.5 38 Z" />
                    </g>
                  )}
                  {tipoOlhos === 'redondos' && (
                    // Preocupado: redondos, abertos e lisos (sem a pupila do susto), um pouco abaixo do meio.
                    <g className="perdidinho__olhos perdidinho__redondos">
                      <circle cx="20.5" cy="35.4" r="4.3" />
                      <circle cx="35.5" cy="35.4" r="4.3" />
                    </g>
                  )}
                  {tipoOlhos === 'abertos' && (
                    <g className="perdidinho__olhos">
                      <rect x="17.5" y="29" width="6" height="12" rx="3" />
                      <rect x="32.5" y="29" width="6" height="12" rx="3" />
                    </g>
                  )}
                  {tipoOlhos === 'tristes' && (
                    // Semicerrados: pálpebra inclinada para fora (cantinhos caídos), metade do olho à vista.
                    <g className="perdidinho__olhos perdidinho__tristes">
                      <path d="M17.5 36 L23.5 33.4 V38.2 A3 3 0 0 1 17.5 38.2 Z" />
                      <path d="M32.5 33.4 L38.5 36 V38.2 A3 3 0 0 1 32.5 38.2 Z" />
                    </g>
                  )}
                  {tipoOlhos === 'arregalados' && (
                    // Redondos e maiores, com pupila pequena no meio: o único olho "com pupila" (olhar fixo de susto).
                    <g className="perdidinho__arregalados">
                      <ellipse className="perdidinho__olhos" cx="20.5" cy="34.5" rx="5.2" ry="5.6" />
                      <ellipse className="perdidinho__olhos" cx="35.5" cy="34.5" rx="5.2" ry="5.6" />
                      <circle className="perdidinho__pupila" cx="20.5" cy="34.8" r="2.3" />
                      <circle className="perdidinho__pupila" cx="35.5" cy="34.8" r="2.3" />
                    </g>
                  )}
                  {tipoOlhos === 'espiando' && (
                    // Espiando: o esquerdo fechado (mesmo traço do "fechados"), o direito aberto e menor.
                    <g className="perdidinho__espiando">
                      <path className="perdidinho__traco" d="M17 36.5 Q20.5 39.5 24 36.5" strokeWidth="2.6" strokeLinecap="round" fill="none" />
                      <rect className="perdidinho__olhos" x="32.5" y="31" width="6" height="8" rx="3" />
                    </g>
                  )}
                  {tipoOlhos === 'fechados' && (
                    // Arcos baixos e rasos (‿‿), opostos ao ^^ do feliz.
                    <g className="perdidinho__fechados perdidinho__traco" strokeWidth="2.8" strokeLinecap="round" fill="none">
                      <path d="M16.8 37.4 Q20.5 41.4 24.2 37.4" />
                      <path d="M31.8 37.4 Q35.5 41.4 39.2 37.4" />
                    </g>
                  )}
                </g>
                {/* Sobrancelhas: traço curto e arredondado na cor dos olhos, só onde fazem a expressão. */}
                {tipoSobrancelhas && (
                  <g ref={sobrancelhas} className="perdidinho__sobrancelhas perdidinho__traco" data-forma={tipoSobrancelhas}
                    strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" fill="none">
                    {tipoSobrancelhas === 'tristes' && (
                      // Baixas, quase encostadas na pálpebra, curvando para baixo na ponta de fora (desânimo).
                      <>
                        <path d="M16.4 32.8 Q18.6 29.8 23.4 29.6" />
                        <path d="M32.6 29.6 Q37.4 29.8 39.6 32.8" />
                      </>
                    )}
                    {tipoSobrancelhas === 'preocupadas' && (
                      // Altas e íngremes, retas, pontas de dentro bem para cima, longe dos olhos (aflição).
                      <>
                        <path d="M16.4 27.4 L23.4 21.4" />
                        <path d="M32.6 21.4 L39.6 27.4" />
                      </>
                    )}
                    {tipoSobrancelhas === 'levantadas' && (
                      // Arcos altos e afastados do centro.
                      <>
                        <path d="M14.6 24.6 Q18.4 20.4 22.4 22.2" />
                        <path d="M33.6 22.2 Q37.6 20.4 41.4 24.6" />
                      </>
                    )}
                    {tipoSobrancelhas === 'calmas' && (
                      // Arcos suaves e simétricos, na altura normal: atento e tranquilo.
                      <>
                        <path d="M17 25.6 Q20.5 23.6 24 25.2" />
                        <path d="M32 25.2 Q35.5 23.6 39 25.6" />
                      </>
                    )}
                    {tipoSobrancelhas === 'alerta' && (
                      // Uma só, bem levantada e arqueada, sobre o olho aberto (o do lado do alvo).
                      <path d="M15.4 25.4 Q18.8 18.4 24.6 21.2" />
                    )}
                  </g>
                )}
                {humor === 'chorando' && (
                  // Uma gota por olho, saindo do canto de baixo (azul-claro com contorno marinho fino).
                  <g ref={lagrimas} className="perdidinho__lagrimas" strokeWidth="0.8" strokeLinejoin="round">
                    <path className="perdidinho__lagrima" d={gota(18.6, 40.4)} />
                    <path className="perdidinho__lagrima" d={gota(34.4, 40.4)} />
                  </g>
                )}
              </g>
              </g>
            </g>
            </g>
            </g>
          </g>
          {humor === 'dormindo' && (
            <g ref={zzz} className="perdidinho__zzz" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none">
              <path d="M49 12 H53 L49 16 H53" />
              <path d="M55 4.5 H58 L55 7.5 H58" />
            </g>
          )}
        </g>
      </svg>
    </pf-perdidinho>
  );
}
