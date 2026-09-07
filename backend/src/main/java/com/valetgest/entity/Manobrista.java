package com.valetgest.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * Cadastro dos manobristas (funcionários que trabalham nas fichas).
 * Cada manobrista pode trabalhar em qualquer unidade.
 */
@Entity
@Table(name = "manobristas")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Manobrista {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String nome;

    @Column(length = 14)
    private String cpf;

    @Column(length = 20)
    private String telefone;

    @Column(nullable = false)
    @Builder.Default
    private Boolean ativo = true;

    @Column(name = "criado_em", nullable = false, updatable = false)
    private LocalDateTime criadoEm;

    @PrePersist
    protected void onCreate() {
        criadoEm = LocalDateTime.now();
    }
}
