package com.parkflash.servico;

import com.parkflash.erro.ConflitoException;
import com.parkflash.erro.NaoEncontradoException;
import com.parkflash.erro.RegraInvalidaException;
import com.parkflash.seguranca.AcessoUnidades;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Service
public class EventoFinanceiroService {
    public enum Registro {
        FICHA("ficha", "r.situacao = 'FECHADA'", "r.total_liquido",
                "CASE WHEN r.turno = 'DIA' THEN 'Ficha · dia' ELSE 'Ficha · noite' END"),
        DESPESA("despesa", "r.cancelada = FALSE", "r.valor", "r.descricao");

        private final String tabela;
        private final String elegivel;
        private final String valor;
        private final String descricao;

        Registro(String tabela, String elegivel, String valor, String descricao) {
            this.tabela = tabela;
            this.elegivel = elegivel;
            this.valor = valor;
            this.descricao = descricao;
        }

        String vinculos() { return "evento_" + tabela; }
        String chave() { return tabela + "_id"; }
    }

    public record Item(long id, LocalDate data, String descricao, BigDecimal valor, boolean vinculado,
                       boolean elegivel) {}
    public record Total(BigDecimal valor, long validos, long vinculados) {}
    public record Conciliacao(Total fichas, Total despesas, BigDecimal resultado,
                             List<Item> itens, boolean mais, boolean cancelado) {}
    private record EventoBase(long id, long unidadeId, LocalDateTime inicio, LocalDateTime fim, String situacao) {}

    private static final int TAMANHO = 25;
    private static final String PERIODO = "r.unidade_id = :unidade AND r.data BETWEEN :inicio AND :fim";
    private final JdbcClient jdbc;

    public EventoFinanceiroService(JdbcClient jdbc) { this.jdbc = jdbc; }

    @Transactional(readOnly = true, isolation = org.springframework.transaction.annotation.Isolation.REPEATABLE_READ)
    public Conciliacao consultar(long id, Registro tipo, int pagina, AcessoUnidades acesso) {
        var evento = evento(id, false, acesso);
        var fichas = total(evento, Registro.FICHA);
        var despesas = total(evento, Registro.DESPESA);
        String valido = PERIODO + " AND " + tipo.elegivel;
        String sql = """
                SELECT r.id, CASE WHEN r.unidade_id = :unidade THEN r.data END AS data,
                       CASE WHEN r.unidade_id = :unidade THEN %s ELSE 'Registro fora da unidade' END AS descricao,
                       CASE WHEN r.unidade_id = :unidade THEN %s END AS valor,
                       v.evento_id IS NOT NULL AS vinculado, (%s) AS elegivel
                FROM %s r LEFT JOIN %s v ON v.%s = r.id
                WHERE v.evento_id = :evento OR (v.evento_id IS NULL AND %s)
                ORDER BY vinculado DESC, data DESC NULLS LAST, r.id DESC
                LIMIT :limite OFFSET :offset
                """.formatted(tipo.descricao, tipo.valor, valido, tipo.tabela, tipo.vinculos(), tipo.chave(), valido);
        var itens = escopo(sql, evento).param("limite", TAMANHO + 1).param("offset", (long) pagina * TAMANHO)
                .query(Item.class).list();
        boolean mais = itens.size() > TAMANHO;
        return new Conciliacao(fichas, despesas, fichas.valor().subtract(despesas.valor()),
                mais ? itens.subList(0, TAMANHO) : itens, mais, evento.situacao().equals("CANCELADO"));
    }

    @Transactional
    public void vincular(long id, Registro tipo, long registro, AcessoUnidades acesso) {
        var evento = evento(id, true, acesso);
        if (evento.situacao().equals("CANCELADO")) throw new ConflitoException("O evento está cancelado.");
        String elegivel = "SELECT r.id FROM " + tipo.tabela + " r WHERE r.id = :registro AND "
                + PERIODO + " AND " + tipo.elegivel + " FOR UPDATE";
        boolean valido = jdbc.sql(elegivel).param("registro", registro).param("unidade", evento.unidadeId())
                .param("inicio", evento.inicio().toLocalDate()).param("fim", evento.fim().toLocalDate())
                .query(Long.class).optional().isPresent();
        if (!valido) throw new RegraInvalidaException("Selecione um registro elegível da unidade e do período do evento.");
        Long atual = jdbc.sql("SELECT evento_id FROM " + tipo.vinculos() + " WHERE " + tipo.chave() + " = :registro")
                .param("registro", registro).query(Long.class).optional().orElse(null);
        if (atual != null && atual != id) throw new ConflitoException("O registro já está vinculado a outro evento.");
        if (atual == null) jdbc.sql("INSERT INTO " + tipo.vinculos() + " (" + tipo.chave() + ", evento_id) VALUES (:registro, :evento)")
                .param("registro", registro).param("evento", id).update();
    }

    @Transactional
    public void desvincular(long id, Registro tipo, long registro, AcessoUnidades acesso) {
        evento(id, true, acesso);
        jdbc.sql("DELETE FROM " + tipo.vinculos() + " WHERE evento_id = :evento AND " + tipo.chave() + " = :registro")
                .param("evento", id).param("registro", registro).update();
    }

    private Total total(EventoBase evento, Registro tipo) {
        String valido = PERIODO + " AND " + tipo.elegivel;
        String sql = """
                SELECT COALESCE(SUM(CASE WHEN %s THEN %s END), 0) AS valor,
                       COUNT(CASE WHEN %s THEN 1 END) AS validos, COUNT(*) AS vinculados
                FROM %s v JOIN %s r ON v.%s = r.id WHERE v.evento_id = :evento
                """.formatted(valido, tipo.valor, valido, tipo.vinculos(), tipo.tabela, tipo.chave());
        return escopo(sql, evento).query(Total.class).single();
    }

    private JdbcClient.StatementSpec escopo(String sql, EventoBase evento) {
        return jdbc.sql(sql).param("evento", evento.id()).param("unidade", evento.unidadeId())
                .param("inicio", evento.inicio().toLocalDate()).param("fim", evento.fim().toLocalDate());
    }

    private EventoBase evento(long id, boolean bloquear, AcessoUnidades acesso) {
        var evento = jdbc.sql("SELECT id, unidade_id, inicio, fim, situacao FROM evento WHERE id = :id"
                        + (bloquear ? " FOR UPDATE" : ""))
                .param("id", id).query(EventoBase.class).optional()
                .orElseThrow(() -> new NaoEncontradoException("Evento não encontrado."));
        acesso.exigir(evento.unidadeId());
        return evento;
    }
}
