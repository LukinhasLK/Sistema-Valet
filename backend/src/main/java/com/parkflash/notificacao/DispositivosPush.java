package com.parkflash.notificacao;

import com.parkflash.erro.ConflitoException;
import com.parkflash.erro.RegraInvalidaException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URI;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class DispositivosPush {
    private final JdbcClient jdbc;
    private final TransportePush transporte;

    public DispositivosPush(JdbcClient jdbc, TransportePush transporte) {
        this.jdbc = jdbc;
        this.transporte = transporte;
    }

    @Transactional
    public void inscrever(long usuario, UUID dispositivo, String endpoint, String chavePublica) {
        if (!transporte.configurado()) throw new RegraInvalidaException("O envio push não está configurado neste ambiente.");
        if (!chavePublica.equals(transporte.chavePublica())) {
            throw new ConflitoException("A chave do push mudou. Atualize as preferências e tente novamente.");
        }
        try {
            if (!TransportePush.permitido(URI.create(endpoint))) throw new IllegalArgumentException();
        } catch (IllegalArgumentException ex) {
            throw new RegraInvalidaException("O navegador informou um endereço push não aceito.");
        }
        jdbc.sql("SELECT id FROM usuario WHERE id = :usuario FOR UPDATE").param("usuario", usuario).query(Long.class).single();
        var existente = jdbc.sql("SELECT endpoint, chave_publica FROM push_dispositivo WHERE usuario_id = :usuario AND dispositivo = :dispositivo")
                .param("usuario", usuario).param("dispositivo", dispositivo.toString()).query(InscricaoAtual.class).optional();
        if (existente.filter(i -> endpoint.equals(i.endpoint()) && chavePublica.equals(i.chavePublica())).isPresent()) {
            jdbc.sql("UPDATE push_dispositivo SET atualizado_em = CURRENT_TIMESTAMP WHERE usuario_id = :usuario AND dispositivo = :dispositivo")
                    .param("usuario", usuario).param("dispositivo", dispositivo.toString()).update();
            return;
        }
        if (existente.isPresent()) remover(usuario, dispositivo);
        int criado = jdbc.sql("""
                INSERT INTO push_dispositivo (usuario_id, dispositivo, endpoint, chave_publica) VALUES (:usuario, :dispositivo, :endpoint, :chave)
                ON CONFLICT DO NOTHING
                """).param("usuario", usuario).param("dispositivo", dispositivo.toString()).param("endpoint", endpoint).param("chave", chavePublica).update();
        if (criado == 0) throw new ConflitoException("A inscrição pertence a outro dispositivo ou sessão. Desative e ative o push novamente.");
    }

    @Transactional
    public void remover(long usuario, UUID dispositivo) {
        jdbc.sql("DELETE FROM push_dispositivo WHERE usuario_id = :usuario AND dispositivo = :dispositivo")
                .param("usuario", usuario).param("dispositivo", dispositivo.toString()).update();
    }

    public boolean inscrito(long usuario, UUID dispositivo) {
        if (dispositivo == null || !transporte.configurado()) return false;
        return jdbc.sql("SELECT EXISTS (SELECT 1 FROM push_dispositivo WHERE usuario_id = :usuario AND dispositivo = :dispositivo AND chave_publica = :chave)")
                .param("usuario", usuario).param("dispositivo", dispositivo.toString()).param("chave", transporte.chavePublica()).query(Boolean.class).single();
    }

    public List<Diagnostico> diagnostico(long usuario) {
        return jdbc.sql("""
                SELECT p.estado, p.tentativas, p.codigo, p.atualizado_em
                FROM push_entrega p JOIN notificacao n ON n.id = p.notificacao_id
                JOIN notificacao_evento e ON e.id = n.evento_id JOIN usuario u ON u.id = n.usuario_id
                WHERE n.usuario_id = :usuario AND
                """ + CaixaNotificacoes.VISIVEL + " ORDER BY p.atualizado_em DESC, p.id DESC LIMIT 15")
                .param("usuario", usuario).query(Diagnostico.class).list();
    }

    @Transactional
    public String reservarTeste(long usuario, UUID dispositivo) {
        jdbc.sql("SELECT id FROM usuario WHERE id = :usuario FOR UPDATE").param("usuario", usuario).query(Long.class).single();
        String endpoint = jdbc.sql("""
                SELECT endpoint FROM push_dispositivo
                WHERE usuario_id = :usuario AND dispositivo = :dispositivo AND chave_publica = :chave
                """).param("usuario", usuario).param("dispositivo", dispositivo.toString())
                .param("chave", transporte.chavePublica()).query(String.class).optional()
                .orElseThrow(() -> new ConflitoException("A inscrição deste dispositivo expirou. Ative o push novamente."));
        var agora = FilaNotificacoes.agora();
        var anterior = jdbc.sql("SELECT tentado_em FROM push_teste_usuario WHERE usuario_id = :usuario")
                .param("usuario", usuario).query(OffsetDateTime.class).optional();
        if (anterior.filter(data -> data.isAfter(agora.minusSeconds(30))).isPresent()) {
            throw new ConflitoException("Aguarde 30 segundos entre avisos de teste.");
        }
        String sql = anterior.isPresent() ? "UPDATE push_teste_usuario SET tentado_em = :agora WHERE usuario_id = :usuario"
                : "INSERT INTO push_teste_usuario (usuario_id, tentado_em) VALUES (:usuario, :agora)";
        jdbc.sql(sql).param("usuario", usuario).param("agora", agora).update();
        return endpoint;
    }

    public void removerExpirada(long usuario, UUID dispositivo, String endpoint) {
        jdbc.sql("DELETE FROM push_dispositivo WHERE usuario_id = :usuario AND dispositivo = :dispositivo AND endpoint = :endpoint")
                .param("usuario", usuario).param("dispositivo", dispositivo.toString()).param("endpoint", endpoint).update();
    }

    private record InscricaoAtual(String endpoint, String chavePublica) {}

    public record Diagnostico(String estado, int tentativas, String codigo, OffsetDateTime atualizadoEm) {}
}
