package com.valetgest.security;

import com.valetgest.entity.Usuario;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.util.Date;

/**
 * Responsável por gerar e validar tokens JWT.
 *
 * Como funciona o JWT?
 * 1. Usuário faz login com email/senha
 * 2. Backend gera um token (texto criptografado com dados do usuário)
 * 3. Frontend guarda esse token e envia em todas as requisições
 *    no header: Authorization: Bearer <token>
 * 4. Backend valida o token e identifica o usuário
 *
 * Vantagem: o servidor não precisa guardar sessão (stateless).
 */
@Service
public class JwtService {

    @Value("${jwt.secret}")
    private String secret;

    @Value("${jwt.expiration}")
    private Long expiration;

    private SecretKey key;

    @PostConstruct
    public void init() {
        // Cria a chave secreta a partir da string da configuração
        this.key = Keys.hmacShaKeyFor(secret.getBytes());
    }

    /**
     * Gera um token para o usuário logado.
     */
    public String gerarToken(Usuario usuario) {
        return Jwts.builder()
                .subject(usuario.getEmail())
                .claim("id", usuario.getId())
                .claim("tipo", usuario.getTipo().name())
                .claim("nome", usuario.getNome())
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + expiration))
                .signWith(key)
                .compact();
    }

    /**
     * Extrai o email (subject) do token.
     */
    public String extrairEmail(String token) {
        return extrairClaims(token).getSubject();
    }

    public boolean tokenValido(String token) {
        try {
            extrairClaims(token);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    private Claims extrairClaims(String token) {
        return Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }
}
