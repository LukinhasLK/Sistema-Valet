package com.parkflash.notificacao;

import com.parkflash.servico.PagamentoManobristaService;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
public class LembretesEventos {
    private final JdbcClient jdbc;
    private final EventosNotificacao eventos;

    public LembretesEventos(JdbcClient jdbc, EventosNotificacao eventos) {
        this.jdbc = jdbc;
        this.eventos = eventos;
    }

    @Transactional
    public void registrarProximos() {
        registrarProximos(LocalDateTime.now(PagamentoManobristaService.FUSO_NEGOCIO));
    }

    void registrarProximos(LocalDateTime agora) {
        jdbc.sql("""
                SELECT a.id, a.unidade_id FROM evento a
                WHERE a.situacao IN ('PLANEJADO', 'CONFIRMADO') AND a.inicio > :agora AND a.inicio <= :limite
                AND NOT EXISTS (SELECT 1 FROM notificacao_evento e
                    WHERE e.chave = CONCAT('EVENTO_PROXIMO:', CAST(a.id AS VARCHAR)))
                ORDER BY a.inicio, a.id LIMIT 50 FOR UPDATE SKIP LOCKED
                """).param("agora", agora).param("limite", agora.plusHours(24))
                .query(Proximo.class).list().forEach(a -> eventos.registrar(CategoriaNotificacao.EVENTO_PROXIMO, a.id(), a.unidadeId()));
    }

    private record Proximo(long id, long unidadeId) {}
}
