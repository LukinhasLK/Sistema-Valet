package com.valetgest.service;

import com.valetgest.dto.FichaResponse;
import com.valetgest.dto.RelatorioMensalResponse;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;

/**
 * Gera o relatório mensal em formato Excel (.xlsx).
 *
 * Usa Apache POI - biblioteca padrão do Java para Excel.
 *
 * Como funciona:
 * 1. Cria um Workbook (arquivo)
 * 2. Cria uma Sheet (aba)
 * 3. Cria Rows (linhas) e dentro delas Cells (células)
 * 4. Aplica estilos (negrito, cor, formato de moeda)
 * 5. Escreve em um ByteArrayOutputStream e retorna os bytes
 */
@Service
@RequiredArgsConstructor
public class ExcelExportService {

    public byte[] gerarExcelRelatorioMensal(RelatorioMensalResponse relatorio) throws IOException {
        try (Workbook workbook = new XSSFWorkbook();
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {

            // Estilos reutilizáveis
            CellStyle estiloTitulo = criarEstiloTitulo(workbook);
            CellStyle estiloCabecalho = criarEstiloCabecalho(workbook);
            CellStyle estiloMoeda = criarEstiloMoeda(workbook);
            CellStyle estiloMoedaNegrito = criarEstiloMoedaNegrito(workbook);
            CellStyle estiloNegrito = criarEstiloNegrito(workbook);

            // ===== Aba 1: Resumo =====
            Sheet abaResumo = workbook.createSheet("Resumo");
            criarAbaResumo(abaResumo, relatorio, estiloTitulo, estiloCabecalho,
                    estiloMoeda, estiloMoedaNegrito, estiloNegrito);

            // ===== Aba 2: Fichas detalhadas =====
            Sheet abaFichas = workbook.createSheet("Fichas detalhadas");
            criarAbaFichas(abaFichas, relatorio, estiloTitulo, estiloCabecalho,
                    estiloMoeda, estiloMoedaNegrito);

            workbook.write(out);
            return out.toByteArray();
        }
    }

    private void criarAbaResumo(Sheet aba, RelatorioMensalResponse relatorio,
                                 CellStyle titulo, CellStyle cabecalho,
                                 CellStyle moeda, CellStyle moedaNegrito,
                                 CellStyle negrito) {
        int linha = 0;

        // Título
        Row tituloRow = aba.createRow(linha++);
        Cell tituloCell = tituloRow.createCell(0);
        tituloCell.setCellValue("Relatório Mensal — " +
                String.format("%02d/%d", relatorio.getMes(), relatorio.getAno()));
        tituloCell.setCellStyle(titulo);
        aba.addMergedRegion(new org.apache.poi.ss.util.CellRangeAddress(0, 0, 0, 3));

        // Linha em branco
        linha++;

        // Info da unidade
        Row unidadeRow = aba.createRow(linha++);
        unidadeRow.createCell(0).setCellValue("Unidade:");
        unidadeRow.getCell(0).setCellStyle(negrito);
        unidadeRow.createCell(1).setCellValue(relatorio.getUnidadeNome());

        Row periodoRow = aba.createRow(linha++);
        periodoRow.createCell(0).setCellValue("Período:");
        periodoRow.getCell(0).setCellStyle(negrito);
        periodoRow.createCell(1).setCellValue(relatorio.getInicio() + " a " + relatorio.getFim());

        linha++;

        // Tabela de totalizadores
        Row cabRow = aba.createRow(linha++);
        cabRow.createCell(0).setCellValue("Indicador");
        cabRow.createCell(1).setCellValue("Valor");
        cabRow.getCell(0).setCellStyle(cabecalho);
        cabRow.getCell(1).setCellStyle(cabecalho);

        adicionarLinhaResumo(aba, linha++, "Quantidade de fichas",
                BigDecimal.valueOf(relatorio.getQuantidadeFichas()), null);
        adicionarLinhaResumo(aba, linha++, "Total de manobras",
                BigDecimal.valueOf(relatorio.getTotalManobras()), null);
        adicionarLinhaResumo(aba, linha++, "Total bruto",
                relatorio.getTotalBruto(), moeda);
        adicionarLinhaResumo(aba, linha++, "Total pago aos manobristas",
                relatorio.getTotalPagoManobristas(), moeda);
        adicionarLinhaResumo(aba, linha++, "Total taxa de cartão",
                relatorio.getTotalTaxaCartao(), moeda);
        adicionarLinhaResumo(aba, linha++, "Total despesas",
                relatorio.getTotalDespesas(), moeda);

        // Linha do líquido em destaque
        Row liquidoRow = aba.createRow(linha++);
        Cell labelLiquido = liquidoRow.createCell(0);
        labelLiquido.setCellValue("VALOR LÍQUIDO");
        labelLiquido.setCellStyle(negrito);
        Cell valorLiquido = liquidoRow.createCell(1);
        valorLiquido.setCellValue(relatorio.getValorLiquidoTotal().doubleValue());
        valorLiquido.setCellStyle(moedaNegrito);

        // Auto-ajustar colunas
        aba.setColumnWidth(0, 8000);
        aba.setColumnWidth(1, 5000);
    }

    private void criarAbaFichas(Sheet aba, RelatorioMensalResponse relatorio,
                                 CellStyle titulo, CellStyle cabecalho,
                                 CellStyle moeda, CellStyle moedaNegrito) {
        int linha = 0;

        Row tituloRow = aba.createRow(linha++);
        Cell tituloCell = tituloRow.createCell(0);
        tituloCell.setCellValue("Fichas detalhadas");
        tituloCell.setCellStyle(titulo);

        linha++;

        // Cabeçalho
        Row cabRow = aba.createRow(linha++);
        String[] colunas = {"Data", "Unidade", "Manobras", "Bruto",
                "Manobristas", "Taxa cartão", "Despesas", "Líquido"};
        for (int i = 0; i < colunas.length; i++) {
            Cell cell = cabRow.createCell(i);
            cell.setCellValue(colunas[i]);
            cell.setCellStyle(cabecalho);
        }

        // Dados
        for (FichaResponse ficha : relatorio.getFichas()) {
            Row r = aba.createRow(linha++);
            r.createCell(0).setCellValue(ficha.getDataFicha().toString());
            r.createCell(1).setCellValue(ficha.getUnidadeNome());
            r.createCell(2).setCellValue(ficha.getQuantidadeManobras());

            criarCelulaMoeda(r, 3, ficha.getTotalBruto(), moeda);
            criarCelulaMoeda(r, 4, ficha.getTotalPagoManobristas(), moeda);
            criarCelulaMoeda(r, 5, ficha.getTaxaCartao(), moeda);
            criarCelulaMoeda(r, 6, ficha.getTotalDespesas(), moeda);
            criarCelulaMoeda(r, 7, ficha.getValorLiquido(), moedaNegrito);
        }

        // Ajustar larguras
        for (int i = 0; i < colunas.length; i++) {
            aba.setColumnWidth(i, 4000);
        }
        aba.setColumnWidth(1, 6000);
    }

    private void adicionarLinhaResumo(Sheet aba, int numLinha, String label,
                                       BigDecimal valor, CellStyle estiloMoeda) {
        Row row = aba.createRow(numLinha);
        row.createCell(0).setCellValue(label);
        Cell valorCell = row.createCell(1);
        valorCell.setCellValue(valor.doubleValue());
        if (estiloMoeda != null) {
            valorCell.setCellStyle(estiloMoeda);
        }
    }

    private void criarCelulaMoeda(Row row, int coluna, BigDecimal valor, CellStyle estilo) {
        Cell cell = row.createCell(coluna);
        cell.setCellValue(valor.doubleValue());
        cell.setCellStyle(estilo);
    }

    // ===== Estilos =====

    private CellStyle criarEstiloTitulo(Workbook wb) {
        CellStyle style = wb.createCellStyle();
        Font font = wb.createFont();
        font.setBold(true);
        font.setFontHeightInPoints((short) 16);
        style.setFont(font);
        return style;
    }

    private CellStyle criarEstiloCabecalho(Workbook wb) {
        CellStyle style = wb.createCellStyle();
        Font font = wb.createFont();
        font.setBold(true);
        font.setColor(IndexedColors.WHITE.getIndex());
        style.setFont(font);
        style.setFillForegroundColor(IndexedColors.DARK_BLUE.getIndex());
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        style.setAlignment(HorizontalAlignment.CENTER);
        return style;
    }

    private CellStyle criarEstiloMoeda(Workbook wb) {
        CellStyle style = wb.createCellStyle();
        DataFormat format = wb.createDataFormat();
        style.setDataFormat(format.getFormat("\"R$ \"#,##0.00"));
        return style;
    }

    private CellStyle criarEstiloMoedaNegrito(Workbook wb) {
        CellStyle style = criarEstiloMoeda(wb);
        Font font = wb.createFont();
        font.setBold(true);
        style.setFont(font);
        return style;
    }

    private CellStyle criarEstiloNegrito(Workbook wb) {
        CellStyle style = wb.createCellStyle();
        Font font = wb.createFont();
        font.setBold(true);
        style.setFont(font);
        return style;
    }
}
