import { vi } from 'vitest';

interface Pedido { url: string; metodo: string; corpo: unknown; cabecalhos: Record<string, string> }
type Resposta = { status?: number; corpo?: unknown };

/** Substitui o fetch: registra os pedidos e responde conforme as regras (url → resposta). */
export function apiFalsa(regras: Record<string, Resposta | ((p: Pedido) => Resposta)>) {
  const pedidos: Pedido[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit = {}) => {
    const pedido: Pedido = {
      url, metodo: init.method ?? 'GET',
      corpo: typeof init.body === 'string' ? JSON.parse(init.body) : init.body,
      cabecalhos: (init.headers ?? {}) as Record<string, string>,
    };
    pedidos.push(pedido);
    const chave = Object.keys(regras).find((k) => `${pedido.metodo} ${url.split('?')[0]}` === k || url.split('?')[0] === k);
    const regra = chave ? regras[chave] : { status: 404 };
    const { status = 200, corpo = null } = typeof regra === 'function' ? regra(pedido) : regra;
    // 204/205 não podem ter corpo (nem vazio).
    return new Response(corpo === null ? null : JSON.stringify(corpo), { status });
  }));
  return pedidos;
}
