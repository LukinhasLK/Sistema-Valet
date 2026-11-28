package com.parkflash.erro;

/** Login bloqueado por excesso de tentativas erradas (HTTP 429). */
public class MuitasTentativasException extends RuntimeException {

    public MuitasTentativasException(String mensagem) {
        super(mensagem);
    }
}
