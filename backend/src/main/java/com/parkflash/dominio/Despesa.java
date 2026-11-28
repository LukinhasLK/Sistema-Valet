package com.parkflash.dominio;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.LocalDate;

/** Despesa fixa da unidade (aluguel, seguro...), descontada do resultado do período. */
@Entity
public class Despesa {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private LocalDate data;

    @Column(name = "unidade_id", nullable = false)
    private Long unidadeId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private CategoriaDespesa categoria;

    @Column(nullable = false, length = 200)
    private String descricao;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal valor;

    @Column(nullable = false)
    private boolean cancelada;

    public boolean isCancelada() { return cancelada; }
    public void cancelar() { this.cancelada = true; }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public LocalDate getData() { return data; }
    public void setData(LocalDate data) { this.data = data; }
    public Long getUnidadeId() { return unidadeId; }
    public void setUnidadeId(Long unidadeId) { this.unidadeId = unidadeId; }
    public CategoriaDespesa getCategoria() { return categoria; }
    public void setCategoria(CategoriaDespesa categoria) { this.categoria = categoria; }
    public String getDescricao() { return descricao; }
    public void setDescricao(String descricao) { this.descricao = descricao; }
    public BigDecimal getValor() { return valor; }
    public void setValor(BigDecimal valor) { this.valor = valor; }
}
