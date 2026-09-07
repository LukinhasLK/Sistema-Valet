package com.valetgest.service;

import com.valetgest.dto.FichaResponse;
import com.valetgest.dto.RelatorioMensalResponse;
import com.valetgest.entity.Ficha;
import com.valetgest.entity.Usuario;
import com.valetgest.exception.NegocioException;
import com.valetgest.repository.FichaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import com.valetgest.controller.RelatorioController.CarrosResponse;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

/**
 * Gera o relatório mensal detalhado.
 */
@Service
@RequiredArgsConstructor
public class RelatorioService {

    private final FichaRepository fichaRepository;

    public RelatorioMensalResponse gerarRelatorioMensal(
            Integer mes, Integer ano, Long unidadeId, Usuario usuarioLogado) {

        if (mes < 1 || mes > 12) {
            throw new NegocioException("Mês inválido");
        }

        // Calcula primeiro e último dia do mês
        YearMonth yearMonth = YearMonth.of(ano, mes);
        LocalDate inicio = yearMonth.atDay(1);
        LocalDate fim = yearMonth.atEndOfMonth();

        // Se for gerente, força filtrar pela unidade dele
        Long unidadeFiltro = unidadeId;
        if (usuarioLogado.getTipo().name().equals("GERENTE")) {
            if (usuarioLogado.getUnidade() == null) {
                throw new NegocioException("Gerente sem unidade definida");
            }
            unidadeFiltro = usuarioLogado.getUnidade().getId();
        }

        // Busca as fichas
        List<Ficha> fichas;
        String nomeUnidade;

        if (unidadeFiltro != null) {
            fichas = fichaRepository
                    .findByUnidadeIdAndDataFichaBetweenOrderByDataFichaAsc(
                            unidadeFiltro, inicio, fim);
            nomeUnidade = fichas.isEmpty() ? "Unidade " + unidadeFiltro
                    : fichas.get(0).getUnidade().getNome();
        } else {
            fichas = fichaRepository
                    .findByDataFichaBetweenOrderByDataFichaAsc(inicio, fim);
            nomeUnidade = "Todas as unidades";
        }

        // Calcula totalizadores
        BigDecimal totalBruto = BigDecimal.ZERO;
        BigDecimal totalManobristas = BigDecimal.ZERO;
        BigDecimal totalCartao = BigDecimal.ZERO;
        BigDecimal totalDespesas = BigDecimal.ZERO;
        int totalManobras = 0;

        for (Ficha f : fichas) {
            totalBruto = totalBruto.add(f.getTotalBruto());
            totalManobristas = totalManobristas.add(f.getTotalPagoManobristas());
            totalCartao = totalCartao.add(f.getTaxaCartao());
            totalDespesas = totalDespesas.add(f.getTotalDespesas());
            totalManobras += f.getQuantidadeManobras();
        }

        BigDecimal liquidoTotal = totalBruto
                .subtract(totalManobristas)
                .subtract(totalCartao)
                .subtract(totalDespesas);

        // Quando é relatório geral, agrupa por unidade
        List<RelatorioMensalResponse.ResumoUnidade> resumoPorUnidade = null;
        if (unidadeFiltro == null) {
            resumoPorUnidade = agruparPorUnidade(fichas);
        }

        return RelatorioMensalResponse.builder()
                .mes(mes)
                .ano(ano)
                .inicio(inicio)
                .fim(fim)
                .unidadeId(unidadeFiltro)
                .unidadeNome(nomeUnidade)
                .quantidadeFichas(fichas.size())
                .totalManobras(totalManobras)
                .totalBruto(totalBruto)
                .totalPagoManobristas(totalManobristas)
                .totalTaxaCartao(totalCartao)
                .totalDespesas(totalDespesas)
                .valorLiquidoTotal(liquidoTotal)
                .fichas(fichas.stream().map(FichaResponse::fromEntity).toList())
                .resumoPorUnidade(resumoPorUnidade)
                .build();
    }

    public CarrosResponse gerarRelatorioCarros(Integer ano, Integer mes, Long unidadeId, Usuario usuarioLogado) {
        LocalDate inicio = mes != null
            ? LocalDate.of(ano, mes, 1)
            : LocalDate.of(ano, 1, 1);
        LocalDate fim = mes != null
            ? LocalDate.of(ano, mes, 1).withDayOfMonth(LocalDate.of(ano, mes, 1).lengthOfMonth())
            : LocalDate.of(ano, 12, 31);

        Long unidadeFiltro = unidadeId;
        if (usuarioLogado.getTipo().name().equals("GERENTE")) {
            if (usuarioLogado.getUnidade() == null) throw new NegocioException("Gerente sem unidade");
            unidadeFiltro = usuarioLogado.getUnidade().getId();
        }

        List<Ficha> fichas = unidadeFiltro != null
            ? fichaRepository.findByUnidadeIdAndDataFichaBetweenOrderByDataFichaAsc(unidadeFiltro, inicio, fim)
            : fichaRepository.findByDataFichaBetweenOrderByDataFichaAsc(inicio, fim);

        String[] nomesMes = {"Janeiro","Fevereiro","Março","Abril","Maio","Junho",
                             "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"};

        // Resumo por mês (quando filtra por mês, só aparece aquele mês)
        int mesInicio = mes != null ? mes : 1;
        int mesFim    = mes != null ? mes : 12;
        TreeMap<Integer, int[]> porMes = new TreeMap<>();
        for (int m = mesInicio; m <= mesFim; m++) porMes.put(m, new int[]{0, 0});
        fichas.forEach(f -> {
            int m = f.getDataFicha().getMonthValue();
            porMes.get(m)[0] += f.getQuantidadeManobras();
            porMes.get(m)[1] += 1;
        });

        List<CarrosResponse.ResumoMes> resumo = new ArrayList<>();
        porMes.forEach((m, vals) -> {
            CarrosResponse.ResumoMes r = new CarrosResponse.ResumoMes();
            r.setMes(m);
            r.setNomeMes(nomesMes[m - 1]);
            r.setTotalCarros(vals[0]);
            r.setTotalFichas(vals[1]);
            resumo.add(r);
        });

        // Detalhado — uma linha por ficha
        List<CarrosResponse.DetalheDia> detalhado = fichas.stream().map(f -> {
            CarrosResponse.DetalheDia d = new CarrosResponse.DetalheDia();
            d.setFichaId(f.getId());
            d.setData(f.getDataFicha());
            d.setUnidadeNome(f.getUnidade().getNome());
            d.setTotalCarros(f.getQuantidadeManobras());
            return d;
        }).toList();

        CarrosResponse resp = new CarrosResponse();
        resp.setResumo(resumo);
        resp.setDetalhado(detalhado);
        return resp;
    }

    private List<RelatorioMensalResponse.ResumoUnidade> agruparPorUnidade(List<Ficha> fichas) {
        // Agrupa por unidade somando os valores
        Map<Long, RelatorioMensalResponse.ResumoUnidade> mapa = new HashMap<>();

        for (Ficha f : fichas) {
            Long uid = f.getUnidade().getId();
            RelatorioMensalResponse.ResumoUnidade r = mapa.get(uid);
            if (r == null) {
                r = RelatorioMensalResponse.ResumoUnidade.builder()
                        .unidadeId(uid)
                        .unidadeNome(f.getUnidade().getNome())
                        .quantidadeFichas(0)
                        .totalBruto(BigDecimal.ZERO)
                        .valorLiquido(BigDecimal.ZERO)
                        .build();
                mapa.put(uid, r);
            }
            r.setQuantidadeFichas(r.getQuantidadeFichas() + 1);
            r.setTotalBruto(r.getTotalBruto().add(f.getTotalBruto()));
            r.setValorLiquido(r.getValorLiquido().add(f.getValorLiquido()));
        }

        return mapa.values().stream().toList();
    }
}
