package com.parkflash.erro;

/** Recurso inexistente (HTTP 404). */
public class NaoEncontradoException extends RuntimeException {

    public NaoEncontradoException(String mensagem) {
        super(mensagem);
    }
}
