package com.parkflash.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;

/**
 * Em produção (perfil "postgres"), o sistema se recusa a subir com segredo fraco ou com o
 * valor de desenvolvimento que está no repositório. Sem isso, um JWT_SEGREDO conhecido
 * permitiria forjar o login de qualquer usuário, e um PIX_SEGREDO curto desligaria as
 * chaves Pix sem aviso.
 */
@Component
public class VerificacaoSegredos {

    static final int MINIMO = 32;

    public VerificacaoSegredos(Environment ambiente, ParkFlashProperties propriedades,
                               @Value("${parkflash.pix-segredo:}") String pixSegredo) {
        if (!ambiente.acceptsProfiles(Profiles.of("postgres"))) return;
        exigir("JWT_SEGREDO", propriedades.jwt().segredo());
        exigir("PIX_SEGREDO", pixSegredo);
    }

    static void exigir(String nome, String valor) {
        if (valor == null || valor.getBytes(StandardCharsets.UTF_8).length < MINIMO) {
            throw new IllegalStateException(nome + " precisa ter pelo menos " + MINIMO + " caracteres em produção.");
        }
        if (valor.contains("desenvolvimento")) {
            throw new IllegalStateException(nome + " está com o valor de desenvolvimento. Gere um segredo próprio.");
        }
    }
}
