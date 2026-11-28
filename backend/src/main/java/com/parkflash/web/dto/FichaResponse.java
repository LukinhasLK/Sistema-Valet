package com.parkflash.web.dto;

import com.parkflash.dominio.Ficha;
import com.parkflash.dominio.Turno;
import com.parkflash.dominio.SituacaoFicha;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

public record FichaResponse(
        Long id, LocalDate data, Long unidadeId, Turno turno,
        int fichaInicio, int fichaFim, int fichasCanceladas, int totalCarros,
        BigDecimal valorDinheiro, BigDecimal valorCartao, BigDecimal valorPix, BigDecimal taxaMaquininha,
        List<ManobristaFichaDto> manobristas, List<DespesaAdicionalDto> despesasAdicionais,
        BigDecimal totalBruto, BigDecimal totalLiquido,
        BigDecimal valorInicialCaixa, BigDecimal valorFinalCaixa, String observacoes,
        SituacaoFicha situacao, Long responsavelId, Long fechadoPor, OffsetDateTime fechadoEm) {

    public static FichaResponse de(Ficha f) {
        return new FichaResponse(
                f.getId(), f.getData(), f.getUnidadeId(), f.getTurno(),
                f.getFichaInicio(), f.getFichaFim(), f.getFichasCanceladas(), f.getTotalCarros(),
                f.getValorDinheiro(), f.getValorCartao(), f.getValorPix(), f.getTaxaMaquininha(),
                f.getManobristas().stream().map(m ->
                        new ManobristaFichaDto(m.getManobristaId(), m.getDiaria(), null, null, m.getModalidade())).toList(),
                f.getDespesasAdicionais().stream().map(d -> new DespesaAdicionalDto(d.getDescricao(), d.getValor())).toList(),
                f.getTotalBruto(), f.getTotalLiquido(), f.getValorInicialCaixa(), f.getValorFinalCaixa(), f.getObservacoes(),
                f.getSituacao(), f.getResponsavelId(), f.getFechadoPor(), f.getFechadoEm());
    }
}
