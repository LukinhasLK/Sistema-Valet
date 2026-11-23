package com.parkflash.dominio;

import jakarta.persistence.*;

import java.util.ArrayList;
import java.util.List;

@Entity
public class Socio {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String nome;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "socio_participacao", joinColumns = @JoinColumn(name = "socio_id"))
    private List<ParticipacaoSocio> percentuais = new ArrayList<>();

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getNome() { return nome; }
    public void setNome(String nome) { this.nome = nome; }
    public List<ParticipacaoSocio> getPercentuais() { return percentuais; }

    public void setPercentuais(List<ParticipacaoSocio> percentuais) {
        this.percentuais.clear();
        this.percentuais.addAll(percentuais);
    }
}
