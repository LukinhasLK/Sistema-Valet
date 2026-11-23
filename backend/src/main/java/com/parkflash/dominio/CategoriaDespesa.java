package com.parkflash.dominio;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/** Categoria de despesa fixa. No JSON usa o rótulo; no banco, o nome da constante. */
public enum CategoriaDespesa {
    SEGURO("Seguro"), MANUTENCAO("Manutenção"), ALUGUEL("Aluguel"), OUTROS("Outros");

    private final String rotulo;

    CategoriaDespesa(String rotulo) {
        this.rotulo = rotulo;
    }

    @JsonValue
    public String getRotulo() {
        return rotulo;
    }

    @JsonCreator
    public static CategoriaDespesa deRotulo(String valor) {
        for (CategoriaDespesa item : values()) {
            if (item.rotulo.equalsIgnoreCase(valor) || item.name().equalsIgnoreCase(valor)) {
                return item;
            }
        }
        throw new IllegalArgumentException("Valor inválido: " + valor);
    }
}
