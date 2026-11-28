package com.parkflash.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;
import java.util.List;

/** Configurações em `parkflash.*` (application.yml ou variáveis de ambiente). */
@ConfigurationProperties(prefix = "parkflash")
public record ParkFlashProperties(Jwt jwt, List<String> corsOrigens, AdminInicial adminInicial) {

    /** @param segredo chave HMAC com pelo menos 32 caracteres. */
    public record Jwt(String segredo, Duration expiracao) {
    }

    /** Proprietário criado na inicialização quando o banco não tem nenhum usuário. */
    public record AdminInicial(String nome, String email, String senha) {
    }
}
