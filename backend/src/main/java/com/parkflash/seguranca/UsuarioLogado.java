package com.parkflash.seguranca;

import com.parkflash.dominio.NivelAcesso;

import java.util.Set;

/** Principal guardado no SecurityContext depois de validar o JWT. */
public record UsuarioLogado(Long id, String email, NivelAcesso nivel, Set<Long> unidadeIds) {
}
