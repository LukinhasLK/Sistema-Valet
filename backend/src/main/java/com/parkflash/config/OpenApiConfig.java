package com.parkflash.config;

import io.swagger.v3.oas.annotations.OpenAPIDefinition;
import io.swagger.v3.oas.annotations.enums.SecuritySchemeType;
import io.swagger.v3.oas.annotations.info.Info;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.security.SecurityScheme;
import org.springframework.context.annotation.Configuration;

/** Swagger UI em /swagger-ui.html — use "Authorize" com o token de POST /api/auth/login. */
@Configuration
@OpenAPIDefinition(
        info = @Info(title = "ParkFlash API", version = "0.1.0", description = "Gestão de estacionamentos: fichas, despesas e divisão de lucro"),
        security = @SecurityRequirement(name = "bearer"))
@SecurityScheme(name = "bearer", type = SecuritySchemeType.HTTP, scheme = "bearer", bearerFormat = "JWT")
public class OpenApiConfig {
}
