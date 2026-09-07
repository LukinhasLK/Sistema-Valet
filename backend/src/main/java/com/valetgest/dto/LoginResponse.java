package com.valetgest.dto;

import com.valetgest.enums.TipoUsuario;
import lombok.AllArgsConstructor;
import lombok.Data;

/**
 * Resposta enviada ao frontend depois do login bem-sucedido.
 * O frontend guarda o token e usa ele em todas as próximas requisições.
 */
@Data
@AllArgsConstructor
public class LoginResponse {
    private Long id;
    private String token;
    private String nome;
    private String email;
    private TipoUsuario tipo;
    private Long unidadeId;
    private String unidadeNome;
}
