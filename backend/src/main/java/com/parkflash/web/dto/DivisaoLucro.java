package com.parkflash.web.dto;

import java.math.BigDecimal;
import java.util.List;

public record DivisaoLucro(Integer mes, int ano, Long unidadeId, BigDecimal resultado, List<Parte> partes, BigDecimal lucroFichas,
                           BigDecimal despesasFixas, int quantidadeFichas) {

    public record Parte(Long socioId, String nome, BigDecimal percentual, BigDecimal valor) {
    }
}
