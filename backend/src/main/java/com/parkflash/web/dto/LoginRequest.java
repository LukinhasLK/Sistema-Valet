package com.parkflash.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** @param identificador e-mail ou nome do usuário. */
public record LoginRequest(@NotBlank @Size(max = 150) String identificador, @NotBlank @Size(max = 72) String senha) {
}
