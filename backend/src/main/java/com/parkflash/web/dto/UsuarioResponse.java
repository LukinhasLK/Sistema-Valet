package com.parkflash.web.dto;

import com.parkflash.dominio.NivelAcesso;
import com.parkflash.dominio.Usuario;

import java.util.Set;

/** Usuário sem a senha — o hash nunca sai do servidor. */
public record UsuarioResponse(Long id, String nome, String email, NivelAcesso nivel, Set<Long> unidadeIds, boolean ativo, Long socioId) {

    public static UsuarioResponse de(Usuario u) {
        return new UsuarioResponse(u.getId(), u.getNome(), u.getEmail(), u.getNivel(), u.getUnidadeIds(), u.isAtivo(), u.getSocioId());
    }
}
