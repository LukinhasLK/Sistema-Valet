package com.valetgest.dto;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * Relatório mensal detalhado.
 * É isso que vai aparecer na tela e ser exportado em PDF/Excel.
 */
@Data
@Builder
public class RelatorioMensalResponse {

    private Integer mes;
    private Integer ano;
    private LocalDate inicio;
    private LocalDate fim;

    private Long unidadeId;       // null se for relatório geral
    private String unidadeNome;   // "Todas as unidades" se for geral

    // Totalizadores do mês
    private Integer quantidadeFichas;
    private Integer totalManobras;
    private BigDecimal totalBruto;
    private BigDecimal totalPagoManobristas;
    private BigDecimal totalTaxaCartao;
    private BigDecimal totalDespesas;
    private BigDecimal valorLiquidoTotal;

    // Detalhamento por dia
    private List<FichaResponse> fichas;

    // Resumo por unidade (quando é relatório geral)
    private List<ResumoUnidade> resumoPorUnidade;

    @Data
    @Builder
    public static class ResumoUnidade {
        private Long unidadeId;
        private String unidadeNome;
        private Integer quantidadeFichas;
        private BigDecimal totalBruto;
        private BigDecimal valorLiquido;
    }
}
