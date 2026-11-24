package com.parkflash.web.dto;

import java.math.BigDecimal;
import java.util.List;

/**
 * @param unidadeId null = todas as unidades (cada uma dividida pelo seu rateio, partes somadas por sócio)
 * @param unidadesSemRateio unidades com resultado no mês cujo rateio não soma 100% (ficam de fora da soma das partes)
 */
public record DivisaoLucro(Integer mes, int ano, Long unidadeId, BigDecimal resultado, List<Parte> partes, BigDecimal lucroFichas,
                           BigDecimal despesasFixas, int quantidadeFichas, List<String> unidadesSemRateio) {

    public record Parte(Long socioId, String nome, BigDecimal percentual, BigDecimal valor) {
    }
}
