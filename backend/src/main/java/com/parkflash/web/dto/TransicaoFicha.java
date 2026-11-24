package com.parkflash.web.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.OffsetDateTime;

/**
 * @param assinatura só no FECHAR: imagem PNG da assinatura desenhada na tela, como data URL
 *                   ("data:image/png;base64,..."). Registro interno de quem conferiu, sem valor de assinatura digital.
 */
public record TransicaoFicha(@NotNull Acao acao, @Size(max = 500) String justificativa,
                             @Size(max = 400_000, message = "assinatura grande demais") String assinatura) {
    public enum Acao { ENVIAR, FECHAR, DEVOLVER, REABRIR }

    public record Registro(String acao, String ator, String justificativa, OffsetDateTime registradoEm) {
    }
}
