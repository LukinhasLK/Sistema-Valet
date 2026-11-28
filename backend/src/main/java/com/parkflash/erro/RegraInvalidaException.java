package com.parkflash.erro;

/** Dados coerentes no formato, mas inválidos pela regra de negócio (HTTP 400). */
public class RegraInvalidaException extends RuntimeException {

    public RegraInvalidaException(String mensagem) {
        super(mensagem);
    }
}
