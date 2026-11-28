package com.parkflash.web.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.OffsetDateTime;

public record TransicaoFicha(@NotNull Acao acao, @Size(max = 500) String justificativa) {
    public enum Acao { ENVIAR, FECHAR, DEVOLVER, REABRIR }

    public record Registro(String acao, String ator, String justificativa, OffsetDateTime registradoEm) {
    }
}
