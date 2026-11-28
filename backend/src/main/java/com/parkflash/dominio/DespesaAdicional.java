package com.parkflash.dominio;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

import java.math.BigDecimal;

/** Despesa lançada dentro da ficha (custo do dia), diferente da despesa fixa. */
@Embeddable
public class DespesaAdicional {

    @Column(nullable = false, length = 200)
    private String descricao;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal valor;

    protected DespesaAdicional() {
    }

    public DespesaAdicional(String descricao, BigDecimal valor) {
        this.descricao = descricao;
        this.valor = valor;
    }

    public String getDescricao() { return descricao; }
    public BigDecimal getValor() { return valor; }
}
