package com.parkflash.web.dto;

import com.parkflash.dominio.ModalidadeCusto;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

import java.math.BigDecimal;

/** @param diaria teto de R$ 10.000 por manobrista e turno: acima disso é erro de digitação. */
public record ManobristaFichaDto(@NotNull Long manobristaId,
                                @NotNull @PositiveOrZero @Digits(integer = 8, fraction = 2)
                                @DecimalMax(value = "10000.00", message = "não pode passar de R$ 10.000 por turno") BigDecimal diaria,
                                Boolean pagaNaFicha, PagamentoManobristaDto.Forma formaPagamento,
                                ModalidadeCusto modalidade) {
}
