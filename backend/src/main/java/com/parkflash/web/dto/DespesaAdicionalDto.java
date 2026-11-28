package com.parkflash.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record DespesaAdicionalDto(@NotBlank @Size(max = 200) String descricao, @NotNull @PositiveOrZero BigDecimal valor) {
}
