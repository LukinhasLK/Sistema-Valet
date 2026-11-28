import { ComponentType } from 'react';
import { create } from 'zustand';

/**
 * Ponto de integração do mascote 3D (o carrinho assistente do Park Flash).
 *
 * O tour já informa em que estado o mascote deve estar a cada passo. Quando o modelo 3D
 * estiver pronto, basta registrar o componente uma única vez (ex.: em main.tsx):
 *
 *   registrarMascote(CarrinhoAssistente);
 *
 * O componente recebe `PropsMascote` e deve respeitar `reduzirMovimento`.
 * Enquanto nada for registrado, o tour funciona normalmente, sem mascote.
 */
/** Humores usados pelo tour guiado. */
export type HumorTour = 'acenando' | 'explicando' | 'apontando' | 'comemorando' | 'pensando';
/**
 * Todos os humores do mascote. Além dos do tour: 'feliz' (deu certo, sem o alarde de
 * 'comemorando'), 'triste' (erro, sem conexão), 'chorando' (falha grave, perda de dados),
 * 'surpreso' (novidade, algo inesperado) e 'dormindo' (estado vazio ou ocioso). Quem registrar
 * um mascote deve tratar os humores que não conhece como 'explicando'.
 */
export type HumorMascote = HumorTour | 'feliz' | 'triste' | 'chorando' | 'surpreso' | 'dormindo';

export interface PropsMascote {
  humor: HumorMascote;
  /** O texto do passo está sendo exibido (para animação de "fala"). */
  falando: boolean;
  /** Identificador do passo atual do tour. */
  passo: string;
  /** Lado do cartão do tour em relação ao elemento destacado. */
  lado: 'top' | 'bottom' | 'left' | 'right' | 'centro';
  reduzirMovimento: boolean;
}

export const useMascote = create<{ componente: ComponentType<PropsMascote> | null }>(() => ({ componente: null }));

export function registrarMascote(componente: ComponentType<PropsMascote> | null): void {
  useMascote.setState({ componente });
}
