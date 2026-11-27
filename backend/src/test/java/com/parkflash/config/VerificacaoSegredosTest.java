package com.parkflash.config;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class VerificacaoSegredosTest {

    @Test
    void recusaSegredoCurtoVazioOuDeDesenvolvimento() {
        assertThatThrownBy(() -> VerificacaoSegredos.exigir("JWT_SEGREDO", null)).isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> VerificacaoSegredos.exigir("JWT_SEGREDO", "curto")).isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> VerificacaoSegredos.exigir("JWT_SEGREDO", "parkflash-segredo-de-desenvolvimento-troque-em-producao"))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("desenvolvimento");
        assertThatThrownBy(() -> VerificacaoSegredos.exigir("PIX_SEGREDO", "parkflash-pix-exclusivo-para-desenvolvimento"))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void aceitaSegredoForte() {
        assertThatCode(() -> VerificacaoSegredos.exigir("JWT_SEGREDO", "Q8f2kL9xPz4nV7wR1tY6uB3mC0aS5dE8gH2jK4lM6nP9"))
                .doesNotThrowAnyException();
    }
}
