package com.parkflash.servico;

import com.parkflash.erro.RegraInvalidaException;
import com.parkflash.seguranca.AcessoUnidades;
import com.parkflash.web.dto.ResumoPeriodo;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class PainelService {

    private final JdbcClient jdbc;
    private final RelatorioService relatorios;

    public PainelService(JdbcClient jdbc, RelatorioService relatorios) {
        this.jdbc = jdbc;
        this.relatorios = relatorios;
    }

    @Transactional(readOnly = true)
    public Resposta consultar(int mes, int ano, Long unidadeId, AcessoUnidades acesso) {
        if (mes < 1 || mes > 12 || ano < 2 || ano > 9999) throw new RegraInvalidaException("Período inválido.");
        if (unidadeId != null) acesso.exigir(unidadeId);
        var periodo = YearMonth.of(ano, mes);
        var anterior = periodo.minusMonths(1);
        var atual = relatorios.resumo(mes, ano, unidadeId, acesso);
        var comparacao = relatorios.resumo(anterior.getMonthValue(), anterior.getYear(), unidadeId, acesso);
        var hoje = LocalDate.now(PagamentoManobristaService.FUSO_NEGOCIO);
        var filtro = new Escopo(acesso.todas() && unidadeId == null,
                unidadeId == null ? acesso.unidades() : Set.of(unidadeId));
        Map<String, ?> parametros = Map.of("de", periodo.atDay(1), "ate", periodo.atEndOfMonth());
        BigDecimal brutoHoje = consulta("""
                SELECT COALESCE(SUM(valor.total_bruto), 0) FROM ficha valor
                WHERE valor.situacao <> 'CANCELADA' AND valor.data = :hoje
                """, filtro, Map.of("hoje", hoje)).query(BigDecimal.class).single();
        BigDecimal diarias = consulta("""
                SELECT COALESCE(SUM(m.diaria), 0) FROM ficha valor JOIN ficha_manobrista m ON m.ficha_id = valor.id
                WHERE valor.situacao <> 'CANCELADA' AND valor.data BETWEEN :de AND :ate
                """, filtro, parametros).query(BigDecimal.class).single();
        BigDecimal adicionais = consulta("""
                SELECT COALESCE(SUM(d.valor), 0) FROM ficha valor JOIN ficha_despesa d ON d.ficha_id = valor.id
                WHERE valor.situacao <> 'CANCELADA' AND valor.data BETWEEN :de AND :ate
                """, filtro, parametros).query(BigDecimal.class).single();
        BigDecimal pendente = consulta("""
                SELECT COALESCE(SUM(valor.valor), 0) FROM diaria_a_pagar valor
                WHERE valor.pagamento_ativo_id IS NULL AND valor.data_trabalho BETWEEN :de AND :ate
                """, filtro, parametros).query(BigDecimal.class).single();
        BigDecimal pago = consulta("""
                SELECT COALESCE(SUM(valor.valor), 0) FROM diaria_a_pagar valor
                JOIN pagamento_manobrista p ON p.id = valor.pagamento_ativo_id
                WHERE p.estornado_em IS NULL AND p.data_pagamento BETWEEN :de AND :ate
                """, filtro, parametros).query(BigDecimal.class).single();
        long conferir = consulta("""
                SELECT COUNT(*) FROM ficha valor
                WHERE valor.situacao = 'PRONTA' AND valor.data BETWEEN :de AND :ate
                """, filtro, parametros).query(Long.class).single();
        long eventos = consulta("""
                SELECT COUNT(*) FROM evento valor WHERE valor.situacao IN ('PLANEJADO', 'CONFIRMADO')
                  AND valor.inicio >= :hoje AND valor.inicio < :limite
                """, filtro, Map.of("hoje", hoje.atStartOfDay(), "limite", hoje.plusDays(7).atStartOfDay()))
                .query(Long.class).single();
        var porUnidade = consulta("""
                SELECT valor.unidade_id, u.nome AS unidade, SUM(valor.total_bruto) AS bruto, SUM(valor.total_liquido) AS liquido
                FROM ficha valor JOIN unidade u ON u.id = valor.unidade_id
                WHERE valor.situacao <> 'CANCELADA' AND valor.data BETWEEN :de AND :ate
                """, filtro, parametros, " GROUP BY valor.unidade_id, u.nome ORDER BY u.nome")
                .query(UnidadeResumo.class).list();
        return new Resposta(atual, comparacao.resultado(), brutoHoje, diarias, adicionais.add(atual.despesasFixas()),
                pendente, pago, conferir, eventos, porUnidade);
    }

    private JdbcClient.StatementSpec consulta(String sql, Escopo filtro, Map<String, ?> parametros) {
        return consulta(sql, filtro, parametros, "");
    }

    private JdbcClient.StatementSpec consulta(String sql, Escopo filtro, Map<String, ?> parametros, String sufixo) {
        Map<String, Object> dados = new HashMap<>(parametros);
        if (!filtro.todas()) {
            if (filtro.unidades().isEmpty()) sql += " AND 1 = 0";
            else {
                sql += " AND valor.unidade_id IN (:unidades)";
                dados.put("unidades", filtro.unidades());
            }
        }
        return jdbc.sql(sql + sufixo).params(dados);
    }

    public record Resposta(ResumoPeriodo mes, BigDecimal resultadoAnterior, BigDecimal brutoHoje,
                           BigDecimal custosManobristas, BigDecimal despesasTotais, BigDecimal pagamentosPendentes,
                           BigDecimal pagamentosConfirmados, long fichasParaConferir, long eventosProximos,
                           List<UnidadeResumo> porUnidade) {}
    public record UnidadeResumo(long unidadeId, String unidade, BigDecimal bruto, BigDecimal liquido) {}
    private record Escopo(boolean todas, Set<Long> unidades) {}
}
