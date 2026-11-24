package com.parkflash.dominio;

import jakarta.persistence.*;

import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

@Entity
public class Usuario {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String nome;

    @Column(nullable = false, unique = true, length = 150)
    private String email;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private NivelAcesso nivel;

    /** Hash BCrypt — a senha em texto nunca é guardada nem devolvida pela API. */
    @Column(name = "senha_hash", nullable = false, length = 100)
    private String senhaHash;

    @Column(nullable = false)
    private boolean ativo = true;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "usuario_unidade", joinColumns = @JoinColumn(name = "usuario_id"))
    @Column(name = "unidade_id", nullable = false)
    private Set<Long> unidadeIds = new HashSet<>();

    @Column(nullable = false, length = 36)
    private String sessaoVersao = "0";

    /** Sócio que este login representa (só no nível Sócio). */
    @Column(name = "socio_id")
    private Long socioId;

    public Long getSocioId() { return socioId; }
    public void setSocioId(Long socioId) { this.socioId = socioId; }

    public String getSessaoVersao() { return sessaoVersao; }

    public boolean isAtivo() { return ativo; }
    public void desativar() { this.ativo = false; }
    public Set<Long> getUnidadeIds() { return Set.copyOf(unidadeIds); }
    public void definirUnidades(Set<Long> unidadeIds) {
        this.unidadeIds.clear();
        this.unidadeIds.addAll(unidadeIds);
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getNome() { return nome; }
    public void setNome(String nome) { this.nome = nome; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public NivelAcesso getNivel() { return nivel; }
    public void setNivel(NivelAcesso nivel) { this.nivel = nivel; }
    public String getSenhaHash() { return senhaHash; }
    public void setSenhaHash(String senhaHash) {
        this.senhaHash = senhaHash;
        this.sessaoVersao = UUID.randomUUID().toString();
    }
}
