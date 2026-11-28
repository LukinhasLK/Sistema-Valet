package com.parkflash.dominio;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/** Turno da ficha. No JSON usa o rótulo; no banco, o nome da constante. */
public enum Turno {
    DIA("dia"), NOITE("noite");

    private final String rotulo;

    Turno(String rotulo) {
        this.rotulo = rotulo;
    }

    @JsonValue
    public String getRotulo() {
        return rotulo;
    }

    @JsonCreator
    public static Turno deRotulo(String valor) {
        for (Turno item : values()) {
            if (item.rotulo.equalsIgnoreCase(valor) || item.name().equalsIgnoreCase(valor)) {
                return item;
            }
        }
        throw new IllegalArgumentException("Valor inválido: " + valor);
    }
}
