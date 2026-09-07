package com.valetgest.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * Representa uma unidade/filial onde o serviço de manobrista funciona.
 * Exemplo: "Restaurante Central", "Shopping XYZ", etc.
 */
@Entity
@Table(name = "unidades")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Unidade {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String nome;

    @Column(length = 200)
    private String endereco;

    @Column(length = 20)
    private String telefone;

    /**
     * Permite "desativar" uma unidade sem apagar do banco.
     * Útil porque o usuário disse: "depende, entra uma e sai outra"
     */
    @Column(nullable = false)
    @Builder.Default
    private Boolean ativa = true;

    @Column(name = "criado_em", nullable = false, updatable = false)
    private LocalDateTime criadoEm;

    @PrePersist
    protected void onCreate() {
        criadoEm = LocalDateTime.now();
    }
}
