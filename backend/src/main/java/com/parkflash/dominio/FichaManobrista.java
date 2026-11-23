package com.parkflash.dominio;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;

import java.math.BigDecimal;

@Embeddable
public class FichaManobrista {

    @Column(name = "manobrista_id", nullable = false)
    private Long manobristaId;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal diaria;

    @Enumerated(EnumType.STRING)
    @Column(name = "modalidade_custo", nullable = false, length = 32)
    private ModalidadeCusto modalidade;

    protected FichaManobrista() {
    }

    public FichaManobrista(Long manobristaId, BigDecimal diaria) {
        this(manobristaId, diaria, ModalidadeCusto.DIARIA_FIXA);
    }

    public FichaManobrista(Long manobristaId, BigDecimal diaria, ModalidadeCusto modalidade) {
        this.modalidade = modalidade;
        this.manobristaId = manobristaId;
        this.diaria = diaria;
    }

    public Long getManobristaId() { return manobristaId; }
    public BigDecimal getDiaria() { return diaria; }
    public ModalidadeCusto getModalidade() { return modalidade; }
}
