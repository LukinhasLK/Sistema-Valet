package com.valetgest.service;

import com.valetgest.dto.RelatorioMensalResponse;
import com.valetgest.entity.Despesa;
import com.valetgest.entity.Ficha;
import com.valetgest.entity.LancamentoManobrista;
import com.valetgest.entity.Manobrista;
import com.valetgest.entity.Unidade;
import com.valetgest.entity.Usuario;
import com.valetgest.enums.TipoPagamentoManobrista;
import com.valetgest.enums.TipoUsuario;
import com.valetgest.exception.NegocioException;
import com.valetgest.repository.FichaRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

/**
 * Testes do RelatorioService usando Mockito.
 *
 * Mockito serve pra "fingir" que outras classes funcionam, sem precisar
 * subir o banco. Assim o teste roda em milissegundos e foca só no service.
 *
 * @ExtendWith(MockitoExtension.class) ativa os mocks (@Mock, @InjectMocks)
 * @Mock cria um objeto falso
 * @InjectMocks cria a classe real e injeta os mocks dentro dela
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("Serviço de Relatórios")
class RelatorioServiceTest {

    @Mock
    private FichaRepository fichaRepository;

    @InjectMocks
    private RelatorioService relatorioService;

    private Usuario dono;
    private Usuario gerente;
    private Unidade unidade1;
    private Unidade unidade2;

    @BeforeEach
    void setUp() {
        unidade1 = Unidade.builder().id(1L).nome("Restaurante A").build();
        unidade2 = Unidade.builder().id(2L).nome("Restaurante B").build();

        dono = Usuario.builder()
                .id(1L).nome("Dono").tipo(TipoUsuario.DONO).build();

        gerente = Usuario.builder()
                .id(2L).nome("Gerente").tipo(TipoUsuario.GERENTE).unidade(unidade1).build();
    }

    @Test
    @DisplayName("Mês inválido deve lançar exceção")
    void mesInvalido() {
        assertThatThrownBy(() ->
                relatorioService.gerarRelatorioMensal(13, 2026, null, dono))
                .isInstanceOf(NegocioException.class)
                .hasMessage("Mês inválido");

        assertThatThrownBy(() ->
                relatorioService.gerarRelatorioMensal(0, 2026, null, dono))
                .isInstanceOf(NegocioException.class);
    }

    @Test
    @DisplayName("Dono pode pedir relatório de qualquer unidade")
    void donoPedeRelatorioPorUnidade() {
        // Arrange
        List<Ficha> fichas = List.of(
                criarFicha(LocalDate.of(2026, 4, 5), unidade1,
                        new BigDecimal("0"), new BigDecimal("500"), 30),
                criarFicha(LocalDate.of(2026, 4, 15), unidade1,
                        new BigDecimal("0"), new BigDecimal("700"), 40)
        );

        when(fichaRepository.findByUnidadeIdAndDataFichaBetweenOrderByDataFichaAsc(
                eq(1L), any(), any())).thenReturn(fichas);

        // Act
        RelatorioMensalResponse rel = relatorioService.gerarRelatorioMensal(4, 2026, 1L, dono);

        // Assert
        assertThat(rel.getQuantidadeFichas()).isEqualTo(2);
        assertThat(rel.getTotalManobras()).isEqualTo(70);
        assertThat(rel.getTotalBruto()).isEqualByComparingTo("1200.00");
        assertThat(rel.getUnidadeNome()).isEqualTo("Restaurante A");
    }

    @Test
    @DisplayName("Gerente sempre vê só sua unidade, mesmo sem passar unidadeId")
    void gerenteSoVeSuaUnidade() {
        when(fichaRepository.findByUnidadeIdAndDataFichaBetweenOrderByDataFichaAsc(
                eq(1L), any(), any())).thenReturn(new ArrayList<>());

        RelatorioMensalResponse rel = relatorioService.gerarRelatorioMensal(4, 2026, null, gerente);

        assertThat(rel.getUnidadeId()).isEqualTo(1L);
    }

    @Test
    @DisplayName("Dono sem unidadeId vê todas - resumo agrupa por unidade")
    void donoVeTodasUnidadesAgrupadas() {
        List<Ficha> fichas = List.of(
                criarFicha(LocalDate.of(2026, 4, 1), unidade1,
                        BigDecimal.ZERO, new BigDecimal("500"), 20),
                criarFicha(LocalDate.of(2026, 4, 2), unidade2,
                        BigDecimal.ZERO, new BigDecimal("300"), 15),
                criarFicha(LocalDate.of(2026, 4, 3), unidade1,
                        BigDecimal.ZERO, new BigDecimal("400"), 25)
        );

        when(fichaRepository.findByDataFichaBetweenOrderByDataFichaAsc(any(), any()))
                .thenReturn(fichas);

        RelatorioMensalResponse rel = relatorioService.gerarRelatorioMensal(4, 2026, null, dono);

        assertThat(rel.getUnidadeNome()).isEqualTo("Todas as unidades");
        assertThat(rel.getResumoPorUnidade()).hasSize(2);
        assertThat(rel.getTotalBruto()).isEqualByComparingTo("1200.00");
    }

    @Test
    @DisplayName("Valor líquido total considera todos os descontos")
    void valorLiquidoTotal() {
        Manobrista mb = Manobrista.builder().id(1L).nome("João").build();

        Ficha f = criarFicha(LocalDate.of(2026, 4, 10), unidade1,
                BigDecimal.ZERO, new BigDecimal("1000"), 50);
        f.setPorcentagemCartao(new BigDecimal("3"));
        f.setValorEmCartao(new BigDecimal("400")); // taxa = 12

        f.getLancamentos().add(LancamentoManobrista.builder()
                .ficha(f).manobrista(mb)
                .tipoPagamento(TipoPagamentoManobrista.VALOR_FIXO_POR_MANOBRA)
                .valorPago(new BigDecimal("250"))
                .build());

        f.getDespesas().add(Despesa.builder()
                .ficha(f).descricao("Gasolina").valor(new BigDecimal("80"))
                .build());

        when(fichaRepository.findByUnidadeIdAndDataFichaBetweenOrderByDataFichaAsc(
                eq(1L), any(), any())).thenReturn(List.of(f));

        RelatorioMensalResponse rel = relatorioService.gerarRelatorioMensal(4, 2026, 1L, dono);

        // 1000 - 250 - 12 - 80 = 658
        assertThat(rel.getValorLiquidoTotal()).isEqualByComparingTo("658.00");
    }

    // Helper para criar fichas de teste rapidamente
    private Ficha criarFicha(LocalDate data, Unidade unidade,
                              BigDecimal inicial, BigDecimal fim, int manobras) {
        return Ficha.builder()
                .dataFicha(data)
                .unidade(unidade)
                .valorInicial(inicial)
                .valorFinal(fim)
                .quantidadeManobras(manobras)
                .porcentagemCartao(BigDecimal.ZERO)
                .valorEmCartao(BigDecimal.ZERO)
                .lancamentos(new ArrayList<>())
                .despesas(new ArrayList<>())
                .build();
    }
}
