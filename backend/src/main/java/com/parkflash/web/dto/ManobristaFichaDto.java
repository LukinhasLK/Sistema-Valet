package com.parkflash.web.dto;

import com.parkflash.dominio.ModalidadeCusto;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

import java.math.BigDecimal;

public record ManobristaFichaDto(@NotNull Long manobristaId, @NotNull @PositiveOrZero BigDecimal diaria,
                                Boolean pagaNaFicha, PagamentoManobristaDto.Forma formaPagamento,
                                ModalidadeCusto modalidade) {
}
