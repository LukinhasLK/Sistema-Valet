package com.valetgest.dto;

import lombok.Data;

@Data
public class UsuarioRequest {
    private String nome;
    private String email;
    private String senha;
    private String tipo;
    private Long unidadeId;
}
