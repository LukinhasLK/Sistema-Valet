package com.valetgest.dto;

import com.valetgest.entity.Usuario;
import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class UsuarioResponse {
    private Long id;
    private String nome;
    private String email;
    private String tipo;
    private Long unidadeId;
    private String unidadeNome;

    public static UsuarioResponse from(Usuario u) {
        return new UsuarioResponse(
            u.getId(),
            u.getNome(),
            u.getEmail(),
            u.getTipo().name(),
            u.getUnidade() != null ? u.getUnidade().getId() : null,
            u.getUnidade() != null ? u.getUnidade().getNome() : null
        );
    }
}
