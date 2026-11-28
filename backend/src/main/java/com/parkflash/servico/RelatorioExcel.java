package com.parkflash.servico;

import com.parkflash.web.dto.RelatorioFinanceiro;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Component;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.time.format.DateTimeFormatter;

@Component
public class RelatorioExcel {

    private static final DateTimeFormatter DATA = DateTimeFormatter.ofPattern("dd/MM/uuuu");

    public byte[] gerar(RelatorioFinanceiro relatorio) throws IOException {
        try (var arquivo = new XSSFWorkbook(); var bytes = new ByteArrayOutputStream()) {
            var moeda = arquivo.createCellStyle();
            moeda.setDataFormat(arquivo.createDataFormat().getFormat("\"R$\" #,##0.00"));
            var cabecalho = arquivo.createCellStyle();
            var fonte = arquivo.createFont();
            fonte.setBold(true);
            cabecalho.setFont(fonte);

            var resumo = relatorio.resumo();
            var indicadores = arquivo.createSheet("Resumo");
            indicadores.setColumnWidth(0, 30 * 256);
            indicadores.setColumnWidth(1, 36 * 256);
            texto(indicadores.createRow(0), 0, "Relatório financeiro", cabecalho);
            texto(indicadores.createRow(1), 0, "Período", null);
            texto(indicadores.getRow(1), 1, DATA.format(relatorio.inicio()) + " a " + DATA.format(relatorio.fim()), null);
            texto(indicadores.createRow(2), 0, "Unidade", null);
            texto(indicadores.getRow(2), 1, relatorio.unidade(), null);
            indicador(indicadores, 4, "Receita total", resumo.totalBruto(), moeda);
            indicador(indicadores, 5, "Custos das fichas", relatorio.custosFichas(), moeda);
            indicador(indicadores, 6, "Lucro das fichas", resumo.lucroFichas(), moeda);
            indicador(indicadores, 7, "Despesas fixas", resumo.despesasFixas(), moeda);
            indicador(indicadores, 8, "Resultado do período", resumo.resultado(), moeda);
            indicador(indicadores, 9, "Fichas", BigDecimal.valueOf(resumo.quantidadeFichas()), null);
            indicador(indicadores, 10, "Veículos", BigDecimal.valueOf(resumo.totalCarros()), null);

            var fichas = arquivo.createSheet("Fichas");
            fichas.createFreezePane(0, 1);
            var colunas = new String[]{"Data", "Turno", "Unidade", "Veículos", "Dinheiro", "Cartão", "Pix", "Receita", "Custos", "Saldo"};
            var titulos = fichas.createRow(0);
            for (int i = 0; i < colunas.length; i++) {
                texto(titulos, i, colunas[i], cabecalho);
                fichas.setColumnWidth(i, (i == 2 ? 32 : 17) * 256);
            }
            int indice = 1;
            for (var ficha : relatorio.linhas()) {
                var linha = fichas.createRow(indice++);
                texto(linha, 0, DATA.format(ficha.data()), null);
                texto(linha, 1, ficha.turno().getRotulo(), null);
                texto(linha, 2, ficha.unidade(), null);
                linha.createCell(3).setCellValue(ficha.veiculos());
                valor(linha, 4, ficha.dinheiro(), moeda);
                valor(linha, 5, ficha.cartao(), moeda);
                valor(linha, 6, ficha.pix(), moeda);
                valor(linha, 7, ficha.bruto(), moeda);
                valor(linha, 8, ficha.custos(), moeda);
                valor(linha, 9, ficha.liquido(), moeda);
            }
            var unidades = arquivo.createSheet("Fichas por unidade");
            var cab = unidades.createRow(0);
            var campos = new String[]{"Unidade", "Fichas", "Carros", "Receita", "Custos das fichas", "Líquido das fichas"};
            for (int i = 0; i < campos.length; i++) {
                texto(cab, i, campos[i], cabecalho);
                unidades.setColumnWidth(i, (i == 0 ? 32 : 20) * 256);
            }
            unidades.createFreezePane(0, 1);
            int numeroLinha = 1;
            for (var subtotal : relatorio.subtotaisDasFichas()) {
                var linha = unidades.createRow(numeroLinha++);
                texto(linha, 0, subtotal.unidade(), null);
                linha.createCell(1).setCellValue(subtotal.fichas());
                linha.createCell(2).setCellValue(subtotal.carros());
                valor(linha, 3, subtotal.bruto(), moeda);
                valor(linha, 4, subtotal.bruto().subtract(subtotal.liquido()), moeda);
                valor(linha, 5, subtotal.liquido(), moeda);
            }
            arquivo.write(bytes);
            return bytes.toByteArray();
        }
    }

    public byte[] carros(RelatorioFinanceiro relatorio) throws IOException {
        try (var arquivo = new XSSFWorkbook(); var bytes = new ByteArrayOutputStream()) {
            var aba = arquivo.createSheet("Carros por mês");
            var moeda = arquivo.createCellStyle();
            moeda.setDataFormat(arquivo.createDataFormat().getFormat("\"R$\" #,##0.00"));
            texto(aba.createRow(0), 0, relatorio.unidade(), null);
            texto(aba.createRow(1), 0, DATA.format(relatorio.inicio()) + " a " + DATA.format(relatorio.fim()), null);
            var titulos = aba.createRow(3);
            var colunas = new String[]{"Mês", "Fichas", "Carros", "Total bruto", "Total líquido"};
            for (int i = 0; i < colunas.length; i++) {
                texto(titulos, i, colunas[i], null);
                aba.setColumnWidth(i, (i == 0 ? 34 : 19) * 256);
            }
            aba.createFreezePane(0, 4);
            int indice = 4;
            for (var mes : relatorio.mesesComMovimento()) {
                var linha = aba.createRow(indice++);
                texto(linha, 0, mes.mes().getDisplayName(java.time.format.TextStyle.FULL, java.util.Locale.forLanguageTag("pt-BR")), null);
                linha.createCell(1).setCellValue(mes.fichas());
                linha.createCell(2).setCellValue(mes.carros());
                valor(linha, 3, mes.bruto(), moeda);
                valor(linha, 4, mes.liquido(), moeda);
            }
            var total = aba.createRow(indice);
            texto(total, 0, "Total do período", null);
            total.createCell(1).setCellValue(relatorio.resumo().quantidadeFichas());
            total.createCell(2).setCellValue(relatorio.resumo().totalCarros());
            valor(total, 3, relatorio.resumo().totalBruto(), moeda);
            valor(total, 4, relatorio.resumo().lucroFichas(), moeda);
            if (relatorio.mesUnico()) {
                // Mês escolhido: aba com cada dia e a quantidade de carros.
                var dias = arquivo.createSheet("Carros por dia");
                var cabecalho = dias.createRow(0);
                var nomes = new String[]{"Data", "Dia", "Unidade", "Fichas", "Carros"};
                for (int i = 0; i < nomes.length; i++) {
                    texto(cabecalho, i, nomes[i], null);
                    dias.setColumnWidth(i, (i == 2 ? 30 : 14) * 256);
                }
                dias.createFreezePane(0, 1);
                int linhaDia = 1;
                long soma = 0;
                var br = java.util.Locale.forLanguageTag("pt-BR");
                for (var dia : relatorio.carrosPorDia()) {
                    var linha = dias.createRow(linhaDia++);
                    texto(linha, 0, DATA.format(dia.data()), null);
                    texto(linha, 1, dia.data().getDayOfWeek().getDisplayName(java.time.format.TextStyle.SHORT, br).replace(".", ""), null);
                    texto(linha, 2, dia.unidade(), null);
                    linha.createCell(3).setCellValue(dia.fichas());
                    linha.createCell(4).setCellValue(dia.carros());
                    soma += dia.carros();
                }
                var totalDias = dias.createRow(linhaDia);
                texto(totalDias, 0, "Total do mês", null);
                totalDias.createCell(3).setCellValue(relatorio.resumo().quantidadeFichas());
                totalDias.createCell(4).setCellValue(soma);
            }
            arquivo.write(bytes);
            return bytes.toByteArray();
        }
    }

    private static void indicador(Sheet aba, int indice, String rotulo, BigDecimal numero, CellStyle estilo) {
        Row linha = aba.createRow(indice);
        texto(linha, 0, rotulo, null);
        valor(linha, 1, numero, estilo);
    }

    private static void texto(Row linha, int coluna, String texto, CellStyle estilo) {
        Cell celula = linha.createCell(coluna);
        celula.setCellValue(texto);
        if (estilo != null) celula.setCellStyle(estilo);
    }

    private static void valor(Row linha, int coluna, BigDecimal numero, CellStyle estilo) {
        Cell celula = linha.createCell(coluna);
        celula.setCellValue(numero.doubleValue());
        if (estilo != null) celula.setCellStyle(estilo);
    }
}
