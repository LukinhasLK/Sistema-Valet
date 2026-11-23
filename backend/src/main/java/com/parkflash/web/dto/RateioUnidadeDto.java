package com.parkflash.web.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

public record RateioUnidadeDto(@NotNull LocalDate vigenteDesde, @NotEmpty @Size(max = 500) List<@NotNull @Valid Parte> partes) {
    public record Parte(@NotNull Long socioId,
                        @NotNull @DecimalMin(value = "0", inclusive = false) @DecimalMax("100")
                        @Digits(integer = 3, fraction = 2) BigDecimal percentual) {}
    public record Revisao(long id, LocalDate vigenteDesde, String autor, OffsetDateTime criadoEm) {}
}
