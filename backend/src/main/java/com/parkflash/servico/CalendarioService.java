package com.parkflash.servico;

import com.parkflash.dominio.NivelAcesso;
import com.parkflash.dominio.Usuario;
import com.parkflash.erro.NaoEncontradoException;
import com.parkflash.repositorio.UsuarioRepository;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Link de assinatura da agenda no formato iCalendar (RFC 5545), lido pelo Google Calendar,
 * iPhone e Outlook. O link leva um token aleatório no lugar do login; o banco guarda só o hash.
 * Mostra eventos e escalas não cancelados das unidades que o usuário já vê no sistema.
 */
@Service
public class CalendarioService {

    /** Janela publicada: o passado recente e o próximo ano. */
    static final int DIAS_ANTES = 60;
    static final int DIAS_DEPOIS = 365;

    private static final Set<NivelAcesso> PODEM_ASSINAR = Set.of(NivelAcesso.PROPRIETARIO, NivelAcesso.GERENTE);
    private static final DateTimeFormatter UTC = DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss'Z'");
    private static final SecureRandom ALEATORIO = new SecureRandom();

    private final JdbcClient jdbc;
    private final UsuarioRepository usuarios;
    private final Clock relogio;

    public CalendarioService(JdbcClient jdbc, UsuarioRepository usuarios) {
        this.jdbc = jdbc;
        this.usuarios = usuarios;
        this.relogio = Clock.systemUTC();
    }

    public record Link(boolean ativo, OffsetDateTime criadoEm) {}

    public record NovoLink(String token, OffsetDateTime criadoEm) {}

    @Transactional(readOnly = true)
    public Link link(long usuarioId) {
        return jdbc.sql("SELECT criado_em FROM agenda_link WHERE usuario_id = :id").param("id", usuarioId)
                .query(OffsetDateTime.class).optional()
                .map(criado -> new Link(true, criado)).orElse(new Link(false, null));
    }

    /** Gera um link novo. O anterior para de funcionar na hora. */
    @Transactional
    public NovoLink gerar(long usuarioId) {
        byte[] bytes = new byte[32];
        ALEATORIO.nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        OffsetDateTime agora = OffsetDateTime.now(relogio);
        jdbc.sql("DELETE FROM agenda_link WHERE usuario_id = :id").param("id", usuarioId).update();
        jdbc.sql("INSERT INTO agenda_link (usuario_id, token_hash, criado_em) VALUES (:id, :hash, :criado)")
                .param("id", usuarioId).param("hash", hash(token)).param("criado", agora).update();
        return new NovoLink(token, agora);
    }

    @Transactional
    public void revogar(long usuarioId) {
        jdbc.sql("DELETE FROM agenda_link WHERE usuario_id = :id").param("id", usuarioId).update();
    }

    /** Conteúdo .ics do link. Token desconhecido, usuário inativo ou sem acesso à agenda: 404. */
    @Transactional(readOnly = true)
    public String ics(String token) {
        Usuario usuario = jdbc.sql("SELECT usuario_id FROM agenda_link WHERE token_hash = :hash")
                .param("hash", hash(token)).query(Long.class).optional()
                .flatMap(usuarios::findById)
                .filter(Usuario::isAtivo)
                .filter(u -> PODEM_ASSINAR.contains(u.getNivel()))
                .orElseThrow(() -> new NaoEncontradoException("Link de agenda inválido ou revogado."));

        boolean todas = usuario.getNivel() == NivelAcesso.PROPRIETARIO;
        Set<Long> unidades = usuario.getUnidadeIds();
        LocalDateTime hoje = LocalDateTime.now(relogio.withZone(PagamentoManobristaService.FUSO_NEGOCIO));
        LocalDateTime de = hoje.minusDays(DIAS_ANTES);
        LocalDateTime ate = hoje.plusDays(DIAS_DEPOIS);

        List<String> itens = new ArrayList<>();
        if (todas || !unidades.isEmpty()) {
            String filtro = todas ? "" : " AND x.unidade_id IN (:unidades)";
            eventos(filtro, unidades, de, ate).forEach(e -> itens.add(vevento(e)));
            escalas(filtro, unidades, de, ate).forEach(e -> itens.add(vescala(e)));
        }
        return calendario(itens);
    }

    // ---------------------------------------------------------------- consultas

    record EventoAgenda(long id, String nome, String contratante, String local, LocalDateTime inicio, LocalDateTime fim,
                        String responsavel, String situacao, String observacoes, int veiculosPrevistos,
                        int equipePrevista, String unidade) {}

    record EscalaAgenda(long id, LocalDateTime inicio, LocalDateTime fim, String responsavel, String situacao,
                        String observacoes, String unidade, String evento, String local, List<String> equipe) {
        EscalaAgenda comEquipe(List<String> nomes) {
            return new EscalaAgenda(id, inicio, fim, responsavel, situacao, observacoes, unidade, evento, local, nomes);
        }
    }

    private List<EventoAgenda> eventos(String filtro, Set<Long> unidades, LocalDateTime de, LocalDateTime ate) {
        var consulta = jdbc.sql("""
                SELECT x.id, x.nome, x.contratante, x.local, x.inicio, x.fim, x.responsavel, x.situacao, x.observacoes,
                       x.veiculos_previstos, x.equipe_prevista, u.nome AS unidade
                FROM evento x JOIN unidade u ON u.id = x.unidade_id
                WHERE x.situacao <> 'CANCELADO' AND x.fim >= :de AND x.inicio <= :ate""" + filtro + " ORDER BY x.inicio, x.id").param("de", de).param("ate", ate);
        if (!filtro.isEmpty()) consulta = consulta.param("unidades", unidades);
        return consulta.query(EventoAgenda.class).list();
    }

    private List<EscalaAgenda> escalas(String filtro, Set<Long> unidades, LocalDateTime de, LocalDateTime ate) {
        var consulta = jdbc.sql("""
                SELECT x.id, x.inicio, x.fim, x.responsavel, x.situacao, x.observacoes, u.nome AS unidade,
                       ev.nome AS evento, ev.local AS local
                FROM escala x JOIN unidade u ON u.id = x.unidade_id LEFT JOIN evento ev ON ev.id = x.evento_id
                WHERE x.situacao <> 'CANCELADA' AND x.fim >= :de AND x.inicio <= :ate""" + filtro + " ORDER BY x.inicio, x.id").param("de", de).param("ate", ate);
        if (!filtro.isEmpty()) consulta = consulta.param("unidades", unidades);
        var linhas = consulta.query((rs, i) -> new EscalaAgenda(rs.getLong("id"),
                rs.getObject("inicio", LocalDateTime.class), rs.getObject("fim", LocalDateTime.class),
                rs.getString("responsavel"), rs.getString("situacao"), rs.getString("observacoes"),
                rs.getString("unidade"), rs.getString("evento"), rs.getString("local"), List.of())).list();
        if (linhas.isEmpty()) return linhas;

        Map<Long, List<String>> equipes = new HashMap<>();
        jdbc.sql("""
                SELECT em.escala_id, m.nome FROM escala_manobrista em JOIN manobrista m ON m.id = em.manobrista_id
                WHERE em.escala_id IN (:ids) ORDER BY m.nome""")
                .param("ids", linhas.stream().map(EscalaAgenda::id).collect(Collectors.toSet()))
                .query((rs, i) -> equipes.computeIfAbsent(rs.getLong("escala_id"), k -> new ArrayList<>()).add(rs.getString("nome")))
                .list();
        return linhas.stream().map(e -> e.comEquipe(equipes.getOrDefault(e.id(), List.of()))).toList();
    }

    // ---------------------------------------------------------------- iCalendar

    private String vevento(EventoAgenda e) {
        var descricao = new StringBuilder()
                .append("Contratante: ").append(e.contratante())
                .append("\nResponsável: ").append(e.responsavel())
                .append("\nUnidade: ").append(e.unidade())
                .append("\nVeículos previstos: ").append(e.veiculosPrevistos())
                .append("\nEquipe prevista: ").append(e.equipePrevista())
                .append("\nSituação: ").append(rotulo(e.situacao()));
        if (temTexto(e.observacoes())) descricao.append("\n\n").append(e.observacoes());
        return item("evento-" + e.id(), "Evento: " + e.nome(), e.inicio(), e.fim(), e.local(),
                descricao.toString(), e.situacao());
    }

    private String vescala(EscalaAgenda e) {
        String titulo = "Escala: " + (temTexto(e.evento()) ? e.evento() : e.unidade());
        var descricao = new StringBuilder()
                .append("Responsável: ").append(e.responsavel())
                .append("\nUnidade: ").append(e.unidade())
                .append("\nEquipe: ").append(e.equipe().isEmpty() ? "—" : String.join(", ", e.equipe()))
                .append("\nSituação: ").append(rotulo(e.situacao()));
        if (temTexto(e.observacoes())) descricao.append("\n\n").append(e.observacoes());
        return item("escala-" + e.id(), titulo, e.inicio(), e.fim(),
                temTexto(e.local()) ? e.local() : e.unidade(), descricao.toString(), e.situacao());
    }

    private String item(String uid, String titulo, LocalDateTime inicio, LocalDateTime fim, String local,
                        String descricao, String situacao) {
        boolean firme = !situacao.startsWith("PLANEJAD");
        return linha("BEGIN:VEVENT")
                + linha("UID:" + uid + "@parkflash")
                + linha("DTSTAMP:" + UTC.format(OffsetDateTime.now(relogio).withOffsetSameInstant(ZoneOffset.UTC)))
                + linha("DTSTART:" + utc(inicio))
                + linha("DTEND:" + utc(fim))
                + linha("SUMMARY:" + texto(titulo))
                + linha("LOCATION:" + texto(local))
                + linha("DESCRIPTION:" + texto(descricao))
                + linha("STATUS:" + (firme ? "CONFIRMED" : "TENTATIVE"))
                + linha("TRANSP:OPAQUE")
                + linha("END:VEVENT");
    }

    private static String calendario(List<String> itens) {
        return linha("BEGIN:VCALENDAR")
                + linha("VERSION:2.0")
                + linha("PRODID:-//Park Flash//Agenda//PT-BR")
                + linha("CALSCALE:GREGORIAN")
                + linha("METHOD:PUBLISH")
                + linha("X-WR-CALNAME:Park Flash")
                + linha("X-WR-TIMEZONE:" + PagamentoManobristaService.FUSO_NEGOCIO.getId())
                + linha("REFRESH-INTERVAL;VALUE=DURATION:PT1H")
                + linha("X-PUBLISHED-TTL:PT1H")
                + String.join("", itens)
                + linha("END:VCALENDAR");
    }

    private static String utc(LocalDateTime local) {
        return UTC.format(local.atZone(PagamentoManobristaService.FUSO_NEGOCIO).withZoneSameInstant(ZoneOffset.UTC));
    }

    /** Escapa texto (RFC 5545 §3.3.11): barra, ponto e vírgula, vírgula e quebras de linha. */
    static String texto(String valor) {
        if (valor == null) return "";
        return valor.replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,")
                .replace("\r\n", "\n").replace("\r", "\n").replace("\n", "\\n");
    }

    /** Termina com CRLF e dobra linhas acima de 75 bytes (RFC 5545 §3.1) sem partir caracteres UTF-8. */
    static String linha(String conteudo) {
        var saida = new StringBuilder();
        int bytes = 0;
        int limite = 75;
        for (int i = 0; i < conteudo.length(); ) {
            int ponto = conteudo.codePointAt(i);
            int tamanho = new String(Character.toChars(ponto)).getBytes(StandardCharsets.UTF_8).length;
            if (bytes + tamanho > limite) {
                saida.append("\r\n ");
                bytes = 0;
                limite = 74; // o espaço da continuação conta
            }
            saida.appendCodePoint(ponto);
            bytes += tamanho;
            i += Character.charCount(ponto);
        }
        return saida.append("\r\n").toString();
    }

    private static String rotulo(String situacao) {
        return switch (situacao) {
            case "PLANEJADO" -> "Planejado";
            case "CONFIRMADO" -> "Confirmado";
            case "REALIZADO" -> "Realizado";
            case "PLANEJADA" -> "Planejada";
            case "CONFIRMADA" -> "Confirmada";
            case "REALIZADA" -> "Realizada";
            default -> situacao;
        };
    }

    private static boolean temTexto(String valor) {
        return valor != null && !valor.isBlank();
    }

    static String hash(String token) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
