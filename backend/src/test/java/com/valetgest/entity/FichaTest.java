package com.valetgest.entity;

import com.valetgest.enums.TipoPagamentoManobrista;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Testa os cálculos da entidade Ficha.
 *
 * Por que testar?
 * - Garante que os números estão certos
 * - Evita regressão (se alguém quebrar o cálculo no futuro, o teste avisa)
 * - Documenta o comportamento esperado
 *
 * Padrão AAA:
 * - Arrange (preparar): cria os objetos necessários
 * - Act (agir): executa o método que está sendo testado
 * - Assert (verificar): confere o resultado
 */
@DisplayName("Cálculos da Ficha")
class FichaTest {

    private Ficha ficha;
    private Manobrista manobrista1;
    private Manobrista manobrista2;

    @BeforeEach // roda antes de cada teste
    void setUp() {
        manobrista1 = Manobrista.builder().id(1L).nome("João").build();
        manobrista2 = Manobrista.builder().id(2L).nome("Maria").build();

        ficha = Ficha.builder()
                .valorInicial(new BigDecimal("100.00"))
                .valorFinal(new BigDecimal("900.00"))
                .quantidadeManobras(50)
                .porcentagemCartao(new BigDecimal("3.50"))
                .valorEmCartao(new BigDecimal("500.00"))
                .build();
    }

    @Test
    @DisplayName("Total bruto = valor final - valor inicial")
    void calcularTotalBruto() {
        // Arrange já feito no setUp

        // Act
        BigDecimal totalBruto = ficha.getTotalBruto();

        // Assert
        assertThat(totalBruto).isEqualByComparingTo("800.00");
    }

    @Test
    @DisplayName("Taxa de cartão = valor em cartão * porcentagem / 100")
    void calcularTaxaCartao() {
        // 500 * 3.5% = 17.50
        BigDecimal taxa = ficha.getTaxaCartao();

        assertThat(taxa).isEqualByComparingTo("17.50");
    }

    @Test
    @DisplayName("Taxa de cartão deve ser zero quando não há cartão")
    void taxaCartaoZeroQuandoNaoTemCartao() {
        ficha.setValorEmCartao(BigDecimal.ZERO);
        ficha.setPorcentagemCartao(new BigDecimal("3.5"));

        assertThat(ficha.getTaxaCartao()).isEqualByComparingTo("0.00");
    }

    @Test
    @DisplayName("Total pago aos manobristas é a soma dos lançamentos")
    void calcularTotalPagoManobristas() {
        ficha.getLancamentos().add(LancamentoManobrista.builder()
                .manobrista(manobrista1)
                .tipoPagamento(TipoPagamentoManobrista.VALOR_FIXO_POR_MANOBRA)
                .valorPago(new BigDecimal("125.00"))
                .build());

        ficha.getLancamentos().add(LancamentoManobrista.builder()
                .manobrista(manobrista2)
                .tipoPagamento(TipoPagamentoManobrista.PORCENTAGEM)
                .valorPago(new BigDecimal("160.00"))
                .build());

        BigDecimal total = ficha.getTotalPagoManobristas();

        assertThat(total).isEqualByComparingTo("285.00");
    }

    @Test
    @DisplayName("Total de despesas é a soma de todas as despesas")
    void calcularTotalDespesas() {
        ficha.getDespesas().add(Despesa.builder()
                .descricao("Lanche").valor(new BigDecimal("30.00")).build());
        ficha.getDespesas().add(Despesa.builder()
                .descricao("Combustível").valor(new BigDecimal("50.00")).build());

        BigDecimal total = ficha.getTotalDespesas();

        assertThat(total).isEqualByComparingTo("80.00");
    }

    @Test
    @DisplayName("Valor líquido = bruto - manobristas - taxa cartão - despesas")
    void calcularValorLiquidoCompleto() {
        // Cenário completo igual ao do README:
        // bruto: 800
        // manobristas: 285
        // taxa cartão: 17.50
        // despesas: 80
        // líquido esperado: 417.50

        ficha.getLancamentos().add(LancamentoManobrista.builder()
                .manobrista(manobrista1)
                .tipoPagamento(TipoPagamentoManobrista.VALOR_FIXO_POR_MANOBRA)
                .valorPago(new BigDecimal("125.00"))
                .build());
        ficha.getLancamentos().add(LancamentoManobrista.builder()
                .manobrista(manobrista2)
                .tipoPagamento(TipoPagamentoManobrista.PORCENTAGEM)
                .valorPago(new BigDecimal("160.00"))
                .build());

        ficha.getDespesas().add(Despesa.builder()
                .descricao("Lanche").valor(new BigDecimal("30.00")).build());
        ficha.getDespesas().add(Despesa.builder()
                .descricao("Combustível").valor(new BigDecimal("50.00")).build());

        BigDecimal liquido = ficha.getValorLiquido();

        assertThat(liquido).isEqualByComparingTo("417.50");
    }

    @Test
    @DisplayName("Valor líquido sem manobristas, sem cartão e sem despesas = bruto")
    void valorLiquidoSemDescontos() {
        // Sem nada além do faturamento bruto
        ficha.setPorcentagemCartao(BigDecimal.ZERO);
        ficha.setValorEmCartao(BigDecimal.ZERO);

        BigDecimal liquido = ficha.getValorLiquido();

        // 900 - 100 = 800 (sem nada para descontar)
        assertThat(liquido).isEqualByComparingTo("800.00");
    }

    @Test
    @DisplayName("Valor líquido pode ser zero se gastar tudo")
    void valorLiquidoZero() {
        ficha.setValorInicial(BigDecimal.ZERO);
        ficha.setValorFinal(new BigDecimal("100.00"));
        ficha.setPorcentagemCartao(BigDecimal.ZERO);
        ficha.setValorEmCartao(BigDecimal.ZERO);

        ficha.getDespesas().add(Despesa.builder()
                .descricao("Despesa total").valor(new BigDecimal("100.00")).build());

        assertThat(ficha.getValorLiquido()).isEqualByComparingTo("0.00");
    }

    @Test
    @DisplayName("Total bruto deve retornar zero se valores forem nulos")
    void totalBrutoComValoresNulos() {
        ficha.setValorInicial(null);
        ficha.setValorFinal(null);

        assertThat(ficha.getTotalBruto()).isEqualByComparingTo("0.00");
    }
}
