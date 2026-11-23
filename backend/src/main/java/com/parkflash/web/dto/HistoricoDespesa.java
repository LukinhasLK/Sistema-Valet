package com.parkflash.web.dto;

import com.parkflash.dominio.CategoriaDespesa;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;

public record HistoricoDespesa(long id, String acao, String ator, OffsetDateTime registradoEm, LocalDate data,
                              CategoriaDespesa categoria, String descricao, BigDecimal valor, String justificativa) {
    public record Cancelamento(@NotBlank @Size(max = 500) String justificativa) {}
}
