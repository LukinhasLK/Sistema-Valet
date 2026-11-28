package com.parkflash.servico;

import com.parkflash.dominio.NivelAcesso;
import com.parkflash.seguranca.AcessoUnidades;
import com.parkflash.seguranca.UsuarioLogado;
import com.parkflash.web.dto.PendenciaDto;
import com.parkflash.web.dto.PendenciaDto.Nivel;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Pendências do "Perdidinho ajudante": só contagens leves (COUNT), filtradas pelas unidades do usuário
 * e só do nível dele. Reaproveita as regras das telas (conferência e resumo de pagamentos, fichas abertas
 * e unidades sem rateio da divisão de lucro); notificações NÃO contam como pendência.
 */
@Service
public class PendenciaService {
    private static final BigDecimal CEM = new BigDecimal("100");

    private final JdbcClient jdbc;
    private final RateioService rateios;
    private final Clock relogio = Clock.systemUTC();

    public PendenciaService(JdbcClient jdbc, RateioService rateios) {
        this.jdbc = jdbc;
        this.rateios = rateios;
    }

    @Transactional(readOnly = true)
    public List<PendenciaDto> listar(UsuarioLogado ator) {
        var itens = new ArrayList<PendenciaDto>();
        LocalDate hoje = LocalDate.now(relogio.withZone(PagamentoManobristaService.FUSO_NEGOCIO));
        NivelAcesso nivel = ator.nivel();
        if (nivel == NivelAcesso.PROPRIETARIO || nivel == NivelAcesso.GERENTE) {
            var acesso = AcessoUnidades.de(ator);
            adicionar(itens, "prontas", Nivel.ATENCAO, prontas(acesso), "/app/fichas?situacao=PRONTA&mes=0");
            prontasAtrasadas(itens, acesso, hoje);
            adicionar(itens, "diariasAConferir", Nivel.ATENCAO, diariasAConferir(acesso, hoje), "/app/pagamentos-manobristas");
            adicionar(itens, "manobristasAPagar", Nivel.ATENCAO, manobristasAPagar(acesso), "/app/pagamentos-manobristas");
            adicionar(itens, "eventosHojeAmanha", Nivel.INFO, eventosHojeAmanha(acesso, hoje), "/app/eventos");
            if (nivel == NivelAcesso.PROPRIETARIO) {
                adicionar(itens, "fichasAbertasMes", Nivel.ATENCAO, fichasEmEdicaoMes(acesso, hoje), "/app/divisao-lucro");
                adicionar(itens, "unidadesSemRateio", Nivel.URGENTE, unidadesSemRateio(hoje), "/app/socios");
            }
        } else if (nivel == NivelAcesso.SOCIO) {
            adicionar(itens, "fichasAbertasMes", Nivel.INFO, fichasAbertasDoSocio(ator, hoje), "/app/sociedade");
        }
        itens.sort(Comparator.comparingInt(p -> p.nivel().ordinal()));
        return itens;
    }

    private static void adicionar(List<PendenciaDto> itens, String tipo, Nivel nivel, long quantidade, String rota) {
        if (quantidade > 0) itens.add(PendenciaDto.de(tipo, nivel, quantidade, rota));
    }

    /** Cláusula de unidades do usuário: o proprietário vê tudo; os demais, só as unidades deles. */
    private static String escopo(AcessoUnidades acesso, String coluna, Map<String, Object> params) {
        if (acesso.todas()) return "";
        if (acesso.unidades().isEmpty()) return " AND 1 = 0";
        params.put("escopo", acesso.unidades());
        return " AND " + coluna + " IN (:escopo)";
    }

    private long contar(String sql, Map<String, Object> params) {
        return jdbc.sql(sql).params(params).query(Long.class).single();
    }

    private long prontas(AcessoUnidades acesso) {
        var p = new HashMap<String, Object>();
        return contar("SELECT COUNT(*) FROM ficha f WHERE f.situacao = 'PRONTA'" + escopo(acesso, "f.unidade_id", p), p);
    }

    /**
     * Fichas PRONTA esperando há mais de 24 h: desde o último "ENVIAR" do histórico; sem histórico, vale o fim do dia da
     * ficha (só conta se ela for anterior a ontem). Traz a data, a unidade e o id da que espera há mais tempo.
     */
    private void prontasAtrasadas(List<PendenciaDto> itens, AcessoUnidades acesso, LocalDate hoje) {
        var p = new HashMap<String, Object>();
        var fichas = jdbc.sql("""
                SELECT f.id, f.data, u.nome AS unidade,
                  (SELECT MAX(h.registrado_em) FROM ficha_historico h WHERE h.ficha_id = f.id AND h.acao = 'ENVIAR') AS enviada_em
                FROM ficha f JOIN unidade u ON u.id = f.unidade_id
                WHERE f.situacao = 'PRONTA'
                """ + escopo(acesso, "f.unidade_id", p))
                .params(p)
                .query((rs, i) -> {
                    var ts = rs.getObject("enviada_em", java.time.OffsetDateTime.class);
                    LocalDate data = rs.getObject("data", LocalDate.class);
                    java.time.Instant desde = ts != null ? ts.toInstant()
                            : data.plusDays(1).atStartOfDay(PagamentoManobristaService.FUSO_NEGOCIO).toInstant();
                    return new ProntaEspera(rs.getLong("id"), data, rs.getString("unidade"), desde);
                }).list();
        java.time.Instant limite = relogio.instant().minus(java.time.Duration.ofHours(24));
        var atrasadas = fichas.stream().filter(f -> f.desde().isBefore(limite)).toList();
        if (atrasadas.isEmpty()) return;
        var maisAntiga = atrasadas.stream().min(Comparator.comparing(ProntaEspera::desde).thenComparing(ProntaEspera::id)).orElseThrow();
        itens.add(PendenciaDto.prontasAtrasadas(atrasadas.size(), "/app/fichas?situacao=PRONTA&mes=0&ordem=antigas",
                maisAntiga.data(), maisAntiga.unidade(), maisAntiga.id()));
    }

    private record ProntaEspera(long id, LocalDate data, String unidade, java.time.Instant desde) { }

    /** Mesma regra de GET /api/pagamentos-manobristas/conferencia (candidatos a diária ainda não reconhecidos). */
    private long diariasAConferir(AcessoUnidades acesso, LocalDate hoje) {
        var p = new HashMap<String, Object>();
        p.put("hoje", hoje);
        return contar("""
                SELECT COUNT(*) FROM ficha f JOIN ficha_manobrista fm ON fm.ficha_id = f.id
                WHERE f.controle_pagamentos = TRUE AND f.situacao <> 'CANCELADA' AND fm.diaria > 0
                  AND f.data >= (SELECT data_corte FROM controle_diarias_inicio WHERE id = 1)
                  AND f.data <= :hoje
                  AND NOT EXISTS (SELECT 1 FROM diaria_a_pagar d WHERE d.ficha_id = f.id AND d.manobrista_id = fm.manobrista_id)
                """ + escopo(acesso, "f.unidade_id", p), p);
    }

    /** Mesma regra de manobristasPendentes do resumo: manobristas com diária reconhecida e ainda sem pagamento ativo. */
    private long manobristasAPagar(AcessoUnidades acesso) {
        var p = new HashMap<String, Object>();
        return contar("""
                SELECT COUNT(DISTINCT d.manobrista_id) FROM diaria_a_pagar d
                LEFT JOIN pagamento_manobrista pg ON pg.id = d.pagamento_ativo_id
                WHERE pg.id IS NULL
                """ + escopo(acesso, "d.unidade_id", p), p);
    }

    private long eventosHojeAmanha(AcessoUnidades acesso, LocalDate hoje) {
        var p = new HashMap<String, Object>();
        p.put("de", hoje.atStartOfDay());
        p.put("ate", hoje.plusDays(2).atStartOfDay());
        return contar("SELECT COUNT(*) FROM evento e WHERE e.situacao <> 'CANCELADO' AND e.fim > :de AND e.inicio < :ate"
                + escopo(acesso, "e.unidade_id", p), p);
    }

    /** Fichas do mês corrente que ainda não foram fechadas (nem canceladas): são as que travam a divisão de lucro. */
    private long fichasAbertasMes(AcessoUnidades acesso, LocalDate hoje) {
        var p = new HashMap<String, Object>();
        YearMonth mes = YearMonth.from(hoje);
        p.put("ini", mes.atDay(1));
        p.put("fim", mes.atEndOfMonth());
        return contar("SELECT COUNT(*) FROM ficha f WHERE f.data BETWEEN :ini AND :fim AND f.situacao NOT IN ('FECHADA', 'CANCELADA')"
                + escopo(acesso, "f.unidade_id", p), p);
    }

    /** Proprietário: só EM_EDICAO do mês (as PRONTA já aparecem em "esperando conferência", sem contar a ficha duas vezes). */
    private long fichasEmEdicaoMes(AcessoUnidades acesso, LocalDate hoje) {
        var p = new HashMap<String, Object>();
        YearMonth mes = YearMonth.from(hoje);
        p.put("ini", mes.atDay(1));
        p.put("fim", mes.atEndOfMonth());
        return contar("SELECT COUNT(*) FROM ficha f WHERE f.data BETWEEN :ini AND :fim AND f.situacao = 'EM_EDICAO'"
                + escopo(acesso, "f.unidade_id", p), p);
    }

    /** Sócio: fichas abertas do mês nas unidades onde ele tem participação (o lucro dele ainda pode mudar). */
    private long fichasAbertasDoSocio(UsuarioLogado ator, LocalDate hoje) {
        Long socio = jdbc.sql("SELECT socio_id FROM usuario WHERE id = :id").param("id", ator.id())
                .query(Long.class).optional().orElse(null);
        if (socio == null) return 0;
        YearMonth mes = YearMonth.from(hoje);
        var unidades = jdbc.sql("SELECT id FROM unidade").query(Long.class).list().stream()
                .filter(u -> rateios.cotas(u, mes.atDay(1)).stream().anyMatch(c -> c.socioId() == socio))
                .toList();
        if (unidades.isEmpty()) return 0;
        return fichasAbertasMes(new AcessoUnidades(false, new java.util.HashSet<>(unidades)), hoje);
    }

    /**
     * Mesma regra de DivisaoLucro.unidadesSemRateio, no mês corrente: unidade com resultado (fichas fechadas menos
     * despesas) diferente de zero cujo rateio vigente não soma 100%. Só as unidades com resultado consultam o rateio.
     */
    private long unidadesSemRateio(LocalDate hoje) {
        YearMonth mes = YearMonth.from(hoje);
        var resultados = jdbc.sql("""
                SELECT u.id,
                  COALESCE((SELECT SUM(f.total_liquido) FROM ficha f WHERE f.unidade_id = u.id AND f.situacao = 'FECHADA'
                            AND f.data BETWEEN :ini AND :fim), 0)
                  - COALESCE((SELECT SUM(d.valor) FROM despesa d WHERE d.unidade_id = u.id AND d.cancelada = FALSE
                            AND d.data BETWEEN :ini AND :fim), 0) AS resultado
                FROM unidade u
                """).param("ini", mes.atDay(1)).param("fim", mes.atEndOfMonth())
                .query((rs, i) -> Map.entry(rs.getLong("id"), rs.getBigDecimal("resultado"))).list();
        return resultados.stream().filter(r -> r.getValue().signum() != 0)
                .filter(r -> rateios.cotas(r.getKey(), mes.atDay(1)).stream().map(RateioService.Cota::percentual)
                        .reduce(BigDecimal.ZERO, BigDecimal::add).compareTo(CEM) != 0)
                .count();
    }
}
