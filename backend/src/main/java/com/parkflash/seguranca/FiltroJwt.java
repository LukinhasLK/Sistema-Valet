package com.parkflash.seguranca;

import com.parkflash.dominio.Usuario;
import com.parkflash.repositorio.UsuarioRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

/**
 * Lê `Authorization: Bearer <token>` e autentica a requisição. O usuário é recarregado do
 * banco para que exclusão ou mudança de nível valham na hora, sem esperar o token expirar.
 */

public class FiltroJwt extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final UsuarioRepository usuarios;

    public FiltroJwt(JwtService jwtService, UsuarioRepository usuarios) {
        this.jwtService = jwtService;
        this.usuarios = usuarios;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String cabecalho = request.getHeader(HttpHeaders.AUTHORIZATION);

        if (cabecalho != null && cabecalho.startsWith("Bearer ")) {
            jwtService.validar(cabecalho.substring(7))
                    .flatMap(sessao -> usuarios.findById(sessao.usuarioId())
                            .filter(usuario -> sessao.versao().equals(usuario.getSessaoVersao())))
                    .filter(Usuario::isAtivo)
                    .ifPresent(usuario -> {
                        var principal = new UsuarioLogado(usuario.getId(), usuario.getEmail(), usuario.getNivel(), usuario.getUnidadeIds());
                        var autoridades = List.of(new SimpleGrantedAuthority("ROLE_" + usuario.getNivel().name()));
                        SecurityContextHolder.getContext()
                                .setAuthentication(new UsernamePasswordAuthenticationToken(principal, null, autoridades));
                    });
        }

        chain.doFilter(request, response);
    }
}
