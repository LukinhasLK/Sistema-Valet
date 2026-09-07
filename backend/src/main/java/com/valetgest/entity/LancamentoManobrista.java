package com.valetgest.entity;

import com.valetgest.enums.TipoPagamentoManobrista;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;

/**
 * Representa "um manobrista trabalhando em uma ficha específica".
 *
 * Por que essa tabela existe?
 * - Uma ficha tem vários manobristas
 * - Um manobrista trabalha em várias fichas
 * - E cada vez ele pode receber de um jeito diferente (você falou que depende do lugar)
 *
 * Exemplo:
 *   Ficha do dia 28/04 no Restaurante X:
 *     - João: VALOR_FIXO_POR_MANOBRA, R$ 5 por manobra, fez 20 manobras = R$ 100
 *     - Maria: PORCENTAGEM, 30% do total = R$ 150
 *     - Carlos: DIARIA_FIXA = R$ 80
 */
@Entity
@Table(name = "lancamentos_manobrista")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LancamentoManobrista {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ficha_id", nullable = false)
    private Ficha ficha;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "manobrista_id", nullable = false)
    private Manobrista manobrista;

    /**
     * Tipo de pagamento usado nesse lançamento específico.
     * Pode variar por ficha (ex: hoje foi por manobra, amanhã por porcentagem).
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "tipo_pagamento", nullable = false, length = 30)
    private TipoPagamentoManobrista tipoPagamento;

    /**
     * Quantas manobras esse manobrista fez (se aplicável).
     */
    @Column(name = "quantidade_manobras")
    private Integer quantidadeManobras;

    /**
     * Valor por manobra (se VALOR_FIXO_POR_MANOBRA).
     */
    @Column(name = "valor_por_manobra", precision = 10, scale = 2)
    private BigDecimal valorPorManobra;

    /**
     * Porcentagem (se PORCENTAGEM). Ex: 30 = 30%
     */
    @Column(precision = 5, scale = 2)
    private BigDecimal porcentagem;

    /**
     * Valor final que ele recebeu nessa ficha.
     * Esse é o valor que vai entrar no cálculo do líquido da ficha.
     */
    @Column(name = "valor_pago", nullable = false, precision = 10, scale = 2)
    private BigDecimal valorPago;
}
