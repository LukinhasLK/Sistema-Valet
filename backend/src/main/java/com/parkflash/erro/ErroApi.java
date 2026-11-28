package com.parkflash.erro;

import java.util.Map;

/** Corpo padrão de erro: o front mostra `mensagem` ao usuário. */
public record ErroApi(int status, String mensagem, Map<String, String> campos) {

    public ErroApi(int status, String mensagem) {
        this(status, mensagem, Map.of());
    }
}
