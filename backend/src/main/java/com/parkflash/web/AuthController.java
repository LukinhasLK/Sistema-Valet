package com.parkflash.web;

import com.parkflash.seguranca.UsuarioLogado;
import com.parkflash.servico.AuthService;
import com.parkflash.web.dto.LoginRequest;
import com.parkflash.web.dto.LoginResponse;
import com.parkflash.web.dto.TrocarSenhaRequest;
import com.parkflash.web.dto.UsuarioResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@Tag(name = "Autenticação")
public class AuthController {

    private final AuthService auth;

    public AuthController(AuthService auth) {
        this.auth = auth;
    }

    @PostMapping("/login")
    @Operation(summary = "Login com e-mail (ou nome) e senha; devolve o token JWT")
    public LoginResponse login(@Valid @RequestBody LoginRequest pedido) {
        return auth.login(pedido);
    }

    @GetMapping("/me")
    @Operation(summary = "Usuário dono do token")
    public UsuarioResponse me(@AuthenticationPrincipal UsuarioLogado usuario) {
        return auth.atual(usuario.id());
    }

    @PutMapping("/senha")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Troca a senha do usuário logado")
    public void trocarSenha(@AuthenticationPrincipal UsuarioLogado usuario, @Valid @RequestBody TrocarSenhaRequest pedido) {
        auth.trocarSenha(usuario.id(), pedido);
    }
}
