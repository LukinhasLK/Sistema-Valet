package com.parkflash.web.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public final class PagamentoManobristaDto {

    private PagamentoManobristaDto() {}

    public enum Situacao { PENDENTE, PAGO, ESTORNADO }
    public enum Forma { PIX, DINHEIRO, TRANSFERENCIA, OUTRA }
    public enum TipoPix { CPF, CNPJ, TELEFONE, EMAIL, ALEATORIA }

    public record Filtro(LocalDate inicio, LocalDate fim, Long manobristaId, Long unidadeId,
                         String busca, Situacao situacao) {}

    public record Pagina<T>(List<T> itens, long total, int pagina, int tamanho) {}
    public record Candidato(long fichaId, long manobristaId, String manobrista, String unidade, long unidadeId,
                            LocalDate data, String turno, BigDecimal custo) {}
    public record Reconhecimento(@NotNull @Positive Long manobristaId,
                                 @NotNull @Positive @Digits(integer = 10, fraction = 2) BigDecimal valor,
                                 @NotNull @Positive @Digits(integer = 10, fraction = 2) BigDecimal custoConferido,
                                 @NotNull LocalDate dataConferida, @NotBlank @Size(max = 10) String turnoConferido,
                                 @NotNull @Positive Long unidadeConferida) {}

    public record Diaria(long id, long fichaId, long manobristaId, String manobrista, String unidade,
                         LocalDate data, BigDecimal custo, BigDecimal devido, BigDecimal pago, BigDecimal saldo,
                         Situacao situacao, Long pagamentoId, LocalDate dataPagamento, int revisao) {}
    public record Selecionada(@NotNull @Positive Long id, @NotNull @PositiveOrZero Integer revisao) {}

    public record Confirmacao(@NotNull UUID operacao, @NotNull @Positive Long manobristaId,
                              @NotEmpty @Size(max = 100) List<@NotNull @Valid Selecionada> diarias,
                              @NotNull LocalDate data, @NotNull Forma forma,
                              @NotNull @AssertTrue Boolean efetuado,
                              @NotNull @Positive @Digits(integer = 14, fraction = 2) BigDecimal valor) {}
    public record Estorno(@NotBlank @Size(max = 500) String motivo) {}
    public record Item(long diariaId, long fichaId, String unidade, LocalDate data, BigDecimal valor) {}
    public record Pagamento(long id, String manobrista, long manobristaId, LocalDate data, BigDecimal valor,
                            Forma forma, String confirmador, OffsetDateTime confirmadoEm, boolean temComprovante,
                            String estornador, OffsetDateTime estornadoEm, String motivoEstorno, List<Item> itens) {}

    public record PorUnidade(String unidade, BigDecimal aPagar, BigDecimal pago) {}
    public record PorMes(int ano, int mes, BigDecimal aPagar, BigDecimal pago) {}
    public record Pendencia(long manobristaId, String manobrista, long unidadeId, String unidade,
                            long diarias, BigDecimal saldo) {}
    public record Resumo(BigDecimal aPagar, BigDecimal pago, long manobristasPendentes, long pagamentos,
                         List<PorUnidade> unidades, List<PorMes> meses, List<Pendencia> pendencias) {}

    public record AlterarPix(@NotNull TipoPix tipo, String chave) {
        @Override
        public String toString() { return "AlterarPix[tipo=" + tipo + "]"; }
    }
    public record Pix(TipoPix tipo, String chaveMascarada) {}
    public record ChavePix(String chave) {
        @Override
        public String toString() { return "ChavePix[protegida]"; }
    }
}
