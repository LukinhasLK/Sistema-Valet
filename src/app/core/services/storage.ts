/** Persistência best-effort em localStorage para sessão e preferências do dispositivo. */

/** v3: os dados passaram a ficar no back end; chaves de versões anteriores são removidas. */
const VERSAO = 'v3';
const chaveVersionada = (chave: string) => chave.replace(/^parkflash\./, `parkflash.${VERSAO}.`);

/** Remove chaves de versões anteriores (fichas, usuários e senhas do antigo modo demonstração). */
export function limparVersoesAntigas(): void {
  try {
    Object.keys(localStorage)
      .filter((chave) => chave.startsWith('parkflash.') && !chave.startsWith(`parkflash.${VERSAO}.`))
      .forEach((chave) => localStorage.removeItem(chave));
  } catch {
    /* ignora */
  }
}

limparVersoesAntigas();

export function carregar<T>(chave: string, padrao: T): T {
  try {
    const bruto = localStorage.getItem(chaveVersionada(chave));
    return bruto ? (JSON.parse(bruto) as T) : padrao;
  } catch {
    return padrao;
  }
}

export function salvar(chave: string, valor: unknown): void {
  try {
    localStorage.setItem(chaveVersionada(chave), JSON.stringify(valor));
  } catch {
    /* modo privado / cota cheia — segue sem persistir */
  }
}

export function remover(chave: string): void {
  try {
    localStorage.removeItem(chaveVersionada(chave));
  } catch {
    /* ignora */
  }
}
