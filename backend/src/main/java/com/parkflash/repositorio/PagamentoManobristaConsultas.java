package com.parkflash.repositorio;

import com.parkflash.erro.RegraInvalidaException;
import com.parkflash.seguranca.AcessoUnidades;
import com.parkflash.web.dto.PagamentoManobristaDto.*;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.*;

@Repository
@Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
public class PagamentoManobristaConsultas {
    private static final String SITUACAO = """
            CASE WHEN p.id IS NOT NULL THEN 'PAGO'
                 WHEN EXISTS (SELECT 1 FROM pagamento_manobrista_item i WHERE i.diaria_id = d.id) THEN 'ESTORNADO'
                 ELSE 'PENDENTE' END
            """.strip();

    private static final String DIARIAS = """
            FROM diaria_a_pagar d JOIN manobrista m ON m.id = d.manobrista_id
            JOIN unidade u ON u.id = d.unidade_id
            LEFT JOIN pagamento_manobrista p ON p.id = d.pagamento_ativo_id
            """;

    private static final String CANDIDATOS = """
            FROM ficha f JOIN ficha_manobrista fm ON fm.ficha_id = f.id
            JOIN manobrista m ON m.id = fm.manobrista_id
            JOIN unidade u ON u.id = f.unidade_id
            WHERE f.controle_pagamentos = TRUE AND f.situacao <> 'CANCELADA' AND fm.diaria > 0
              AND f.data >= (SELECT data_corte FROM controle_diarias_inicio WHERE id = 1)
              AND f.data <= :hoje
              AND NOT EXISTS (SELECT 1 FROM diaria_a_pagar d WHERE d.ficha_id = f.id AND d.manobrista_id = m.id)
            """;

    private static final String SELECIONAR_CANDIDATO = """
            SELECT f.id AS ficha_id, m.id AS manobrista_id, m.nome AS manobrista, u.nome AS unidade,
                   u.id AS unidade_id, f.data, f.turno, fm.diaria AS custo
            """;

    private static final String HISTORICO = """
            FROM pagamento_manobrista p
            """;

    private static final String SELECIONAR_PAGAMENTO = """
            SELECT p.id, p.manobrista_nome AS manobrista, p.manobrista_id, p.data_pagamento AS data,
                   p.valor, p.forma, p.confirmador, p.confirmado_em, p.estornador, p.estornado_em, p.motivo_estorno,
                   EXISTS (SELECT 1 FROM pagamento_manobrista_comprovante c WHERE c.pagamento_id = p.id) AS tem_comprovante
            """;

    private final JdbcClient jdbc;

    public PagamentoManobristaConsultas(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public Pagina<Candidato> candidatos(Filtro filtro, int pagina, int tamanho, LocalDate hoje, AcessoUnidades acesso) {
        var busca = new Consulta(CANDIDATOS, filtro, "f.data", "m.id", "m.nome", "f.unidade_id", acesso);
        busca.params.put("hoje", hoje);
        return busca.paginar(SELECIONAR_CANDIDATO, "f.data DESC, f.id DESC, m.id", Candidato.class, pagina, tamanho);
    }

    public Optional<Candidato> candidato(long ficha, long manobrista, LocalDate hoje) {
        return jdbc.sql(SELECIONAR_CANDIDATO + CANDIDATOS + " AND f.id = :ficha AND m.id = :manobrista")
                .param("ficha", ficha).param("manobrista", manobrista).param("hoje", hoje).query(Candidato.class).optional();
    }

    public Pagina<Diaria> diarias(Filtro filtro, int pagina, int tamanho, AcessoUnidades acesso) {
        var busca = new Consulta(DIARIAS + " WHERE 1 = 1", filtro, "d.data_trabalho", "m.id", "m.nome", "d.unidade_id", acesso);
        if (filtro.situacao() != null) busca.adicionar(SITUACAO + " = :situacao", "situacao", filtro.situacao().name());
        String colunas = """
                SELECT d.id, d.ficha_id, m.id AS manobrista_id, m.nome AS manobrista, u.nome AS unidade,
                       d.data_trabalho AS data, d.custo, d.valor AS devido,
                       CASE WHEN p.id IS NULL THEN 0 ELSE d.valor END AS pago,
                       CASE WHEN p.id IS NULL THEN d.valor ELSE 0 END AS saldo, p.id AS pagamento_id,
                       p.data_pagamento, d.revisao,
                """;
        return busca.paginar(colunas + SITUACAO + " AS situacao ", "d.data_trabalho DESC, d.id DESC", Diaria.class, pagina, tamanho);
    }

    public Resumo resumo(Filtro filtro, AcessoUnidades acesso) {
        var pendentes = new Consulta(DIARIAS + " WHERE p.id IS NULL", filtro,
                "d.data_trabalho", "m.id", "m.nome", "d.unidade_id", acesso);
        var pagos = new Consulta(DIARIAS + " WHERE p.id IS NOT NULL", filtro,
                "p.data_pagamento", "m.id", "p.manobrista_nome", "d.unidade_id", acesso);

        Total aPagar = pendentes.sql("SELECT COALESCE(SUM(d.valor), 0) AS valor, COUNT(DISTINCT m.id) AS quantidade ")
                .query(Total.class).single();
        Total totalPago = pagos.sql("SELECT COALESCE(SUM(d.valor), 0) AS valor, COUNT(DISTINCT p.id) AS quantidade ")
                .query(Total.class).single();

        var unidades = new TreeMap<String, Valores>();
        for (ValorUnidade linha : porUnidade(pendentes)) {
            unidades.computeIfAbsent(linha.unidade(), k -> new Valores()).pendente = linha.valor();
        }
        for (ValorUnidade linha : porUnidade(pagos)) {
            unidades.computeIfAbsent(linha.unidade(), k -> new Valores()).pago = linha.valor();
        }
        var meses = new TreeMap<Integer, Valores>(Comparator.reverseOrder());
        for (ValorMes linha : porMes(pendentes, "d.data_trabalho")) {
            meses.computeIfAbsent(linha.ano() * 100 + linha.mes(), k -> new Valores()).pendente = linha.valor();
        }
        for (ValorMes linha : porMes(pagos, "p.data_pagamento")) {
            meses.computeIfAbsent(linha.ano() * 100 + linha.mes(), k -> new Valores()).pago = linha.valor();
        }

        var pendencias = pendentes.sql("""
                SELECT m.id AS manobrista_id, m.nome AS manobrista, u.id AS unidade_id, u.nome AS unidade,
                       COUNT(*) AS diarias, SUM(d.valor) AS saldo
                """, " GROUP BY m.id, m.nome, u.id, u.nome ORDER BY m.nome, m.id, u.nome")
                .query(Pendencia.class).list();
        return new Resumo(aPagar.valor(), totalPago.valor(), aPagar.quantidade(), totalPago.quantidade(),
                unidades.entrySet().stream().map(e -> new PorUnidade(e.getKey(), e.getValue().pendente, e.getValue().pago)).toList(),
                meses.entrySet().stream().map(e -> new PorMes(e.getKey() / 100, e.getKey() % 100,
                        e.getValue().pendente, e.getValue().pago)).toList(), pendencias);
    }

    private List<ValorUnidade> porUnidade(Consulta consulta) {
        return consulta.sql("SELECT u.nome AS unidade, SUM(d.valor) AS valor ", " GROUP BY u.nome")
                .query(ValorUnidade.class).list();
    }

    private List<ValorMes> porMes(Consulta consulta, String campo) {
        String ano = "EXTRACT(YEAR FROM " + campo + ")";
        String mes = "EXTRACT(MONTH FROM " + campo + ")";
        return consulta.sql("SELECT " + ano + " AS ano, " + mes + " AS mes, SUM(d.valor) AS valor ",
                " GROUP BY " + ano + ", " + mes).query(ValorMes.class).list();
    }

    public Pagina<Pagamento> historico(Filtro filtro, int pagina, int tamanho, AcessoUnidades acesso) {
        var busca = new Consulta(HISTORICO + " WHERE 1 = 1", filtro,
                "p.data_pagamento", "p.manobrista_id", "p.manobrista_nome", null, acesso);
        if (!acesso.todas() && !acesso.unidades().isEmpty()) busca.adicionar("""
                NOT EXISTS (SELECT 1 FROM pagamento_manobrista_item i JOIN diaria_a_pagar d ON d.id = i.diaria_id
                            WHERE i.pagamento_id = p.id AND d.unidade_id NOT IN (:escopo))
                """, "escopo", acesso.unidades());
        if (filtro.unidadeId() != null) busca.adicionar("""
                EXISTS (SELECT 1 FROM pagamento_manobrista_item i JOIN diaria_a_pagar d ON d.id = i.diaria_id
                        WHERE i.pagamento_id = p.id AND d.unidade_id = :unidade)
                """, "unidade", filtro.unidadeId());
        if (filtro.situacao() == Situacao.PAGO) busca.where.append(" AND p.estornado_em IS NULL");
        if (filtro.situacao() == Situacao.ESTORNADO) busca.where.append(" AND p.estornado_em IS NOT NULL");
        var registros = busca.paginar(SELECIONAR_PAGAMENTO, "p.data_pagamento DESC, p.id DESC", Registro.class, pagina, tamanho);
        return new Pagina<>(comItens(registros.itens()), registros.total(), pagina, tamanho);
    }

    public Optional<Pagamento> pagamento(long id) {
        var registros = jdbc.sql(SELECIONAR_PAGAMENTO + HISTORICO + " WHERE p.id = :id")
                .param("id", id).query(Registro.class).list();
        return comItens(registros).stream().findFirst();
    }

    private List<Pagamento> comItens(List<Registro> registros) {
        if (registros.isEmpty()) return List.of();
        Map<Long, List<Item>> itens = new HashMap<>();
        jdbc.sql("""
                SELECT i.pagamento_id, d.id, d.ficha_id, i.unidade_nome, d.data_trabalho, d.valor
                FROM pagamento_manobrista_item i JOIN diaria_a_pagar d ON d.id = i.diaria_id
                WHERE i.pagamento_id IN (:ids) ORDER BY d.data_trabalho, d.id
                """).param("ids", registros.stream().map(Registro::id).toList())
                .query((rs, linha) -> {
                    itens.computeIfAbsent(rs.getLong("pagamento_id"), k -> new ArrayList<>())
                            .add(new Item(rs.getLong("id"), rs.getLong("ficha_id"), rs.getString("unidade_nome"),
                                    rs.getObject("data_trabalho", LocalDate.class), rs.getBigDecimal("valor")));
                    return linha;
                }).list();
        return registros.stream().map(p -> new Pagamento(p.id(), p.manobrista(), p.manobristaId(), p.data(), p.valor(),
                p.forma(), p.confirmador(), p.confirmadoEm(), p.temComprovante(), p.estornador(), p.estornadoEm(),
                p.motivoEstorno(), itens.getOrDefault(p.id(), List.of()))).toList();
    }

    private record Total(BigDecimal valor, long quantidade) {}
    private record ValorUnidade(String unidade, BigDecimal valor) {}
    private record ValorMes(int ano, int mes, BigDecimal valor) {}
    private record Registro(long id, String manobrista, long manobristaId, LocalDate data, BigDecimal valor,
                            Forma forma, String confirmador, OffsetDateTime confirmadoEm, boolean temComprovante,
                            String estornador, OffsetDateTime estornadoEm, String motivoEstorno) {}

    private static final class Valores {
        private BigDecimal pendente = BigDecimal.ZERO;
        private BigDecimal pago = BigDecimal.ZERO;
    }

    private final class Consulta {
        private final StringBuilder where;
        private final Map<String, Object> params = new HashMap<>();

        private Consulta(String from, Filtro filtro, String data, String id, String nome, String unidade, AcessoUnidades acesso) {
            if (filtro.inicio() != null && filtro.fim() != null && filtro.inicio().isAfter(filtro.fim())) {
                throw new RegraInvalidaException("A data inicial deve ser anterior ou igual à data final.");
            }
            where = new StringBuilder(from);
            if (filtro.unidadeId() != null) acesso.exigir(filtro.unidadeId());
            if (!acesso.todas()) {
                if (acesso.unidades().isEmpty()) where.append(" AND 1 = 0");
                else if (unidade != null) adicionar(unidade + " IN (:escopo)", "escopo", acesso.unidades());
            }
            if (filtro.inicio() != null) adicionar(data + " >= :inicio", "inicio", filtro.inicio());
            if (filtro.fim() != null) adicionar(data + " <= :fim", "fim", filtro.fim());
            if (filtro.manobristaId() != null) adicionar(id + " = :manobrista", "manobrista", filtro.manobristaId());
            if (filtro.unidadeId() != null && unidade != null) adicionar(unidade + " = :unidade", "unidade", filtro.unidadeId());
            if (filtro.busca() != null && !filtro.busca().isBlank()) {
                adicionar("POSITION(:busca IN LOWER(" + nome + ")) > 0", "busca", filtro.busca().strip().toLowerCase(Locale.ROOT));
            }
        }

        private void adicionar(String clausula, String chave, Object valor) {
            where.append(" AND ").append(clausula);
            params.put(chave, valor);
        }

        private JdbcClient.StatementSpec sql(String select) {
            return sql(select, "");
        }

        private JdbcClient.StatementSpec sql(String select, String sufixo) {
            return jdbc.sql(select + where + sufixo).params(params);
        }

        private <T> Pagina<T> paginar(String select, String ordem, Class<T> tipo, int pagina, int tamanho) {
            long total = sql("SELECT COUNT(*) ").query(Long.class).single();
            var itens = sql(select, " ORDER BY " + ordem + " LIMIT :limite OFFSET :offset")
                    .param("limite", tamanho).param("offset", (long) pagina * tamanho).query(tipo).list();
            return new Pagina<>(itens, total, pagina, tamanho);
        }
    }
}
