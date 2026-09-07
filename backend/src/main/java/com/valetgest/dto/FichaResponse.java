package com.valetgest.dto;

import com.valetgest.entity.Ficha;
import com.valetgest.enums.TipoPagamentoManobrista;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * Resposta da API quando o frontend pede uma ficha.
 * Já vem com todos os valores calculados!
 */
@Data
@Builder
public class FichaResponse {

    private Long id;
    private LocalDate dataFicha;
    private Long unidadeId;
    private String unidadeNome;

    private BigDecimal valorInicial;
    private BigDecimal valorFinal;
    private Integer quantidadeManobras;
    private BigDecimal porcentagemCartao;
    private BigDecimal valorEmCartao;
    private BigDecimal valorDinheiro;

    // Valores calculados pela entidade
    private BigDecimal totalBruto;
    private BigDecimal totalPagoManobristas;
    private BigDecimal taxaCartao;
    private BigDecimal totalDespesas;
    private BigDecimal valorLiquido;

    private List<LancamentoResponse> lancamentos;
    private List<DespesaResponse> despesas;
    private String observacoes;

    @Data
    @Builder
    public static class LancamentoResponse {
        private Long id;
        private Long manobristaId;
        private String manobristaNome;
        private TipoPagamentoManobrista tipoPagamento;
        private Integer quantidadeManobras;
        private BigDecimal valorPorManobra;
        private BigDecimal porcentagem;
        private BigDecimal valorPago;
    }

    @Data
    @Builder
    public static class DespesaResponse {
        private Long id;
        private String descricao;
        private BigDecimal valor;
    }

    /**
     * Método de conversão (mapper).
     * Pega uma entidade Ficha e transforma em FichaResponse.
     *
     * Manter mapeadores como métodos estáticos é uma prática
     * comum em projetos pequenos/médios. Em projetos grandes,
     * usa-se MapStruct.
     */
    public static FichaResponse fromEntity(Ficha ficha) {
        return FichaResponse.builder()
                .id(ficha.getId())
                .dataFicha(ficha.getDataFicha())
                .unidadeId(ficha.getUnidade().getId())
                .unidadeNome(ficha.getUnidade().getNome())
                .valorInicial(ficha.getValorInicial())
                .valorFinal(ficha.getValorFinal())
                .quantidadeManobras(ficha.getQuantidadeManobras())
                .porcentagemCartao(ficha.getPorcentagemCartao())
                .valorEmCartao(ficha.getValorEmCartao())
                .valorDinheiro(ficha.getValorDinheiro() != null ? ficha.getValorDinheiro() : java.math.BigDecimal.ZERO)
                .totalBruto(ficha.getTotalBruto())
                .totalPagoManobristas(ficha.getTotalPagoManobristas())
                .taxaCartao(ficha.getTaxaCartao())
                .totalDespesas(ficha.getTotalDespesas())
                .valorLiquido(ficha.getValorLiquido())
                .observacoes(ficha.getObservacoes())
                .lancamentos(ficha.getLancamentos().stream()
                        .map(l -> LancamentoResponse.builder()
                                .id(l.getId())
                                .manobristaId(l.getManobrista().getId())
                                .manobristaNome(l.getManobrista().getNome())
                                .tipoPagamento(l.getTipoPagamento())
                                .quantidadeManobras(l.getQuantidadeManobras())
                                .valorPorManobra(l.getValorPorManobra())
                                .porcentagem(l.getPorcentagem())
                                .valorPago(l.getValorPago())
                                .build())
                        .toList())
                .despesas(ficha.getDespesas().stream()
                        .map(d -> DespesaResponse.builder()
                                .id(d.getId())
                                .descricao(d.getDescricao())
                                .valor(d.getValor())
                                .build())
                        .toList())
                .build();
    }
}
