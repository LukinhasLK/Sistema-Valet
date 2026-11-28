package com.parkflash.web.dto;

import java.math.BigDecimal;

/**
 * Fechamento do período: lucro das fichas − despesas fixas = resultado.
 * `mes` e `unidadeId` nulos significam "ano inteiro" e "todas as unidades".
 */
public record ResumoPeriodo(Integer mes, int ano, Long unidadeId, int quantidadeFichas, int totalCarros,
                            BigDecimal totalBruto, BigDecimal lucroFichas, BigDecimal despesasFixas, BigDecimal resultado) {
}
