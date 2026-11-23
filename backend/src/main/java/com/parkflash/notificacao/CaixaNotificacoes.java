package com.parkflash.notificacao;

import com.parkflash.erro.NaoEncontradoException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

@Service
public class CaixaNotificacoes {
    // Exige cobertura integral das unidades para um gerente, inclusive pagamentos multiunidade.
    static final String VISIVEL = """
            u.ativo = TRUE AND u.nivel IN ('PROPRIETARIO', 'GERENTE')
            AND (u.nivel = 'PROPRIETARIO' OR NOT EXISTS (
                SELECT 1 FROM notificacao_evento_unidade nu WHERE nu.evento_id = e.id
                AND NOT EXISTS (SELECT 1 FROM usuario_unidade uu
                      WHERE uu.usuario_id = u.id AND uu.unidade_id = nu.unidade_id)))
            """;
    private static final String CAIXA = """
             FROM notificacao n JOIN notificacao_evento e ON e.id = n.evento_id
             JOIN usuario u ON u.id = n.usuario_id WHERE n.usuario_id = :usuario AND
            """ + VISIVEL;
    private final JdbcClient jdbc;

    public CaixaNotificacoes(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Transactional(readOnly = true)
    public List<Item> listar(long usuario, Long antes, boolean naoLidas) {
        String consulta = """
                SELECT n.id, e.categoria, e.destino_id, e.criado_em, n.lida_em
                """ + CAIXA
                + (antes == null ? "" : " AND n.id < :antes")
                + (naoLidas ? " AND n.lida_em IS NULL" : "") + " ORDER BY n.id DESC LIMIT 30";
        var pedido = jdbc.sql(consulta).param("usuario", usuario);
        if (antes != null) pedido.param("antes", antes);
        return pedido.query(Linha.class).list().stream()
                .map(l -> new Item(l.id(), l.categoria(), l.categoria().titulo(), l.categoria().destino(),
                        l.destinoId(), l.criadoEm(), l.lidaEm() != null)).toList();
    }

    public long pendentes(long usuario) {
        return jdbc.sql("SELECT COUNT(*)" + CAIXA + " AND n.lida_em IS NULL")
                .param("usuario", usuario).query(Long.class).single();
    }

    @Transactional
    public void ler(long usuario, Long id) {
        String filtro = CAIXA + (id == null ? "" : " AND n.id = :id");
        if (id != null && !jdbc.sql("SELECT EXISTS(SELECT 1" + filtro + ")")
                .param("usuario", usuario).param("id", id).query(Boolean.class).single()) {
            throw new NaoEncontradoException("Notificação não encontrada.");
        }
        var comando = jdbc.sql("""
                UPDATE notificacao SET lida_em = CURRENT_TIMESTAMP WHERE lida_em IS NULL
                AND id IN (SELECT n.id
                """ + filtro + ")").param("usuario", usuario);
        if (id != null) comando.param("id", id);
        comando.update();
    }

    public List<Preferencia> preferencias(long usuario) {
        var linhas = jdbc.sql("SELECT categoria, ativa FROM notificacao_preferencia WHERE usuario_id = :usuario")
                .param("usuario", usuario).query(Preferencia.class).list();
        Map<CategoriaNotificacao, Boolean> registradas = new java.util.EnumMap<>(CategoriaNotificacao.class);
        linhas.forEach(p -> registradas.put(p.categoria(), p.ativa()));
        return java.util.Arrays.stream(CategoriaNotificacao.values())
                .map(c -> new Preferencia(c, registradas.getOrDefault(c, true))).toList();
    }

    @Transactional
    public void preferir(long usuario, CategoriaNotificacao categoria, boolean ativa) {
        jdbc.sql("SELECT id FROM usuario WHERE id = :usuario FOR UPDATE").param("usuario", usuario).query(Long.class).single();
        int alteradas = jdbc.sql("""
                UPDATE notificacao_preferencia SET ativa = :ativa WHERE usuario_id = :usuario AND categoria = :categoria
                """).param("ativa", ativa).param("usuario", usuario).param("categoria", categoria.name()).update();
        if (alteradas == 0) jdbc.sql("INSERT INTO notificacao_preferencia VALUES (:usuario, :categoria, :ativa)")
                .param("usuario", usuario).param("categoria", categoria.name()).param("ativa", ativa).update();
    }

    private record Linha(long id, CategoriaNotificacao categoria, long destinoId,
                         OffsetDateTime criadoEm, OffsetDateTime lidaEm) {}
    public record Item(long id, CategoriaNotificacao categoria, String titulo, String destino, long destinoId,
                       OffsetDateTime criadoEm, boolean lida) {}
    public record Preferencia(CategoriaNotificacao categoria, boolean ativa) {}
}
