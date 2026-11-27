/**
 * Rascunho da ficha guardado no aparelho (localStorage), por usuário e por ficha.
 * Protege o que foi digitado quando a sessão expira ou a internet cai na hora de lançar.
 * É apagado ao lançar com sucesso e no logout explícito (aparelho compartilhado).
 */
const PREFIXO = 'parkflash.v3.rascunho.';
const VERSAO = 1;
/** Rascunhos mais velhos que isso são ignorados (a ficha provavelmente já foi lançada por outro caminho). */
const VALIDADE_MS = 3 * 24 * 3600_000;

export interface RascunhoFicha<T = unknown> {
  versao: number;
  usuario: number;
  /** `null` = ficha nova. */
  fichaId: number | null;
  salvoEm: string;
  dados: T;
}

const chave = (usuario: number, fichaId: number | null) => `${PREFIXO}${usuario}.${fichaId ?? 'nova'}`;

export function salvarRascunho<T>(usuario: number, fichaId: number | null, dados: T, agora = new Date()): void {
  const rascunho: RascunhoFicha<T> = { versao: VERSAO, usuario, fichaId, salvoEm: agora.toISOString(), dados };
  try {
    localStorage.setItem(chave(usuario, fichaId), JSON.stringify(rascunho));
  } catch {
    /* modo privado ou cota cheia: segue sem rascunho */
  }
}

export function lerRascunho<T>(usuario: number, fichaId: number | null, agora = new Date()): RascunhoFicha<T> | null {
  try {
    const bruto = localStorage.getItem(chave(usuario, fichaId));
    if (!bruto) return null;
    const r = JSON.parse(bruto) as RascunhoFicha<T>;
    if (r.versao !== VERSAO || r.usuario !== usuario) return null;
    if (agora.getTime() - new Date(r.salvoEm).getTime() > VALIDADE_MS) {
      descartarRascunho(usuario, fichaId);
      return null;
    }
    return r;
  } catch {
    return null;
  }
}

export function descartarRascunho(usuario: number, fichaId: number | null): void {
  try {
    localStorage.removeItem(chave(usuario, fichaId));
  } catch {
    /* ignora */
  }
}

/** Logout explícito: apaga todos os rascunhos do usuário neste aparelho. */
export function descartarRascunhosDoUsuario(usuario: number): void {
  try {
    Object.keys(localStorage).filter((k) => k.startsWith(`${PREFIXO}${usuario}.`)).forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignora */
  }
}

/** Resumo de um rascunho guardado no aparelho (sem os dados digitados). */
export interface ResumoRascunho {
  /** `null` = ficha nova. */
  fichaId: number | null;
  salvoEm: string;
}

/** Rascunhos válidos do usuário neste aparelho, do mais recente para o mais antigo. Descarta os vencidos. */
export function listarRascunhos(usuario: number, agora = new Date()): ResumoRascunho[] {
  try {
    return Object.keys(localStorage)
      .filter((k) => k.startsWith(`${PREFIXO}${usuario}.`))
      .map((k) => {
        const sufixo = k.slice(`${PREFIXO}${usuario}.`.length);
        const fichaId = sufixo === 'nova' ? null : Number(sufixo);
        if (fichaId !== null && !Number.isInteger(fichaId)) return null;
        const r = lerRascunho(usuario, fichaId, agora);
        return r ? { fichaId, salvoEm: r.salvoEm } : null;
      })
      .filter((r): r is ResumoRascunho => r !== null)
      .sort((a, b) => b.salvoEm.localeCompare(a.salvoEm));
  } catch {
    return [];
  }
}

export const contarRascunhos = (usuario: number, agora = new Date()): number => listarRascunhos(usuario, agora).length;
