package com.valetgest.dto;

import com.valetgest.enums.TipoPagamentoManobrista;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * Dados enviados pelo frontend para criar/atualizar uma ficha.
 */
@Data
public class FichaRequest {

    @NotNull(message = "Data da ficha é obrigatória")
    private LocalDate dataFicha;

    @NotNull(message = "Unidade é obrigatória")
    private Long unidadeId;

    @NotNull(message = "Valor inicial é obrigatório")
    @PositiveOrZero(message = "Valor inicial não pode ser negativo")
    private BigDecimal valorInicial;

    @NotNull(message = "Valor final é obrigatório")
    @PositiveOrZero(message = "Valor final não pode ser negativo")
    private BigDecimal valorFinal;

    @NotNull(message = "Quantidade de manobras é obrigatória")
    @PositiveOrZero
    private Integer quantidadeManobras;

    @PositiveOrZero
    private BigDecimal porcentagemCartao = BigDecimal.ZERO;

    @PositiveOrZero
    private BigDecimal valorEmCartao = BigDecimal.ZERO;

    @PositiveOrZero
    private BigDecimal valorDinheiro = BigDecimal.ZERO;

    @Valid
    private List<LancamentoManobristaRequest> lancamentos = new ArrayList<>();

    @Valid
    private List<DespesaRequest> despesas = new ArrayList<>();

    private String observacoes;

    // ============ Sub-DTOs ============

    @Data
    public static class LancamentoManobristaRequest {
        @NotNull
        private Long manobristaId;

        @NotNull
        private TipoPagamentoManobrista tipoPagamento;

        private Integer quantidadeManobras;
        private BigDecimal valorPorManobra;
        private BigDecimal porcentagem;

        @NotNull
        @PositiveOrZero
        private BigDecimal valorPago;
    }

    @Data
    public static class DespesaRequest {
        @NotNull
        private String descricao;

        @NotNull
        @PositiveOrZero
        private BigDecimal valor;
    }
}
