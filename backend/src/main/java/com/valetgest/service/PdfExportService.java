package com.valetgest.service;

import com.itextpdf.kernel.colors.ColorConstants;
import com.itextpdf.kernel.colors.DeviceRgb;
import com.itextpdf.kernel.font.PdfFont;
import com.itextpdf.kernel.font.PdfFontFactory;
import com.itextpdf.kernel.geom.PageSize;
import com.itextpdf.kernel.pdf.PdfDocument;
import com.itextpdf.kernel.pdf.PdfWriter;
import com.itextpdf.layout.Document;
import com.itextpdf.layout.element.Cell;
import com.itextpdf.layout.element.Paragraph;
import com.itextpdf.layout.element.Table;
import com.itextpdf.layout.properties.TextAlignment;
import com.itextpdf.layout.properties.UnitValue;
import com.valetgest.controller.RelatorioController.CarrosResponse;
import com.valetgest.dto.FichaResponse;
import com.valetgest.dto.RelatorioMensalResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.text.NumberFormat;
import java.util.Locale;

/**
 * Gera o relatório mensal em PDF usando iText.
 *
 * Como funciona:
 * 1. Cria um PdfWriter (escreve em memória)
 * 2. Cria um PdfDocument
 * 3. Cria um Document (camada de abstração com elementos prontos)
 * 4. Adiciona Paragraphs, Tables, etc.
 * 5. Fecha tudo e retorna os bytes
 */
@Service
@RequiredArgsConstructor
public class PdfExportService {

    // Cores que combinam com a identidade do sistema
    private static final DeviceRgb COR_AZUL = new DeviceRgb(24, 95, 165);
    private static final DeviceRgb COR_CINZA_CLARO = new DeviceRgb(241, 239, 232);
    private static final DeviceRgb COR_VERDE = new DeviceRgb(15, 110, 86);
    private static final DeviceRgb COR_VERMELHO = new DeviceRgb(180, 30, 24);

    public byte[] gerarPdfRelatorioMensal(RelatorioMensalResponse relatorio) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();

        try (PdfWriter writer = new PdfWriter(out);
             PdfDocument pdfDoc = new PdfDocument(writer);
             Document document = new Document(pdfDoc, PageSize.A4)) {

            document.setMargins(40, 40, 40, 40);

            PdfFont fontNormal = PdfFontFactory.createFont();
            PdfFont fontBold = PdfFontFactory.createFont(
                    com.itextpdf.io.font.constants.StandardFonts.HELVETICA_BOLD);

            // Título
            Paragraph titulo = new Paragraph("Relatório Mensal — ValetGest")
                    .setFont(fontBold)
                    .setFontSize(20)
                    .setFontColor(COR_AZUL)
                    .setTextAlignment(TextAlignment.CENTER)
                    .setMarginBottom(5);
            document.add(titulo);

            Paragraph subtitulo = new Paragraph(
                    String.format("%02d/%d", relatorio.getMes(), relatorio.getAno()))
                    .setFontSize(14)
                    .setTextAlignment(TextAlignment.CENTER)
                    .setMarginBottom(20);
            document.add(subtitulo);

            // Info do cabeçalho
            document.add(new Paragraph("Unidade: " + relatorio.getUnidadeNome())
                    .setFontSize(11));
            document.add(new Paragraph(
                    "Período: " + relatorio.getInicio() + " a " + relatorio.getFim())
                    .setFontSize(11)
                    .setMarginBottom(20));

            // ===== Quadro de totalizadores =====
            document.add(new Paragraph("Resumo do mês")
                    .setFont(fontBold)
                    .setFontSize(14)
                    .setFontColor(COR_AZUL)
                    .setMarginBottom(8));

            Table totaisTable = new Table(UnitValue.createPercentArray(new float[]{6, 4}))
                    .useAllAvailableWidth();

            adicionarLinhaTabela(totaisTable, "Quantidade de fichas",
                    String.valueOf(relatorio.getQuantidadeFichas()), fontNormal, false);
            adicionarLinhaTabela(totaisTable, "Total de manobras",
                    String.valueOf(relatorio.getTotalManobras()), fontNormal, false);
            adicionarLinhaTabela(totaisTable, "Total bruto",
                    formatarMoeda(relatorio.getTotalBruto()), fontNormal, false);
            adicionarLinhaTabela(totaisTable, "Pago aos manobristas",
                    formatarMoeda(relatorio.getTotalPagoManobristas()), fontNormal, false);
            adicionarLinhaTabela(totaisTable, "Taxa de cartão",
                    formatarMoeda(relatorio.getTotalTaxaCartao()), fontNormal, false);
            adicionarLinhaTabela(totaisTable, "Despesas",
                    formatarMoeda(relatorio.getTotalDespesas()), fontNormal, false);
            boolean liquidoNegativo = relatorio.getValorLiquidoTotal() != null
                    && relatorio.getValorLiquidoTotal().compareTo(BigDecimal.ZERO) < 0;
            adicionarLinhaTabela(totaisTable, "VALOR LÍQUIDO",
                    formatarMoeda(relatorio.getValorLiquidoTotal()), fontBold, true, liquidoNegativo);

            document.add(totaisTable);
            document.add(new Paragraph(" ").setMarginBottom(10));

            // ===== Detalhamento por ficha =====
            document.add(new Paragraph("Fichas detalhadas")
                    .setFont(fontBold)
                    .setFontSize(14)
                    .setFontColor(COR_AZUL)
                    .setMarginBottom(8));

            Table fichasTable = new Table(
                    UnitValue.createPercentArray(new float[]{2, 1, 2, 2, 2, 2}))
                    .useAllAvailableWidth();

            // Cabeçalho da tabela
            String[] cabecalhos = {"Data", "Manobras", "Bruto",
                    "Manobristas", "Despesas", "Líquido"};
            for (String cab : cabecalhos) {
                fichasTable.addHeaderCell(
                        new Cell().add(new Paragraph(cab).setFont(fontBold).setFontSize(10))
                                .setBackgroundColor(COR_AZUL)
                                .setFontColor(ColorConstants.WHITE)
                                .setTextAlignment(TextAlignment.CENTER));
            }

            // Linhas de dados
            for (FichaResponse ficha : relatorio.getFichas()) {
                boolean fichaLiquidoNeg = ficha.getValorLiquido() != null
                        && ficha.getValorLiquido().compareTo(BigDecimal.ZERO) < 0;
                DeviceRgb corLiquido = fichaLiquidoNeg ? COR_VERMELHO : COR_VERDE;

                fichasTable.addCell(criarCelula(ficha.getDataFicha().toString(), fontNormal));
                fichasTable.addCell(criarCelula(
                        String.valueOf(ficha.getQuantidadeManobras()), fontNormal));
                fichasTable.addCell(criarCelula(
                        formatarMoeda(ficha.getTotalBruto()), fontNormal));
                fichasTable.addCell(criarCelula(
                        formatarMoeda(ficha.getTotalPagoManobristas()), fontNormal));
                fichasTable.addCell(criarCelula(
                        formatarMoeda(ficha.getTotalDespesas()), fontNormal));
                fichasTable.addCell(criarCelula(
                        formatarMoeda(ficha.getValorLiquido()), fontBold)
                        .setFontColor(corLiquido));
            }

            document.add(fichasTable);

            // Rodapé
            document.add(new Paragraph(" ").setMarginTop(20));
            document.add(new Paragraph("Gerado pelo sistema ValetGest")
                    .setFontSize(9)
                    .setFontColor(ColorConstants.GRAY)
                    .setTextAlignment(TextAlignment.CENTER));
        }

        return out.toByteArray();
    }

    public byte[] gerarPdfCarros(CarrosResponse dados, int ano, String unidadeNome) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();

        try (PdfWriter writer = new PdfWriter(out);
             PdfDocument pdfDoc = new PdfDocument(writer);
             Document document = new Document(pdfDoc, PageSize.A4)) {

            document.setMargins(40, 40, 40, 40);
            PdfFont fontNormal = PdfFontFactory.createFont();
            PdfFont fontBold   = PdfFontFactory.createFont(
                    com.itextpdf.io.font.constants.StandardFonts.HELVETICA_BOLD);

            // título dinâmico: se só 1 mês no resumo, mostra "Mês/Ano"
            boolean umMes = dados.getResumo().size() == 1;
            String periodo = umMes
                ? dados.getResumo().get(0).getNomeMes() + " / " + ano
                : "Ano " + ano;

            document.add(new Paragraph("Relatório de Carros")
                    .setFont(fontBold).setFontSize(20).setFontColor(COR_AZUL)
                    .setTextAlignment(TextAlignment.CENTER).setMarginBottom(5));
            document.add(new Paragraph(periodo + (unidadeNome != null ? "  |  " + unidadeNome : ""))
                    .setFontSize(12).setTextAlignment(TextAlignment.CENTER).setMarginBottom(20));

            int totalCarros = dados.getResumo().stream().mapToInt(CarrosResponse.ResumoMes::getTotalCarros).sum();
            int totalFichas = dados.getResumo().stream().mapToInt(CarrosResponse.ResumoMes::getTotalFichas).sum();
            int mediaDia    = totalFichas > 0 ? totalCarros / totalFichas : 0;

            Table totais = new Table(UnitValue.createPercentArray(new float[]{5, 5, 5})).useAllAvailableWidth();
            totais.addCell(criarCelulaDestaque("Total de carros", String.valueOf(totalCarros), fontBold));
            totais.addCell(criarCelulaDestaque("Total de fichas", String.valueOf(totalFichas), fontBold));
            totais.addCell(criarCelulaDestaque("Média por dia", String.valueOf(mediaDia), fontBold));
            document.add(totais);
            document.add(new Paragraph(" ").setMarginBottom(16));

            document.add(new Paragraph("Resumo por mês")
                    .setFont(fontBold).setFontSize(14).setFontColor(COR_AZUL).setMarginBottom(8));

            Table tabelaMes = new Table(UnitValue.createPercentArray(new float[]{4, 2, 2, 2})).useAllAvailableWidth();
            for (String cab : new String[]{"Mês", "Fichas", "Total Carros", "Média/dia"}) {
                tabelaMes.addHeaderCell(new Cell()
                        .add(new Paragraph(cab).setFont(fontBold).setFontSize(10))
                        .setBackgroundColor(COR_AZUL).setFontColor(ColorConstants.WHITE)
                        .setTextAlignment(TextAlignment.CENTER));
            }
            for (CarrosResponse.ResumoMes m : dados.getResumo()) {
                int med = m.getTotalFichas() > 0 ? m.getTotalCarros() / m.getTotalFichas() : 0;
                tabelaMes.addCell(criarCelula(m.getNomeMes(), fontNormal));
                tabelaMes.addCell(criarCelula(String.valueOf(m.getTotalFichas()), fontNormal));
                tabelaMes.addCell(criarCelula(String.valueOf(m.getTotalCarros()),
                        m.getTotalCarros() > 0 ? fontBold : fontNormal)
                        .setFontColor(m.getTotalCarros() > 0 ? COR_VERMELHO : ColorConstants.GRAY));
                tabelaMes.addCell(criarCelula(m.getTotalFichas() > 0 ? String.valueOf(med) : "—", fontNormal));
            }
            document.add(tabelaMes);

            // ── Detalhamento por ficha ──
            if (dados.getDetalhado() != null && !dados.getDetalhado().isEmpty()) {
                document.add(new Paragraph(" ").setMarginTop(16));
                document.add(new Paragraph("Detalhamento por dia")
                        .setFont(fontBold).setFontSize(14).setFontColor(COR_AZUL).setMarginBottom(8));

                boolean mostraUnidade = dados.getDetalhado().stream()
                        .map(CarrosResponse.DetalheDia::getUnidadeNome)
                        .distinct().count() > 1;

                float[] colWidths = mostraUnidade ? new float[]{3, 3, 2} : new float[]{4, 2};
                Table tabelaDet = new Table(UnitValue.createPercentArray(colWidths)).useAllAvailableWidth();

                String[] cabDet = mostraUnidade
                        ? new String[]{"Data", "Unidade", "Carros"}
                        : new String[]{"Data", "Carros"};
                for (String cab : cabDet) {
                    tabelaDet.addHeaderCell(new Cell()
                            .add(new Paragraph(cab).setFont(fontBold).setFontSize(10))
                            .setBackgroundColor(COR_AZUL).setFontColor(ColorConstants.WHITE)
                            .setTextAlignment(TextAlignment.CENTER));
                }

                java.time.format.DateTimeFormatter fmt = java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy");
                for (CarrosResponse.DetalheDia d : dados.getDetalhado()) {
                    tabelaDet.addCell(criarCelula(d.getData().format(fmt), fontNormal));
                    if (mostraUnidade) tabelaDet.addCell(criarCelula(d.getUnidadeNome(), fontNormal));
                    tabelaDet.addCell(criarCelula(String.valueOf(d.getTotalCarros()), fontBold)
                            .setFontColor(COR_VERMELHO));
                }

                // linha de total
                tabelaDet.addCell(new Cell(1, mostraUnidade ? 2 : 1)
                        .add(new Paragraph("Total").setFont(fontBold).setFontSize(9))
                        .setBackgroundColor(COR_CINZA_CLARO).setTextAlignment(TextAlignment.RIGHT));
                int totalGeral = dados.getDetalhado().stream().mapToInt(CarrosResponse.DetalheDia::getTotalCarros).sum();
                tabelaDet.addCell(criarCelula(String.valueOf(totalGeral), fontBold)
                        .setFontColor(COR_VERMELHO).setBackgroundColor(COR_CINZA_CLARO));

                document.add(tabelaDet);
            }

            document.add(new Paragraph(" ").setMarginTop(20));
            document.add(new Paragraph("Gerado pelo sistema ValetGest")
                    .setFontSize(9).setFontColor(ColorConstants.GRAY)
                    .setTextAlignment(TextAlignment.CENTER));
        }
        return out.toByteArray();
    }

    private Cell criarCelulaDestaque(String titulo, String valor, PdfFont fontBold) {
        return new Cell()
                .add(new Paragraph(titulo).setFontSize(9).setFontColor(ColorConstants.GRAY))
                .add(new Paragraph(valor).setFont(fontBold).setFontSize(14).setFontColor(COR_AZUL))
                .setTextAlignment(TextAlignment.CENTER)
                .setBackgroundColor(COR_CINZA_CLARO)
                .setPadding(8);
    }

    private void adicionarLinhaTabela(Table table, String label, String valor,
                                       PdfFont font, boolean destaque, boolean negativo) {
        Cell labelCell = new Cell()
                .add(new Paragraph(label).setFont(font).setFontSize(11));
        Cell valorCell = new Cell()
                .add(new Paragraph(valor).setFont(font).setFontSize(11))
                .setTextAlignment(TextAlignment.RIGHT);

        if (destaque) {
            labelCell.setBackgroundColor(COR_CINZA_CLARO);
            valorCell.setBackgroundColor(COR_CINZA_CLARO);
            valorCell.setFontColor(negativo ? COR_VERMELHO : COR_VERDE);
        }

        table.addCell(labelCell);
        table.addCell(valorCell);
    }

    private void adicionarLinhaTabela(Table table, String label, String valor,
                                       PdfFont font, boolean destaque) {
        adicionarLinhaTabela(table, label, valor, font, destaque, false);
    }

    private Cell criarCelula(String texto, PdfFont font) {
        return new Cell()
                .add(new Paragraph(texto).setFont(font).setFontSize(9))
                .setTextAlignment(TextAlignment.CENTER);
    }

    private String formatarMoeda(BigDecimal valor) {
        if (valor == null) return "R$ 0,00";
        NumberFormat formatter = NumberFormat.getCurrencyInstance(new Locale("pt", "BR"));
        return formatter.format(valor);
    }
}
