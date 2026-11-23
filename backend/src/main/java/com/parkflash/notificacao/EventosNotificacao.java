package com.parkflash.notificacao;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Types;
import java.util.Collection;

@Component
public class EventosNotificacao {
    private final JdbcClient jdbc;

    public EventosNotificacao(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void registrar(CategoriaNotificacao categoria, String ocorrencia, long destino,
                          Long referencia, Collection<Long> unidades) {
        if (unidades.isEmpty()) throw new IllegalArgumentException("Evento sem unidade.");
        var id = jdbc.sql("""
                INSERT INTO notificacao_evento (chave, categoria, destino_id, referencia_id)
                VALUES (:chave, :categoria, :destino, :referencia) ON CONFLICT DO NOTHING
                """).param("chave", categoria.name() + ":" + ocorrencia).param("categoria", categoria.name())
                .param("destino", destino).param("referencia", referencia, Types.BIGINT).update();
        if (id == 0) return;
        for (Long unidade : unidades.stream().distinct().toList()) {
            jdbc.sql("""
                    INSERT INTO notificacao_evento_unidade (evento_id, unidade_id)
                    SELECT id, :unidade FROM notificacao_evento WHERE chave = :chave
                    """).param("chave", categoria.name() + ":" + ocorrencia).param("unidade", unidade).update();
        }
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void registrar(CategoriaNotificacao categoria, long destino, long unidade) {
        registrar(categoria, Long.toString(destino), destino, null, java.util.List.of(unidade));
    }
}
