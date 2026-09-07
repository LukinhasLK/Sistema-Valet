package com.valetgest.service;

import com.valetgest.dto.LoginRequest;
import com.valetgest.dto.LoginResponse;
import com.valetgest.entity.Usuario;
import com.valetgest.exception.NegocioException;
import com.valetgest.repository.UsuarioRepository;
import com.valetgest.security.JwtService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

/**
 * Service = onde fica a regra de negócio.
 *
 * Convenção: Controller chama Service, Service chama Repository.
 * O Controller é "burro" - só recebe e responde.
 * O Service é "inteligente" - tem as decisões.
 */
@Service
@RequiredArgsConstructor // Lombok cria construtor com os campos final
public class AuthService {

    private final UsuarioRepository usuarioRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public LoginResponse login(LoginRequest request) {
        Usuario usuario = usuarioRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new NegocioException("Email ou senha inválidos"));

        if (!usuario.getAtivo()) {
            throw new NegocioException("Usuário inativo");
        }

        // Compara a senha enviada com o hash armazenado
        if (!passwordEncoder.matches(request.getSenha(), usuario.getSenha())) {
            throw new NegocioException("Email ou senha inválidos");
        }

        String token = jwtService.gerarToken(usuario);

        return new LoginResponse(
                usuario.getId(),
                token,
                usuario.getNome(),
                usuario.getEmail(),
                usuario.getTipo(),
                usuario.getUnidade() != null ? usuario.getUnidade().getId() : null,
                usuario.getUnidade() != null ? usuario.getUnidade().getNome() : null
        );
    }
}
