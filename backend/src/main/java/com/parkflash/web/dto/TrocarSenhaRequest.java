package com.parkflash.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record TrocarSenhaRequest(@NotBlank String senhaAtual, @NotBlank @Size(min = 6, message = "precisa ter pelo menos 6 caracteres") String novaSenha) {
}
