/** Base da API. Em desenvolvimento o Vite encaminha /api para o Spring Boot (porta 8080). */
export const API_URL = '/api';

/** Erro de uma chamada à API. `status` 0 = sem conexão com o servidor. */
export class ErroHttp extends Error {
  constructor(readonly status: number, readonly corpo: unknown) {
    super(`HTTP ${status}`);
    this.name = 'ErroHttp';
  }
}

export type Parametros = Record<string, string | number | boolean | null | undefined>;

interface Opcoes {
  params?: Parametros;
  corpo?: unknown;
  sinal?: AbortSignal;
}

let obterToken: () => string | null = () => null;
let aoPerderSessao: (tokenUsado: string | null) => void = () => undefined;

/**
 * Liga a API à sessão: de onde vem o token e o que fazer quando o servidor responde 401.
 * `sessaoExpirada` recebe o token usado na requisição: um 401 atrasado de uma sessão anterior
 * (outro usuário no mesmo aparelho) não pode derrubar a sessão atual.
 */
export function configurarApi(config: { token: () => string | null; sessaoExpirada: (tokenUsado: string | null) => void }): void {
  obterToken = config.token;
  aoPerderSessao = config.sessaoExpirada;
}

function montarUrl(caminho: string, params?: Parametros): string {
  const busca = new URLSearchParams();
  for (const [chave, valor] of Object.entries(params ?? {})) {
    if (valor !== undefined && valor !== null && valor !== '') busca.set(chave, String(valor));
  }
  const consulta = busca.toString();
  return `${API_URL}${caminho}${consulta ? `?${consulta}` : ''}`;
}

async function requisitar(metodo: string, caminho: string, opcoes: Opcoes = {}): Promise<Response> {
  const cabecalhos: Record<string, string> = {};
  const token = obterToken();
  if (token) cabecalhos.Authorization = `Bearer ${token}`;

  let corpo: BodyInit | undefined;
  if (opcoes.corpo instanceof FormData) {
    corpo = opcoes.corpo;
  } else if (opcoes.corpo !== undefined) {
    corpo = JSON.stringify(opcoes.corpo);
    cabecalhos['Content-Type'] = 'application/json';
  }

  let resposta: Response;
  try {
    resposta = await fetch(montarUrl(caminho, opcoes.params), {
      method: metodo,
      headers: cabecalhos,
      body: corpo,
      signal: opcoes.sinal,
    });
  } catch (erro) {
    if (erro instanceof DOMException && erro.name === 'AbortError') throw erro;
    throw new ErroHttp(0, null);
  }

  if (!resposta.ok) {
    const texto = await resposta.text().catch(() => '');
    let dados: unknown = texto;
    try {
      dados = texto ? JSON.parse(texto) : null;
    } catch {
      /* corpo não é JSON */
    }
    // Sessão inválida: encerra e volta ao login (exceto na própria tentativa de login).
    if (resposta.status === 401 && !caminho.endsWith('/auth/login')) aoPerderSessao(token);
    throw new ErroHttp(resposta.status, dados);
  }
  return resposta;
}

async function json<T>(resposta: Response): Promise<T> {
  const texto = await resposta.text();
  return (texto ? JSON.parse(texto) : undefined) as T;
}

export const api = {
  get: async <T>(caminho: string, params?: Parametros, sinal?: AbortSignal) =>
    json<T>(await requisitar('GET', caminho, { params, sinal })),
  post: async <T>(caminho: string, corpo?: unknown) => json<T>(await requisitar('POST', caminho, { corpo: corpo ?? {} })),
  put: async <T>(caminho: string, corpo?: unknown) => json<T>(await requisitar('PUT', caminho, { corpo: corpo ?? {} })),
  delete: async (caminho: string) => {
    await requisitar('DELETE', caminho);
  },
  arquivo: async (caminho: string, params?: Parametros) => (await requisitar('GET', caminho, { params })).blob(),
};

/** Mensagem amigável a partir do erro HTTP (o back end devolve `{ mensagem }`). */
export function mensagemDeErro(erro: unknown, padrao = 'Não foi possível concluir a operação.'): string {
  if (erro instanceof ErroHttp) {
    if (erro.status === 0) return 'Sem conexão com o servidor. Verifique se o back end está rodando.';
    const mensagem = (erro.corpo as { mensagem?: unknown } | null)?.mensagem;
    if (typeof mensagem === 'string' && mensagem) return mensagem;
  }
  return padrao;
}
