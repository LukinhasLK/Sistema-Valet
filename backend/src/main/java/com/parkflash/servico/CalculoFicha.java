package com.parkflash.servico;

import com.parkflash.dominio.DespesaAdicional;
import com.parkflash.dominio.FichaManobrista;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

/** Mesmas fórmulas de `calc.ts` no front, com BigDecimal (2 casas, HALF_UP). */
public final class CalculoFicha {

    private static final BigDecimal CEM = BigDecimal.valueOf(100);

    private CalculoFicha() {
    }

    public static BigDecimal arredondar(BigDecimal valor) {
        return valor.setScale(2, RoundingMode.HALF_UP);
    }

    /** Total real de carros = fim − início − canceladas (nunca negativo). */
    public static int totalCarros(int inicio, int fim, int canceladas) {
        return Math.max(0, fim - inicio - canceladas);
    }

    public static BigDecimal taxaDescontada(BigDecimal valorCartao, BigDecimal taxaPercentual) {
        return arredondar(valorCartao.multiply(taxaPercentual).divide(CEM, 6, RoundingMode.HALF_UP));
    }

    public static BigDecimal liquidoCartao(BigDecimal valorCartao, BigDecimal taxaPercentual) {
        return arredondar(valorCartao.subtract(taxaDescontada(valorCartao, taxaPercentual)));
    }

    public static BigDecimal totalDiarias(List<FichaManobrista> manobristas) {
        return arredondar(manobristas.stream().map(FichaManobrista::getDiaria).reduce(BigDecimal.ZERO, BigDecimal::add));
    }

    public static BigDecimal totalDespesas(List<DespesaAdicional> despesas) {
        return arredondar(despesas.stream().map(DespesaAdicional::getValor).reduce(BigDecimal.ZERO, BigDecimal::add));
    }

    public static BigDecimal totalBruto(BigDecimal valorDinheiro, BigDecimal valorCartao, BigDecimal valorPix) {
        return arredondar(valorDinheiro.add(valorCartao).add(valorPix));
    }

    /** Saldo final = dinheiro + Pix + cartão líquido − diárias − despesas adicionais. */
    public static BigDecimal saldoFinal(BigDecimal valorDinheiro, BigDecimal valorCartao, BigDecimal valorPix,
                                        BigDecimal taxa,
                                        List<FichaManobrista> manobristas, List<DespesaAdicional> despesas) {
        return arredondar(valorDinheiro
                .add(valorPix)
                .add(liquidoCartao(valorCartao, taxa))
                .subtract(totalDiarias(manobristas))
                .subtract(totalDespesas(despesas)));
    }

    /** Resultado do período = lucro das fichas − despesas fixas. */
    public static BigDecimal resultado(BigDecimal lucroFichas, BigDecimal despesasFixas) {
        return arredondar(lucroFichas.subtract(despesasFixas));
    }

    public static BigDecimal parteDoSocio(BigDecimal resultado, BigDecimal percentual) {
        return arredondar(resultado.multiply(percentual).divide(CEM, 6, RoundingMode.HALF_UP));
    }
}
