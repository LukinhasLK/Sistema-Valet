package com.parkflash.servico;

import com.parkflash.dominio.Turno;
import com.parkflash.web.dto.RelatorioFinanceiro;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.springframework.stereotype.Component;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.Charset;
import java.text.NumberFormat;
import java.time.format.DateTimeFormatter;
import java.time.format.TextStyle;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@Component
public class RelatorioPdf {

    private static final Locale BR = Locale.forLanguageTag("pt-BR");
    private static final Charset WIN_ANSI = Charset.forName("windows-1252");
    private static final DateTimeFormatter DATA = DateTimeFormatter.ofPattern("dd/MM/uuuu", BR);
    private static final PDRectangle PAISAGEM = new PDRectangle(PDRectangle.A4.getHeight(), PDRectangle.A4.getWidth());
    private static final Color MARINHO = new Color(26, 43, 65);
    private static final Color CABECALHO = new Color(225, 233, 242);
    private static final Color LINHA_ALTERNADA = new Color(243, 246, 249);
    private static final float MARGEM = 32;
    private static final float ALTURA_LINHA = 17;
    private static final int LINHAS_POR_PAGINA = 24;

    public byte[] financeiro(RelatorioFinanceiro relatorio) throws IOException {
        var moeda = NumberFormat.getCurrencyInstance(BR);
        var resumo = relatorio.resumo();
        var linhas = new ArrayList<>(relatorio.linhas().stream().map(linha -> List.of(
                DATA.format(linha.data()), linha.unidade(), linha.turno() == Turno.DIA ? "Dia" : "Noite",
                Integer.toString(linha.veiculos()), moeda.format(linha.dinheiro()), moeda.format(linha.cartao()),
                moeda.format(linha.pix()), moeda.format(linha.bruto()), moeda.format(linha.custos()),
                moeda.format(linha.liquido()))).toList());
        for (var subtotal : relatorio.subtotaisDasFichas()) {
            linhas.add(List.of("Subtotal", subtotal.unidade(), "", Long.toString(subtotal.carros()), "", "", "",
                    moeda.format(subtotal.bruto()), moeda.format(subtotal.bruto().subtract(subtotal.liquido())),
                    moeda.format(subtotal.liquido())));
        }
        var totais = List.of("Bruto  " + moeda.format(resumo.totalBruto()),
                "Custos das fichas  " + moeda.format(relatorio.custosFichas()),
                "Líquido das fichas  " + moeda.format(resumo.lucroFichas()),
                "Despesas fixas  " + moeda.format(resumo.despesasFixas()),
                "Resultado  " + moeda.format(resumo.resultado()));
        return gerar("Relatório financeiro", relatorio, totais,
                List.of("Data", "Unidade", "Turno", "Carros", "Dinheiro", "Cartão", "Pix", "Bruto", "Custos", "Líquido"),
                new int[]{60, 115, 43, 39, 85, 85, 85, 85, 85, 85}, linhas);
    }

    public byte[] carros(RelatorioFinanceiro relatorio) throws IOException {
        var moeda = NumberFormat.getCurrencyInstance(BR);
        if (relatorio.mesUnico()) return carrosPorDia(relatorio);
        var linhas = relatorio.mesesComMovimento().stream().map(mes -> List.of(
                mes.mes().getDisplayName(TextStyle.FULL, BR), Integer.toString(mes.fichas()),
                Integer.toString(mes.carros()), moeda.format(mes.bruto()), moeda.format(mes.liquido()))).toList();
        return gerar("Carros por mês", relatorio,
                List.of("Total de carros  " + relatorio.resumo().totalCarros(),
                        "Fichas  " + relatorio.resumo().quantidadeFichas()),
                List.of("Mês", "Fichas", "Carros", "Total bruto", "Total líquido"),
                new int[]{170, 110, 110, 180, 180}, linhas);
    }

    /** Mês escolhido: cada dia com a quantidade de carros (detalhamento por dia, como no sistema antigo). */
    private byte[] carrosPorDia(RelatorioFinanceiro relatorio) throws IOException {
        var dias = relatorio.carrosPorDia();
        boolean variasUnidades = dias.stream().map(RelatorioFinanceiro.Dia::unidade).distinct().count() > 1;
        var linhas = new ArrayList<List<String>>();
        for (var dia : dias) {
            String semana = dia.data().getDayOfWeek().getDisplayName(TextStyle.SHORT, BR).replace(".", "");
            linhas.add(variasUnidades
                    ? List.of(DATA.format(dia.data()), semana, dia.unidade(), Integer.toString(dia.fichas()), Integer.toString(dia.carros()))
                    : List.of(DATA.format(dia.data()), semana, Integer.toString(dia.fichas()), Integer.toString(dia.carros())));
        }
        long total = dias.stream().mapToLong(RelatorioFinanceiro.Dia::carros).sum();
        long diasComMovimento = dias.stream().map(RelatorioFinanceiro.Dia::data).distinct().count();
        if (!dias.isEmpty()) {
            linhas.add(variasUnidades ? List.of("Total do mês", "", "", Integer.toString(relatorio.resumo().quantidadeFichas()), Long.toString(total))
                    : List.of("Total do mês", "", Integer.toString(relatorio.resumo().quantidadeFichas()), Long.toString(total)));
        }
        String mes = relatorio.inicio().getMonth().getDisplayName(TextStyle.FULL, BR);
        return gerar("Carros por dia | " + mes.substring(0, 1).toUpperCase(BR) + mes.substring(1) + " de " + relatorio.inicio().getYear(), relatorio,
                List.of("Total de carros  " + total, "Dias com movimento  " + diasComMovimento,
                        "Média por dia  " + (diasComMovimento == 0 ? 0 : Math.round((double) total / diasComMovimento))),
                variasUnidades ? List.of("Data", "Dia", "Unidade", "Fichas", "Carros") : List.of("Data", "Dia", "Fichas", "Carros"),
                variasUnidades ? new int[]{150, 90, 260, 110, 110} : new int[]{180, 120, 180, 180}, linhas);
    }

    private byte[] gerar(String titulo, RelatorioFinanceiro relatorio, List<String> totais,
                         List<String> colunas, int[] larguras, List<List<String>> linhas) throws IOException {
        try (var documento = new PDDocument(); var dados = new ByteArrayOutputStream()) {
            var normal = new PDType1Font(Standard14Fonts.FontName.HELVETICA);
            var negrito = new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD);
            documento.getDocumentInformation().setTitle(titulo + " | Park Flash");
            int paginas = Math.max(1, (linhas.size() + LINHAS_POR_PAGINA - 1) / LINHAS_POR_PAGINA);
            for (int i = 0; i < paginas; i++) {
                var pagina = new PDPage(PAISAGEM);
                documento.addPage(pagina);
                try (var fluxo = new PDPageContentStream(documento, pagina)) {
                    float largura = PAISAGEM.getWidth() - 2 * MARGEM;
                    fundo(fluxo, MARINHO, MARGEM, 501, largura, 58);
                    fluxo.setNonStrokingColor(Color.WHITE);
                    texto(fluxo, negrito, 17, MARGEM + 12, 535, largura - 24, "Park Flash | " + titulo);
                    texto(fluxo, normal, 10, MARGEM + 12, 517, largura - 24,
                            DATA.format(relatorio.inicio()) + " a " + DATA.format(relatorio.fim()) + " | " + relatorio.unidade());
                    fluxo.setNonStrokingColor(MARINHO);
                    texto(fluxo, negrito, 9, MARGEM, 480, largura, String.join("    |    ", totais));
                    fundo(fluxo, CABECALHO, MARGEM, 444, largura, 23);
                    fluxo.setNonStrokingColor(MARINHO);
                    linha(fluxo, negrito, 452, colunas, larguras);
                    int inicio = i * LINHAS_POR_PAGINA;
                    int fim = Math.min(inicio + LINHAS_POR_PAGINA, linhas.size());
                    for (int j = inicio; j < fim; j++) {
                        float y = 431 - (j - inicio) * ALTURA_LINHA;
                        if (j % 2 == 0) fundo(fluxo, LINHA_ALTERNADA, MARGEM, y - 5, largura, ALTURA_LINHA);
                        fluxo.setNonStrokingColor(MARINHO);
                        linha(fluxo, normal, y, linhas.get(j), larguras);
                    }
                    if (linhas.isEmpty()) texto(fluxo, normal, 10, MARGEM + 4, 431, largura, "Nenhuma ficha no período.");
                    texto(fluxo, normal, 9, MARGEM, 15, largura, "Página " + (i + 1) + " de " + paginas);
                }
            }
            documento.save(dados);
            return dados.toByteArray();
        }
    }

    private static void fundo(PDPageContentStream fluxo, Color cor,
                              float x, float y, float largura, float altura) throws IOException {
        fluxo.setNonStrokingColor(cor);
        fluxo.addRect(x, y, largura, altura);
        fluxo.fill();
    }

    private static void linha(PDPageContentStream fluxo, PDType1Font fonte, float y,
                              List<String> valores, int[] larguras) throws IOException {
        float x = MARGEM;
        for (int i = 0; i < larguras.length; i++) {
            texto(fluxo, fonte, 9, x + 4, y, larguras[i] - 8, valores.get(i));
            x += larguras[i];
        }
    }

    private static void texto(PDPageContentStream fluxo, PDType1Font fonte, float tamanho, float x, float y,
                              float limite, String valor) throws IOException {
        var limpo = valor == null ? "" : valor.replaceAll("\\p{C}|\\u00A0", " ");
        String exibido = new String(limpo.getBytes(WIN_ANSI), WIN_ANSI);
        if (fonte.getStringWidth(exibido) * tamanho / 1000 > limite) {
            int fim = exibido.length();
            while (fonte.getStringWidth(exibido.substring(0, fim) + "…") * tamanho / 1000 > limite) fim--;
            exibido = exibido.substring(0, fim) + "…";
        }
        fluxo.beginText();
        fluxo.setFont(fonte, tamanho);
        fluxo.newLineAtOffset(x, y);
        fluxo.showText(exibido);
        fluxo.endText();
    }
}
