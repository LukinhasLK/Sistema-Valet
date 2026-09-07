package com.valetgest.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;

@Entity
@Table(name = "socio_unidades",
       uniqueConstraints = @UniqueConstraint(columnNames = {"socio_id", "unidade_id"}))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class SocioUnidade {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "socio_id", nullable = false)
    private Socio socio;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "unidade_id", nullable = false)
    private Unidade unidade;

    @Column(nullable = false, precision = 5, scale = 2)
    private BigDecimal porcentagem;
}
