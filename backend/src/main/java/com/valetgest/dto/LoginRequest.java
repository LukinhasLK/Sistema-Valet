package com.valetgest.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/**
 * DTO = Data Transfer Object.
 *
 * É um objeto "transportador" - serve só para receber/enviar dados pela API.
 * Por que não usar a entidade direto?
 * - Segurança: não queremos expor a senha hash, IDs internos, etc.
 * - Validação: aqui colocamos as regras do que o usuário pode mandar
 * - Flexibilidade: a API pode mudar sem afetar a estrutura do banco
 */
@Data
public class LoginRequest {

    @NotBlank(message = "Email é obrigatório")
    @Email(message = "Email inválido")
    private String email;

    @NotBlank(message = "Senha é obrigatória")
    private String senha;
}
