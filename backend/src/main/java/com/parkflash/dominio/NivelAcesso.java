package com.parkflash.dominio;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/** Nível de acesso do usuário (mesmos rótulos do front). No JSON usa o rótulo; no banco, o nome da constante. */
public enum NivelAcesso {
    PROPRIETARIO("Proprietário"), GERENTE("Gerente"), OPERADOR("Operador");

    private final String rotulo;

    NivelAcesso(String rotulo) {
        this.rotulo = rotulo;
    }

    @JsonValue
    public String getRotulo() {
        return rotulo;
    }

    @JsonCreator
    public static NivelAcesso deRotulo(String valor) {
        for (NivelAcesso item : values()) {
            if (item.rotulo.equalsIgnoreCase(valor) || item.name().equalsIgnoreCase(valor)) {
                return item;
            }
        }
        throw new IllegalArgumentException("Valor inválido: " + valor);
    }
}
