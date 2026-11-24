package com.parkflash.servico;

import com.parkflash.dominio.Turno;
import com.parkflash.web.dto.RelatorioFinanceiro;
import com.parkflash.web.dto.ResumoPeriodo;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class RelatorioCarrosTest {

    private static RelatorioFinanceiro.Linha ficha(String data, Turno turno, String unidade, int carros) {
        var z = BigDecimal.ZERO;
        return new RelatorioFinanceiro.Linha(1, LocalDate.parse(data), turno, unidade, carros, z, z, z, z, z, z);
    }

    private static RelatorioFinanceiro relatorio(LocalDate inicio, LocalDate fim, List<RelatorioFinanceiro.Linha> linhas) {
        int carros = linhas.stream().mapToInt(RelatorioFinanceiro.Linha::veiculos).sum();
        var z = BigDecimal.ZERO;
        return new RelatorioFinanceiro(new ResumoPeriodo(inicio.getMonthValue(), inicio.getYear(), null, linhas.size(), carros, z, z, z, z),
                inicio, fim, "Todas as unidades", z, linhas);
    }

    @Test
    void somaDiaENoiteDoMesmoDiaPorUnidadeEmOrdemDeData() {
        var r = relatorio(LocalDate.of(2026, 11, 1), LocalDate.of(2026, 11, 30), List.of(
                ficha("2026-11-24", Turno.DIA, "Centro", 30), ficha("2026-11-24", Turno.NOITE, "Centro", 12),
                ficha("2026-11-03", Turno.DIA, "Arena", 7), ficha("2026-11-24", Turno.DIA, "Arena", 5)));
        assertThat(r.mesUnico()).isTrue();
        assertThat(r.carrosPorDia()).containsExactly(
                new RelatorioFinanceiro.Dia(LocalDate.of(2026, 11, 3), "Arena", 1, 7),
                new RelatorioFinanceiro.Dia(LocalDate.of(2026, 11, 24), "Arena", 1, 5),
                new RelatorioFinanceiro.Dia(LocalDate.of(2026, 11, 24), "Centro", 2, 42));
    }

    @Test
    void pdfDoMesListaCadaDiaComTotal() throws Exception {
        var r = relatorio(LocalDate.of(2026, 11, 1), LocalDate.of(2026, 11, 30), List.of(
                ficha("2026-11-24", Turno.DIA, "Centro", 30), ficha("2026-11-24", Turno.NOITE, "Centro", 12),
                ficha("2026-11-25", Turno.DIA, "Centro", 8)));
        String texto;
        try (var pdf = Loader.loadPDF(new RelatorioPdf().carros(r))) {
            texto = new PDFTextStripper().getText(pdf);
        }
        assertThat(texto).contains("Carros por dia", "Novembro de 2026", "24/11/2026", "25/11/2026", "Total do mês",
                "Total de carros  50", "Dias com movimento  2", "Média por dia  25");
    }

    @Test
    void anoInteiroContinuaPorMes() throws Exception {
        var r = relatorio(LocalDate.of(2026, 1, 1), LocalDate.of(2026, 12, 31), List.of(ficha("2026-06-07", Turno.DIA, "Centro", 21)));
        assertThat(r.mesUnico()).isFalse();
        String texto;
        try (var pdf = Loader.loadPDF(new RelatorioPdf().carros(r))) {
            texto = new PDFTextStripper().getText(pdf);
        }
        assertThat(texto).contains("Carros por mês", "junho").doesNotContain("Total do mês");
    }
}
