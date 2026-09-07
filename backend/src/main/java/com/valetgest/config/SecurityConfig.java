package com.valetgest.config;

import com.valetgest.security.JwtAuthFilter;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

/**
 * Configuração principal de segurança.
 *
 * O que está configurado aqui:
 * - Quais rotas precisam de login e quais são públicas
 * - Como criptografar senhas (BCrypt)
 * - CORS (permitir frontend acessar a API)
 * - Não usar sessão (stateless = JWT)
 */
@Configuration
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                // Desabilita CSRF (não precisamos pra API REST com JWT)
                .csrf(AbstractHttpConfigurer::disable)

                // Habilita CORS (frontend e backend em portas/domínios diferentes)
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))

                // Não usa sessão - cada requisição é independente (JWT)
                .sessionManagement(session ->
                        session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))

                // Define quais rotas são públicas e quais precisam de login
                .authorizeHttpRequests(auth -> auth
                        // Login é público
                        .requestMatchers("/api/auth/**").permitAll()
                        // Console do H2 (só pra desenvolvimento)
                        .requestMatchers("/h2-console/**").permitAll()
                        // Qualquer outra rota: precisa estar logado
                        .anyRequest().authenticated()
                )

                // Permite o frame do H2 console funcionar
                .headers(headers -> headers.frameOptions(frame -> frame.disable()))

                // Adiciona nosso filtro JWT antes do filtro padrão de login
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    /**
     * BCrypt - algoritmo seguro de hash para senhas.
     * NUNCA armazene senha em texto puro.
     */
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public AuthenticationManager authenticationManager(
            AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }

    /**
     * Permite que o frontend (rodando em outra porta, ex: localhost:3000)
     * possa fazer chamadas para a API (em localhost:8080).
     */
    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOriginPatterns(List.of("*"));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
