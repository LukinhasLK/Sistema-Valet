package com.parkflash.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Senha nova: de 10 a 72 caracteres (72 é o limite do BCrypt). */
public record TrocarSenhaRequest(@NotBlank @Size(max = 72) String senhaAtual,
                                 @NotBlank @Size(min = 10, max = 72, message = "precisa ter de 10 a 72 caracteres") String novaSenha) {
}
