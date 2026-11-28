package com.parkflash.notificacao;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Types;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Optional;

@Service
public class FilaNotificacoes {
    static final int MAX_TENTATIVAS = 4;
    private final JdbcClient jdbc;

    public FilaNotificacoes(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Transactional
    public int distribuir() {
        var lote = jdbc.sql("""
                SELECT id, categoria, referencia_id FROM notificacao_evento WHERE processado_em IS NULL
                ORDER BY id LIMIT 30 FOR UPDATE SKIP LOCKED
                """).query(Evento.class).list();
        for (Evento evento : lote) {
            if (!obrigacaoLiquidada(evento)) {
                jdbc.sql("""
                        INSERT INTO notificacao (evento_id, usuario_id)
                        SELECT e.id, u.id FROM notificacao_evento e CROSS JOIN usuario u
                        LEFT JOIN notificacao_preferencia pref ON pref.usuario_id = u.id AND pref.categoria = e.categoria
                        WHERE e.id = :id AND COALESCE(pref.ativa, TRUE) AND
                        """ + CaixaNotificacoes.VISIVEL + " ON CONFLICT DO NOTHING")
                        .param("id", evento.id()).update();
                jdbc.sql("""
                        INSERT INTO push_entrega (notificacao_id, dispositivo_id)
                        SELECT n.id, p.id FROM notificacao n JOIN push_dispositivo p ON p.usuario_id = n.usuario_id
                        WHERE n.evento_id = :id ON CONFLICT DO NOTHING
                        """).param("id", evento.id()).update();
            }
            jdbc.sql("UPDATE notificacao_evento SET processado_em = CURRENT_TIMESTAMP WHERE id = :id")
                    .param("id", evento.id()).update();
        }
        return lote.size();
    }

    private boolean obrigacaoLiquidada(Evento evento) {
        return evento.categoria() == CategoriaNotificacao.PAGAMENTO_PENDENTE
                && !jdbc.sql("SELECT EXISTS (SELECT 1 FROM diaria_a_pagar WHERE id = :id AND pagamento_ativo_id IS NULL)")
                .param("id", evento.referenciaId()).query(Boolean.class).single();
    }

    @Transactional
    public Optional<Entrega> buscarProxima(String chavePublica) {
        var fila = jdbc.sql("""
                SELECT id, tentativas FROM push_entrega WHERE estado IN ('PENDENTE', 'ENVIANDO')
                AND tentar_em <= CURRENT_TIMESTAMP ORDER BY tentar_em, id LIMIT 1 FOR UPDATE SKIP LOCKED
                """).query(Tarefa.class).optional();
        if (fila.isEmpty()) return Optional.empty();
        Tarefa tarefa = fila.get();
        if (tarefa.tentativas() >= MAX_TENTATIVAS) {
            encerrar(tarefa.id(), "FALHOU", "LIMITE_TENTATIVAS");
            return Optional.of(Entrega.ignorada());
        }

        var destino = jdbc.sql("""
                SELECT p.id AS dispositivo_id, p.endpoint
                FROM push_entrega d JOIN push_dispositivo p ON p.id = d.dispositivo_id
                JOIN notificacao n ON n.id = d.notificacao_id AND p.usuario_id = n.usuario_id
                JOIN notificacao_evento e ON e.id = n.evento_id JOIN usuario u ON u.id = n.usuario_id
                LEFT JOIN notificacao_preferencia pref ON pref.usuario_id = u.id AND pref.categoria = e.categoria
                WHERE d.id = :id AND p.chave_publica = :chave AND n.lida_em IS NULL AND e.criado_em > :validade
                AND (e.categoria <> 'PAGAMENTO_PENDENTE' OR EXISTS (
                    SELECT 1 FROM diaria_a_pagar x WHERE x.id = e.referencia_id AND x.pagamento_ativo_id IS NULL))
                AND COALESCE(pref.ativa, TRUE) AND
                """ + CaixaNotificacoes.VISIVEL)
                .param("id", tarefa.id()).param("chave", chavePublica).param("validade", agora().minusHours(24))
                .query(Destino.class).optional();

        if (destino.isEmpty()) {
            encerrar(tarefa.id(), "CANCELADA", "SEM_DISPOSITIVO_OU_FORA_DO_RECORTE");
            return Optional.of(Entrega.ignorada());
        }
        jdbc.sql("""
                UPDATE push_entrega SET estado = 'ENVIANDO', tentativas = tentativas + 1,
                    tentar_em = :limite, atualizado_em = CURRENT_TIMESTAMP WHERE id = :id
                """).param("id", tarefa.id()).param("limite", agora().plusMinutes(2)).update();
        return Optional.of(new Entrega(tarefa.id(), destino.get().dispositivoId(), destino.get().endpoint(), tarefa.tentativas() + 1));
    }

    @Transactional
    public boolean concluir(Entrega tarefa, String estado, String codigo, OffsetDateTime tentarEm) {
        int atualizado = jdbc.sql("""
                UPDATE push_entrega SET estado = :estado, codigo = :codigo, tentar_em = :tentarEm,
                    atualizado_em = CURRENT_TIMESTAMP
                WHERE id = :id AND estado = 'ENVIANDO' AND tentativas = :tentativas
                """).param("estado", estado).param("codigo", codigo, Types.VARCHAR)
                .param("tentarEm", tentarEm).param("id", tarefa.id()).param("tentativas", tarefa.tentativas()).update();
        if (atualizado == 1 && estado.equals("EXPIRADA")) {
            jdbc.sql("DELETE FROM push_dispositivo WHERE id = :id").param("id", tarefa.dispositivoId()).update();
        }
        return atualizado == 1;
    }

    private void encerrar(long id, String estado, String codigo) {
        jdbc.sql("UPDATE push_entrega SET estado = :estado, codigo = :codigo, atualizado_em = CURRENT_TIMESTAMP WHERE id = :id")
                .param("id", id).param("estado", estado).param("codigo", codigo).update();
    }

    static OffsetDateTime agora() { return OffsetDateTime.now(ZoneOffset.UTC); }

    private record Evento(long id, CategoriaNotificacao categoria, Long referenciaId) {}
    private record Destino(long dispositivoId, String endpoint) {}
    private record Tarefa(long id, int tentativas) {}
    public record Entrega(long id, long dispositivoId, String endpoint, int tentativas) {
        static Entrega ignorada() { return new Entrega(0, 0, null, 0); }
    }
}
