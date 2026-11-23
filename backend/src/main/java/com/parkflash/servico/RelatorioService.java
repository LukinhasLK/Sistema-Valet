package com.parkflash.servico;

import com.parkflash.dominio.Despesa;
import com.parkflash.dominio.Ficha;
import com.parkflash.dominio.Unidade;
import com.parkflash.erro.NaoEncontradoException;
import com.parkflash.erro.RegraInvalidaException;
import com.parkflash.repositorio.DespesaRepository;
import com.parkflash.repositorio.FichaRepository;
import com.parkflash.repositorio.UnidadeRepository;
import com.parkflash.web.dto.DivisaoLucro;
import com.parkflash.web.dto.ResumoPeriodo;
import com.parkflash.web.dto.RelatorioFinanceiro;
import com.parkflash.seguranca.AcessoUnidades;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import java.util.stream.Collectors;
import java.util.Set;

@Service
public class RelatorioService {

    private final FichaRepository fichas;
    private final DespesaRepository despesas;
    private final RateioService rateios;
    private final UnidadeRepository unidades;

    public RelatorioService(FichaRepository fichas, DespesaRepository despesas, RateioService rateios, UnidadeRepository unidades) {
        this.fichas = fichas;
        this.despesas = despesas;
        this.rateios = rateios;
        this.unidades = unidades;
    }

    @Transactional(readOnly = true)
    public ResumoPeriodo resumo(Integer mes, int ano, Long unidadeId, AcessoUnidades acesso) {
        return consultar(mes, ano, unidadeId, acesso).resumo();
    }

    @Transactional(readOnly = true)
    public RelatorioFinanceiro financeiro(Integer mes, int ano, Long unidadeId, AcessoUnidades acesso) {
        var periodo = consultar(mes, ano, unidadeId, acesso);
        String titulo = unidadeId == null ? (acesso.todas() ? "Todas as unidades" : "Unidades autorizadas")
                : unidades.findById(unidadeId).map(Unidade::getNome)
                    .orElseThrow(() -> new NaoEncontradoException("Unidade não encontrada."));
        var ids = periodo.fichas().stream().map(Ficha::getUnidadeId).collect(Collectors.toSet());
        var nomes = unidades.findAllById(ids).stream().collect(Collectors.toMap(Unidade::getId, Unidade::getNome));
        var linhas = periodo.fichas().stream().map(f -> new RelatorioFinanceiro.Linha(f.getId(), f.getData(),
                f.getTurno(), nomes.get(f.getUnidadeId()), f.getTotalCarros(), f.getValorDinheiro(),
                f.getValorCartao(), f.getValorPix(), f.getTotalBruto(),
                f.getTotalBruto().subtract(f.getTotalLiquido()), f.getTotalLiquido())).toList();
        var resumo = periodo.resumo();
        return new RelatorioFinanceiro(resumo, periodo.inicio(), periodo.fim(), titulo,
                resumo.totalBruto().subtract(resumo.lucroFichas()), linhas);
    }

    private Periodo consultar(Integer mes, int ano, Long unidadeId, AcessoUnidades acesso) {
        if (unidadeId != null) acesso.exigir(unidadeId);
        if (ano < 1 || ano > 9999) throw new RegraInvalidaException("Ano inválido.");
        LocalDate inicio = inicio(mes, ano);
        LocalDate fim = fim(mes, ano);

        boolean consolidado = unidadeId == null && acesso.todas();
        Set<Long> ids = unidadeId == null ? acesso.unidades() : Set.of(unidadeId);
        List<Ficha> doPeriodo = consolidado ? fichas.findByDataBetweenOrderByDataDescIdDesc(inicio, fim)
                : fichas.findByUnidadeIdInAndDataBetweenOrderByDataDescIdDesc(ids, inicio, fim);
        List<Despesa> despesasDoPeriodo = consolidado ? despesas.findByCanceladaFalseAndDataBetweenOrderByDataDescIdDesc(inicio, fim)
                : despesas.findByCanceladaFalseAndUnidadeIdInAndDataBetweenOrderByDataDescIdDesc(ids, inicio, fim);

        BigDecimal bruto = soma(doPeriodo.stream().map(Ficha::getTotalBruto).toList());
        BigDecimal lucro = soma(doPeriodo.stream().map(Ficha::getTotalLiquido).toList());
        BigDecimal fixas = soma(despesasDoPeriodo.stream().map(Despesa::getValor).toList());
        int carros = doPeriodo.stream().mapToInt(Ficha::getTotalCarros).sum();

        var resumo = new ResumoPeriodo(mes, ano, unidadeId, doPeriodo.size(), carros, bruto, lucro, fixas,
                CalculoFicha.resultado(lucro, fixas));
        return new Periodo(resumo, inicio, fim, doPeriodo);
    }

    private record Periodo(ResumoPeriodo resumo, LocalDate inicio, LocalDate fim, List<Ficha> fichas) {}

    /** Rateio do resultado da unidade conforme o percentual de cada sócio nela. */
    @Transactional(readOnly = true)
    public DivisaoLucro divisao(Integer mes, int ano, Long unidadeId, AcessoUnidades acesso) {
        if (mes == null) throw new RegraInvalidaException("Escolha o mês de competência do rateio.");
        var resumo = resumo(mes, ano, unidadeId, acesso);
        BigDecimal resultado = resumo.resultado();
        var partes = rateios.repartir(resultado, rateios.cotas(unidadeId, inicio(mes, ano)));
        return new DivisaoLucro(mes, ano, unidadeId, resultado, partes, resumo.lucroFichas(),
                resumo.despesasFixas(), resumo.quantidadeFichas());
    }

    private static LocalDate inicio(Integer mes, int ano) {
        validarMes(mes);
        return mes == null ? LocalDate.of(ano, 1, 1) : LocalDate.of(ano, mes, 1);
    }

    private static LocalDate fim(Integer mes, int ano) {
        return mes == null ? LocalDate.of(ano, 12, 31) : YearMonth.of(ano, mes).atEndOfMonth();
    }

    private static void validarMes(Integer mes) {
        if (mes != null && (mes < 1 || mes > 12)) {
            throw new RegraInvalidaException("Mês deve estar entre 1 e 12.");
        }
    }

    private static BigDecimal soma(List<BigDecimal> valores) {
        return CalculoFicha.arredondar(valores.stream().reduce(BigDecimal.ZERO, BigDecimal::add));
    }
}
