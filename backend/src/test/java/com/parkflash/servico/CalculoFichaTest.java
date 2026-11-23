package com.parkflash.servico;

import com.parkflash.dominio.DespesaAdicional;
import com.parkflash.dominio.FichaManobrista;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class CalculoFichaTest {

    private static BigDecimal bd(String valor) {
        return new BigDecimal(valor);
    }

    @Test
    void totalCarrosDescontaCanceladasENuncaFicaNegativo() {
        assertThat(CalculoFicha.totalCarros(100, 150, 3)).isEqualTo(47);
        assertThat(CalculoFicha.totalCarros(100, 90, 0)).isZero();
    }

    @Test
    void taxaDaMaquininhaSaiDoCartao() {
        assertThat(CalculoFicha.taxaDescontada(bd("1000"), bd("2.5"))).isEqualByComparingTo("25.00");
        assertThat(CalculoFicha.liquidoCartao(bd("1000"), bd("2.5"))).isEqualByComparingTo("975.00");
    }

    @Test
    void saldoFinalIgualAoCalcDoFront() {
        // Mesma ficha do seed: 336 + 504 (2%) − 2×80 − 1511,92 = −842,00
        var saldo = CalculoFicha.saldoFinal(bd("336"), bd("504"), BigDecimal.ZERO, bd("2"),
                List.of(new FichaManobrista(2L, bd("80")), new FichaManobrista(5L, bd("80"))),
                List.of(new DespesaAdicional("Custos operacionais do dia", bd("1511.92"))));
        assertThat(saldo).isEqualByComparingTo("-842.00");
    }

    @Test
    void resultadoDescontaDespesasFixasEParteDoSocioUsaOPercentual() {
        var resultado = CalculoFicha.resultado(bd("440"), bd("200"));
        assertThat(resultado).isEqualByComparingTo("240.00");
        assertThat(CalculoFicha.parteDoSocio(resultado, bd("40"))).isEqualByComparingTo("96.00");
        assertThat(CalculoFicha.parteDoSocio(bd("100"), bd("33.33"))).isEqualByComparingTo("33.33");
    }

    @Test
    void arredondaMeioCentavoParaCima() {
        assertThat(CalculoFicha.arredondar(bd("1.005"))).isEqualByComparingTo("1.01");
    }
}
