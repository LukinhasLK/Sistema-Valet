package com.parkflash.web.dto;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.List;

public final class AgendaDto {
    private AgendaDto() {}

    public enum SituacaoEvento { PLANEJADO, CONFIRMADO, REALIZADO, CANCELADO }
    public enum SituacaoEscala { PLANEJADA, CONFIRMADA, REALIZADA, CANCELADA }

    public record Evento(Long id, @NotNull @Positive Long unidadeId, @NotBlank @Size(max = 120) String nome,
                         @NotBlank @Size(max = 120) String contratante, @NotBlank @Size(max = 200) String local,
                         @NotNull LocalDateTime inicio, @NotNull LocalDateTime fim,
                         @NotNull @PositiveOrZero Integer veiculosPrevistos, @NotNull @PositiveOrZero Integer capacidade,
                         @NotNull @PositiveOrZero Integer equipePrevista, @NotBlank @Size(max = 100) String responsavel,
                         @PositiveOrZero @Digits(integer = 10, fraction = 2) BigDecimal valorContratado,
                         @PositiveOrZero @Digits(integer = 10, fraction = 2) BigDecimal despesasPrevistas,
                         @NotNull SituacaoEvento situacao, @Size(max = 1000) String observacoes) {}

    public record EscalaPedido(@NotNull @Positive Long unidadeId, @Positive Long eventoId,
                              @NotNull LocalDateTime inicio, @NotNull LocalDateTime fim,
                              @NotBlank @Size(max = 100) String responsavel, @NotNull SituacaoEscala situacao,
                              @Size(max = 1000) String observacoes,
                              @NotEmpty @Size(max = 100) List<@NotNull @Positive Long> manobristaIds) {}

    public record Escala(long id, long unidadeId, Long eventoId, LocalDateTime inicio, LocalDateTime fim,
                         String responsavel, SituacaoEscala situacao, String observacoes, List<Long> manobristaIds) {}

    public record AlteracaoEscala(long id, String ator, OffsetDateTime registradoEm, SituacaoEscala situacao,
                                 LocalDateTime inicio, LocalDateTime fim, String equipe, Long eventoId,
                                 String responsavel, String observacoes) {}
}
