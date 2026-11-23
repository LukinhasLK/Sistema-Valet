package com.parkflash.web.dto;

import jakarta.validation.constraints.NotBlank;

/** @param identificador e-mail ou nome do usuário. */
public record LoginRequest(@NotBlank String identificador, @NotBlank String senha) {
}
