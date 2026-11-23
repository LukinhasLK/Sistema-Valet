package com.parkflash.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.parkflash.erro.ErroApi;
import com.parkflash.repositorio.UsuarioRepository;
import com.parkflash.seguranca.FiltroJwt;
import com.parkflash.seguranca.JwtService;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.io.IOException;
import java.util.List;

/**
 * Permissões por nível — mesma regra de `permissoes.ts` no front:
 * Operador lança fichas e cadastra manobristas; Gerente cuida da operação e dos relatórios;
 * só o Proprietário mexe em sócios, usuários e divisão de lucro.
 */
@Configuration
public class SecurityConfig {

    private static final String PROPRIETARIO = "PROPRIETARIO";
    private static final String[] GESTAO = {"PROPRIETARIO", "GERENTE"};

    @Bean
    SecurityFilterChain filtros(HttpSecurity http, JwtService jwtService, UsuarioRepository usuarios, ObjectMapper json) throws Exception {
        return http
                .csrf(csrf -> csrf.disable())
                .cors(Customizer.withDefaults())
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.POST, "/api/auth/login").permitAll()
                        .requestMatchers("/swagger-ui.html", "/swagger-ui/**", "/v3/api-docs/**", "/error").permitAll()

                        .requestMatchers("/api/usuarios/**", "/api/unidades/*/auditoria", "/api/relatorios/divisao-lucro").hasRole(PROPRIETARIO)
                        .requestMatchers("/api/socios/**").hasRole(PROPRIETARIO)

                        .requestMatchers("/api/notificacoes/**", "/api/despesas/**", "/api/relatorios/**", "/api/pagamentos-manobristas/**", "/api/eventos/**", "/api/escalas/**").hasAnyRole(GESTAO)
                        .requestMatchers(HttpMethod.GET, "/api/unidades/**").authenticated()
                        .requestMatchers("/api/unidades/**").hasRole(PROPRIETARIO)
                        .requestMatchers(HttpMethod.GET, "/api/manobristas").authenticated()
                        .requestMatchers(HttpMethod.POST, "/api/manobristas").authenticated()
                        .requestMatchers("/api/manobristas/**").hasRole(PROPRIETARIO)
                        .requestMatchers(HttpMethod.PUT, "/api/fichas/**").hasAnyRole(GESTAO)
                        .requestMatchers(HttpMethod.DELETE, "/api/fichas/**").hasAnyRole(GESTAO)

                        .requestMatchers(HttpMethod.GET, "/api/auth/me", "/api/fichas", "/api/fichas/*", "/api/fichas/*/historico").authenticated()
                        .requestMatchers(HttpMethod.PUT, "/api/auth/senha").authenticated()
                        .requestMatchers(HttpMethod.POST, "/api/fichas", "/api/fichas/*/transicao").authenticated()
                        .anyRequest().denyAll())
                .exceptionHandling(e -> e
                        .authenticationEntryPoint((req, res, ex) -> erro(res, json, 401, "Faça login para continuar."))
                        .accessDeniedHandler((req, res, ex) -> erro(res, json, 403, "Seu nível de acesso não permite esta operação.")))
                .addFilterBefore(new FiltroJwt(jwtService, usuarios), UsernamePasswordAuthenticationFilter.class)
                .build();
    }

    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    CorsConfigurationSource corsConfigurationSource(ParkFlashProperties propriedades) {
        CorsConfiguration cors = new CorsConfiguration();
        cors.setAllowedOrigins(propriedades.corsOrigens());
        cors.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        cors.setAllowedHeaders(List.of("Authorization", "Content-Type"));
        UrlBasedCorsConfigurationSource fonte = new UrlBasedCorsConfigurationSource();
        fonte.registerCorsConfiguration("/api/**", cors);
        return fonte;
    }

    private static void erro(HttpServletResponse res, ObjectMapper json, int status, String mensagem) throws IOException {
        res.setStatus(status);
        res.setContentType(MediaType.APPLICATION_JSON_VALUE);
        res.setCharacterEncoding("UTF-8");
        json.writeValue(res.getOutputStream(), new ErroApi(status, mensagem));
    }
}
