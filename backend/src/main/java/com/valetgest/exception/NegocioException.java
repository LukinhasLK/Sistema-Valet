package com.valetgest.exception;

/**
 * Exceção para erros de regra de negócio.
 *
 * Quando algo dá errado por uma validação nossa (ex: email já existe,
 * usuário inativo, etc), lançamos essa exceção.
 *
 * O GlobalExceptionHandler captura ela e responde com status 400.
 */
public class NegocioException extends RuntimeException {
    public NegocioException(String message) {
        super(message);
    }
}
