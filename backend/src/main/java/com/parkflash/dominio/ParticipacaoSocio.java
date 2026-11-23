package com.parkflash.dominio;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

import java.math.BigDecimal;

/** Percentual de um sócio numa unidade. */
@Embeddable
public class ParticipacaoSocio {

    @Column(name = "unidade_id", nullable = false)
    private Long unidadeId;

    @Column(nullable = false, precision = 5, scale = 2)
    private BigDecimal percentual;

    protected ParticipacaoSocio() {
    }

    public ParticipacaoSocio(Long unidadeId, BigDecimal percentual) {
        this.unidadeId = unidadeId;
        this.percentual = percentual;
    }

    public Long getUnidadeId() { return unidadeId; }
    public BigDecimal getPercentual() { return percentual; }
}
