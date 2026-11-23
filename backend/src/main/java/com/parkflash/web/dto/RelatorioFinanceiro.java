package com.parkflash.web.dto;

import com.parkflash.dominio.Turno;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.Month;
import java.util.TreeMap;
import java.util.stream.Collectors;
import java.util.List;

public record RelatorioFinanceiro(ResumoPeriodo resumo, LocalDate inicio, LocalDate fim, String unidade,
                                  BigDecimal custosFichas, List<Linha> linhas) {
    public record Mes(Month mes, int fichas, int carros, BigDecimal bruto, BigDecimal liquido) {}

    public List<Mes> mesesComMovimento() {
        var porMes = linhas.stream().collect(Collectors.groupingBy(
                linha -> linha.data().getMonth(), TreeMap::new, Collectors.toList()));
        return porMes.entrySet().stream().map(item -> {
            var fichas = item.getValue();
            return new Mes(item.getKey(), fichas.size(), fichas.stream().mapToInt(Linha::veiculos).sum(),
                    fichas.stream().map(Linha::bruto).reduce(BigDecimal.ZERO, BigDecimal::add),
                    fichas.stream().map(Linha::liquido).reduce(BigDecimal.ZERO, BigDecimal::add));
        }).toList();
    }

    public record Subtotal(String unidade, long fichas, long carros, BigDecimal bruto, BigDecimal liquido) {}

    public List<Subtotal> subtotaisDasFichas() {
        var porUnidade = linhas.stream().collect(Collectors.groupingBy(Linha::unidade, TreeMap::new, Collectors.toList()));
        return porUnidade.entrySet().stream().map(item -> {
            var fichas = item.getValue();
            return new Subtotal(item.getKey(), fichas.size(), fichas.stream().mapToLong(Linha::veiculos).sum(),
                    fichas.stream().map(Linha::bruto).reduce(BigDecimal.ZERO, BigDecimal::add),
                    fichas.stream().map(Linha::liquido).reduce(BigDecimal.ZERO, BigDecimal::add));
        }).toList();
    }

    public record Linha(long id, LocalDate data, Turno turno, String unidade, int veiculos,
                        BigDecimal dinheiro, BigDecimal cartao, BigDecimal pix, BigDecimal bruto,
                        BigDecimal custos, BigDecimal liquido) {
    }
}
