package com.parkflash.web.dto;

import com.parkflash.dominio.Turno;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/** Dados digitados na ficha. Totais (carros, bruto, líquido) são calculados pelo servidor. */
public record FichaRequest(
        @NotNull LocalDate data,
        @NotNull Long unidadeId,
        @NotNull Turno turno,
        @NotNull @PositiveOrZero Integer fichaInicio,
        @NotNull @PositiveOrZero Integer fichaFim,
        @PositiveOrZero Integer fichasCanceladas,
        @PositiveOrZero BigDecimal valorDinheiro,
        @PositiveOrZero BigDecimal valorCartao,
        @PositiveOrZero @Digits(integer = 10, fraction = 2) BigDecimal valorPix,
        @PositiveOrZero @Digits(integer = 10, fraction = 2) BigDecimal valorInicialCaixa,
        @PositiveOrZero @Digits(integer = 10, fraction = 2) BigDecimal valorFinalCaixa,
        @Size(max = 500) String observacoes,
        @NotNull @PositiveOrZero @DecimalMax("100") BigDecimal taxaMaquininha,
        List<@Valid ManobristaFichaDto> manobristas,
        List<@Valid DespesaAdicionalDto> despesasAdicionais) {
}
