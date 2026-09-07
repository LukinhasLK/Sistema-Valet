package com.valetgest.controller;

import com.valetgest.dto.LoginRequest;
import com.valetgest.dto.LoginResponse;
import com.valetgest.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * Endpoints de autenticação.
 *
 * @RestController = @Controller + @ResponseBody
 *   Significa: tudo que retornar vira JSON automaticamente.
 *
 * @RequestMapping define o prefixo da URL desse controller.
 * Aqui: todas as rotas começam com /api/auth
 */
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    /**
     * POST /api/auth/login
     *
     * @Valid faz a validação dos campos do DTO automaticamente.
     * @RequestBody pega o JSON do corpo da requisição e converte em objeto.
     */
    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest request) {
        LoginResponse response = authService.login(request);
        return ResponseEntity.ok(response);
    }
}
