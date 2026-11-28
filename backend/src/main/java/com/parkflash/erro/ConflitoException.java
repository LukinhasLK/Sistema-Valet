package com.parkflash.erro;

/** Operação viola uma regra de negócio ou um vínculo existente (HTTP 409). */
public class ConflitoException extends RuntimeException {

    public ConflitoException(String mensagem) {
        super(mensagem);
    }
}
