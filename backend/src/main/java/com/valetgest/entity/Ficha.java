package com.valetgest.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * A FICHA é o coração do sistema.
 *
 * Cada ficha representa um dia de trabalho em uma unidade,
 * onde o usuário registra:
 * - Valor inicial e final (pega o começo e fim, como ele falou)
 * - Quais manobristas trabalharam e quanto receberam
 * - Taxa do cartão
 * - Despesas adicionais
 *
 * No final, o sistema calcula o VALOR LÍQUIDO automaticamente.
 *
 * IMPORTANTE: Para valores em dinheiro, sempre use BigDecimal.
 * NUNCA use double ou float, pois eles dão erro de arredondamento!
 */
@Entity
@Table(name = "fichas")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Ficha {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * Data da ficha (o dia que foi trabalhado).
     */
    @Column(name = "data_ficha", nullable = false)
    private LocalDate dataFicha;

    /**
     * Unidade onde essa ficha foi feita.
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "unidade_id", nullable = false)
    private Unidade unidade;

    /**
     * Quem criou a ficha (pra rastreabilidade).
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "usuario_id")
    private Usuario usuarioCriador;

    // ====================================================
    // VALORES DA FICHA
    // ====================================================

    /**
     * Valor inicial - "começo da ficha"
     */
    @Column(name = "valor_inicial", nullable = false, precision = 10, scale = 2)
    private BigDecimal valorInicial;

    /**
     * Valor final - "final da ficha"
     */
    @Column(name = "valor_final", nullable = false, precision = 10, scale = 2)
    private BigDecimal valorFinal;

    /**
     * Quantas manobras (carros) foram feitas no total.
     */
    @Column(name = "quantidade_manobras", nullable = false)
    private Integer quantidadeManobras;

    // ====================================================
    // TAXAS E DESPESAS
    // ====================================================

    /**
     * Porcentagem do cartão (ex: 3.5 = 3.5%).
     * É calculada sobre (valorFinal - valorInicial).
     */
    @Column(name = "porcentagem_cartao", precision = 5, scale = 2)
    @Builder.Default
    private BigDecimal porcentagemCartao = BigDecimal.ZERO;

    /**
     * Quanto do faturamento do dia veio em cartão.
     * Sobre esse valor é que se aplica a porcentagem.
     */
    @Column(name = "valor_em_cartao", precision = 10, scale = 2)
    @Builder.Default
    private BigDecimal valorEmCartao = BigDecimal.ZERO;

    /**
     * Quanto do faturamento do dia veio em dinheiro (espécie).
     */
    @Column(name = "valor_dinheiro", precision = 10, scale = 2)
    @Builder.Default
    private BigDecimal valorDinheiro = BigDecimal.ZERO;

    // ====================================================
    // RELACIONAMENTOS
    // ====================================================

    /**
     * Lista dos manobristas que trabalharam nessa ficha
     * e quanto cada um recebeu.
     *
     * cascade = ALL: ao salvar/deletar a ficha, salva/deleta os lançamentos juntos
     * orphanRemoval = true: ao remover um lançamento da lista, ele é deletado do banco
     */
    @OneToMany(mappedBy = "ficha", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<LancamentoManobrista> lancamentos = new ArrayList<>();

    /**
     * Despesas adicionais do dia (gasolina, lavagem, etc).
     * Como você disse que variam por dia, cada ficha tem suas próprias despesas.
     */
    @OneToMany(mappedBy = "ficha", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<Despesa> despesas = new ArrayList<>();

    @Column(length = 500)
    private String observacoes;

    @Column(name = "criado_em", nullable = false, updatable = false)
    private LocalDateTime criadoEm;

    @Column(name = "atualizado_em")
    private LocalDateTime atualizadoEm;

    @PrePersist
    protected void onCreate() {
        criadoEm = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        atualizadoEm = LocalDateTime.now();
    }

    // ====================================================
    // MÉTODOS DE CÁLCULO
    // Aqui é onde a mágica acontece :)
    // ====================================================

    /**
     * Total bruto = cartão + dinheiro.
     */
    public BigDecimal getTotalBruto() {
        BigDecimal cartao = valorEmCartao != null ? valorEmCartao : BigDecimal.ZERO;
        BigDecimal dinheiro = valorDinheiro != null ? valorDinheiro : BigDecimal.ZERO;
        return cartao.add(dinheiro);
    }

    /**
     * Total que foi pago aos manobristas.
     * Soma o valor pago de cada lançamento.
     */
    public BigDecimal getTotalPagoManobristas() {
        return lancamentos.stream()
                .map(LancamentoManobrista::getValorPago)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    /**
     * Quanto foi descontado de taxa de cartão.
     * Cálculo: valorEmCartao * (porcentagemCartao / 100)
     */
    public BigDecimal getTaxaCartao() {
        if (valorEmCartao == null || porcentagemCartao == null) {
            return BigDecimal.ZERO;
        }
        return valorEmCartao
                .multiply(porcentagemCartao)
                .divide(new BigDecimal("100"), 2, java.math.RoundingMode.HALF_UP);
    }

    /**
     * Soma de todas as despesas adicionais do dia.
     */
    public BigDecimal getTotalDespesas() {
        return despesas.stream()
                .map(Despesa::getValor)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    /**
     * VALOR LÍQUIDO = total bruto - manobristas - taxa cartão - despesas
     * É isso que você quer ver no final!
     */
    public BigDecimal getValorLiquido() {
        return getTotalBruto()
                .subtract(getTotalPagoManobristas())
                .subtract(getTaxaCartao())
                .subtract(getTotalDespesas());
    }
}
