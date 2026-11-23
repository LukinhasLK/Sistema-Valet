package com.parkflash.servico;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;

import java.sql.Types;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Objects;

@Service
public class AuditoriaAdministrativa {
    public enum Tipo { UNIDADE, USUARIO }
    public record Alteracao(long id, String ator, String campo, String anterior, String atual,
                            OffsetDateTime registradoEm) {}
    public record Pagina(List<Alteracao> itens, Long proximo) {}

    private static final int TAMANHO = 25;
    private final JdbcClient jdbc;

    public AuditoriaAdministrativa(JdbcClient jdbc) { this.jdbc = jdbc; }

    public void registrar(Tipo tipo, long id, long ator, String campo, String anterior, String atual) {
        if (Objects.equals(anterior, atual)) return;
        jdbc.sql("""
                INSERT INTO auditoria_administrativa (tipo, recurso_id, ator_id, campo, anterior, atual)
                VALUES (:tipo, :id, :ator, :campo, :anterior, :atual)
                """).param("tipo", tipo.name()).param("id", id).param("ator", ator).param("campo", campo)
                .param("anterior", anterior, Types.VARCHAR).param("atual", atual, Types.VARCHAR).update();
    }

    public Pagina consultar(Tipo tipo, long id, Long antes) {
        var itens = jdbc.sql("""
                SELECT a.id, u.nome AS ator, a.campo, a.anterior, a.atual, a.registrado_em
                FROM auditoria_administrativa a JOIN usuario u ON u.id = a.ator_id
                WHERE a.tipo = :tipo AND a.recurso_id = :id AND a.id < :antes
                ORDER BY a.id DESC LIMIT :limite
                """).param("tipo", tipo.name()).param("id", id)
                .param("antes", Objects.requireNonNullElse(antes, Long.MAX_VALUE)).param("limite", TAMANHO + 1)
                .query(Alteracao.class).list();
        return itens.size() > TAMANHO ? new Pagina(itens.subList(0, TAMANHO), itens.get(TAMANHO - 1).id())
                : new Pagina(itens, null);
    }
}
