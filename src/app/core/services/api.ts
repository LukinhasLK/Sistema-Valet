import { HttpErrorResponse } from '@angular/common/http';

/** Base da API. Em desenvolvimento o `proxy.conf.json` encaminha /api para o Spring Boot (porta 8080). */
export const API_URL = '/api';

/** Mensagem amigável a partir do erro HTTP (o back end devolve `{ mensagem }`). */
export function mensagemDeErro(erro: unknown, padrao = 'Não foi possível concluir a operação.'): string {
  if (erro instanceof HttpErrorResponse) {
    if (erro.status === 0) return 'Sem conexão com o servidor. Verifique se o back end está rodando.';
    const mensagem = erro.error?.mensagem;
    if (typeof mensagem === 'string' && mensagem) return mensagem;
  }
  return padrao;
}
