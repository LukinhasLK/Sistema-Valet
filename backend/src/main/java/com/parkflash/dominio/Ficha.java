package com.parkflash.dominio;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import org.hibernate.annotations.SQLRestriction;
import java.util.ArrayList;
import java.util.List;

/** Fechamento de um turno numa unidade. Os totais são calculados pelo servidor. */
@Entity
@SQLRestriction("situacao <> 'CANCELADA'")
@Table(uniqueConstraints = @UniqueConstraint(name = "uk_ficha_data_unidade_turno", columnNames = {"data", "unidade_id", "turno"}))
public class Ficha {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private LocalDate data;

    @Column(name = "unidade_id", nullable = false)
    private Long unidadeId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private Turno turno;

    @Column(name = "controle_pagamentos", nullable = false)
    private boolean controlePagamentos;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private SituacaoFicha situacao = SituacaoFicha.EM_EDICAO;

    /** TRUE enquanto a ficha vale; NULL quando cancelada, para liberar o turno (ver V20). */
    private Boolean vigente = Boolean.TRUE;

    private Long responsavelId;
    private Long fechadoPor;
    private OffsetDateTime fechadoEm;

    @Column(precision = 12, scale = 2)
    private BigDecimal valorInicialCaixa;

    @Column(precision = 12, scale = 2)
    private BigDecimal valorFinalCaixa;

    @Column(length = 500)
    private String observacoes;

    private int fichaInicio;
    private int fichaFim;
    private int fichasCanceladas;
    private int totalCarros;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal valorDinheiro;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal valorCartao;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal valorPix = BigDecimal.ZERO;

    @Column(nullable = false, precision = 5, scale = 2)
    private BigDecimal taxaMaquininha;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal totalBruto;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal totalLiquido;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "ficha_manobrista", joinColumns = @JoinColumn(name = "ficha_id"))
    @OrderColumn(name = "ordem")
    private List<FichaManobrista> manobristas = new ArrayList<>();

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "ficha_despesa", joinColumns = @JoinColumn(name = "ficha_id"))
    @OrderColumn(name = "ordem")
    private List<DespesaAdicional> despesasAdicionais = new ArrayList<>();

    public void habilitarControlePagamentos() { this.controlePagamentos = true; }

    public SituacaoFicha getSituacao() { return situacao; }

    public void mudarSituacao(SituacaoFicha situacao, Long ator, OffsetDateTime instante) {
        this.situacao = situacao;
        this.vigente = situacao == SituacaoFicha.CANCELADA ? null : Boolean.TRUE;
        this.fechadoPor = situacao == SituacaoFicha.FECHADA ? ator : null;
        this.fechadoEm = situacao == SituacaoFicha.FECHADA ? instante : null;
    }

    public Long getResponsavelId() { return responsavelId; }
    public void setResponsavelId(Long responsavelId) { this.responsavelId = responsavelId; }
    public Long getFechadoPor() { return fechadoPor; }
    public OffsetDateTime getFechadoEm() { return fechadoEm; }
    public BigDecimal getValorInicialCaixa() { return valorInicialCaixa; }
    public void setValorInicialCaixa(BigDecimal valor) { this.valorInicialCaixa = valor; }
    public BigDecimal getValorFinalCaixa() { return valorFinalCaixa; }
    public void setValorFinalCaixa(BigDecimal valor) { this.valorFinalCaixa = valor; }
    public String getObservacoes() { return observacoes; }
    public void setObservacoes(String observacoes) { this.observacoes = observacoes; }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public LocalDate getData() { return data; }
    public void setData(LocalDate data) { this.data = data; }
    public Long getUnidadeId() { return unidadeId; }
    public void setUnidadeId(Long unidadeId) { this.unidadeId = unidadeId; }
    public Turno getTurno() { return turno; }
    public void setTurno(Turno turno) { this.turno = turno; }
    public int getFichaInicio() { return fichaInicio; }
    public void setFichaInicio(int fichaInicio) { this.fichaInicio = fichaInicio; }
    public int getFichaFim() { return fichaFim; }
    public void setFichaFim(int fichaFim) { this.fichaFim = fichaFim; }
    public int getFichasCanceladas() { return fichasCanceladas; }
    public void setFichasCanceladas(int fichasCanceladas) { this.fichasCanceladas = fichasCanceladas; }
    public int getTotalCarros() { return totalCarros; }
    public void setTotalCarros(int totalCarros) { this.totalCarros = totalCarros; }
    public BigDecimal getValorDinheiro() { return valorDinheiro; }
    public void setValorDinheiro(BigDecimal valorDinheiro) { this.valorDinheiro = valorDinheiro; }
    public BigDecimal getValorCartao() { return valorCartao; }
    public void setValorCartao(BigDecimal valorCartao) { this.valorCartao = valorCartao; }
    public BigDecimal getValorPix() { return valorPix; }
    public void setValorPix(BigDecimal valorPix) { this.valorPix = valorPix; }
    public BigDecimal getTaxaMaquininha() { return taxaMaquininha; }
    public void setTaxaMaquininha(BigDecimal taxaMaquininha) { this.taxaMaquininha = taxaMaquininha; }
    public BigDecimal getTotalBruto() { return totalBruto; }
    public void setTotalBruto(BigDecimal totalBruto) { this.totalBruto = totalBruto; }
    public BigDecimal getTotalLiquido() { return totalLiquido; }
    public void setTotalLiquido(BigDecimal totalLiquido) { this.totalLiquido = totalLiquido; }
    public List<FichaManobrista> getManobristas() { return manobristas; }

    public void setManobristas(List<FichaManobrista> manobristas) {
        this.manobristas.clear();
        this.manobristas.addAll(manobristas);
    }

    public List<DespesaAdicional> getDespesasAdicionais() { return despesasAdicionais; }

    public void setDespesasAdicionais(List<DespesaAdicional> despesasAdicionais) {
        this.despesasAdicionais.clear();
        this.despesasAdicionais.addAll(despesasAdicionais);
    }
}
