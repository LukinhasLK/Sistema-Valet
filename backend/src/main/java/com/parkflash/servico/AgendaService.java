package com.parkflash.servico;

import com.parkflash.erro.ConflitoException;
import com.parkflash.erro.NaoEncontradoException;
import com.parkflash.erro.RegraInvalidaException;
import com.parkflash.repositorio.UnidadeRepository;
import com.parkflash.seguranca.AcessoUnidades;
import com.parkflash.seguranca.UsuarioLogado;
import com.parkflash.notificacao.EventosNotificacao;
import com.parkflash.notificacao.CategoriaNotificacao;
import java.util.UUID;
import com.parkflash.web.dto.AgendaDto.*;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Types;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

@Service
public class AgendaService {
    private final JdbcClient jdbc;
    private final UnidadeRepository unidades;
    private final EventosNotificacao notificacoes;

    public AgendaService(JdbcClient jdbc, UnidadeRepository unidades, EventosNotificacao notificacoes) {
        this.jdbc = jdbc;
        this.unidades = unidades;
        this.notificacoes = notificacoes;
    }

    @Transactional(readOnly = true)
    public List<Evento> eventos(AcessoUnidades acesso, Long unidade, LocalDate de, LocalDate ate, int pagina) {
        return consultar("evento", acesso, unidade, de, ate, pagina).query(Evento.class).list();
    }

    @Transactional(readOnly = true)
    public List<Escala> escalas(AcessoUnidades acesso, Long unidade, LocalDate de, LocalDate ate, int pagina) {
        var linhas = consultar("escala", acesso, unidade, de, ate, pagina).query(EscalaBase.class).list();
        if (linhas.isEmpty()) return List.of();
        Map<Long, List<Long>> equipes = new HashMap<>();
        jdbc.sql("SELECT escala_id, manobrista_id FROM escala_manobrista WHERE escala_id IN (:ids) ORDER BY manobrista_id")
                .param("ids", linhas.stream().map(EscalaBase::id).toList()).query((rs, i) -> {
                    equipes.computeIfAbsent(rs.getLong("escala_id"), id -> new ArrayList<>()).add(rs.getLong("manobrista_id"));
                    return i;
                }).list();
        return linhas.stream().map(e -> e.comEquipe(equipes.getOrDefault(e.id(), List.of()))).toList();
    }

    public Evento evento(long id, AcessoUnidades acesso) {
        var evento = buscarEvento(id, false);
        acesso.exigir(evento.unidadeId());
        return evento;
    }

    @Transactional(readOnly = true)
    public Escala escala(long id, AcessoUnidades acesso) {
        var escala = buscarEscala(id, false);
        acesso.exigir(escala.unidadeId());
        return escala.comEquipe(equipe(id));
    }

    @Transactional
    public Evento salvarEvento(Long id, Evento pedido, AcessoUnidades acesso) {
        acesso.exigir(pedido.unidadeId());
        Evento atual = id == null ? null : buscarEvento(id, true);
        if (atual != null) acesso.exigir(atual.unidadeId());
        validarPeriodo(pedido.inicio(), pedido.fim());
        validarUnidade(pedido.unidadeId(), atual == null ? null : atual.unidadeId());
        if (atual != null && (!atual.unidadeId().equals(pedido.unidadeId())
                || pedido.situacao() == SituacaoEvento.CANCELADO)
                && jdbc.sql("SELECT EXISTS(SELECT 1 FROM escala WHERE evento_id = :id AND situacao <> 'CANCELADA')")
                .param("id", id).query(Boolean.class).single()) {
            throw new ConflitoException("Cancele ou reorganize as escalas ativas antes de mover ou cancelar o evento.");
        }
        if (atual != null && (!atual.unidadeId().equals(pedido.unidadeId())
                || !atual.inicio().toLocalDate().equals(pedido.inicio().toLocalDate())
                || !atual.fim().toLocalDate().equals(pedido.fim().toLocalDate())
                || pedido.situacao() == SituacaoEvento.CANCELADO)
                && jdbc.sql("""
                        SELECT EXISTS(SELECT 1 FROM evento_ficha WHERE evento_id = :id)
                            OR EXISTS(SELECT 1 FROM evento_despesa WHERE evento_id = :id)
                        """).param("id", id).query(Boolean.class).single()) {
            throw new ConflitoException("Remova os vínculos financeiros antes de mover, remarcar ou cancelar o evento.");
        }
        String campos = """
                unidade_id = :unidade, nome = :nome, contratante = :contratante, local = :local,
                inicio = :inicio, fim = :fim, veiculos_previstos = :veiculos, capacidade = :capacidade,
                equipe_prevista = :equipe, responsavel = :responsavel, valor_contratado = :contrato,
                despesas_previstas = :despesas, situacao = :situacao, observacoes = :obs
                """;
        String sql = id == null ? """
                INSERT INTO evento (unidade_id, nome, contratante, local, inicio, fim, veiculos_previstos,
                    capacidade, equipe_prevista, responsavel, valor_contratado, despesas_previstas, situacao, observacoes)
                VALUES (:unidade, :nome, :contratante, :local, :inicio, :fim, :veiculos, :capacidade,
                    :equipe, :responsavel, :contrato, :despesas, :situacao, :obs)
                """ : "UPDATE evento SET " + campos + " WHERE id = :id";
        var comando = jdbc.sql(sql).param("unidade", pedido.unidadeId()).param("nome", pedido.nome().strip())
                .param("contratante", pedido.contratante().strip()).param("local", pedido.local().strip())
                .param("inicio", pedido.inicio()).param("fim", pedido.fim()).param("veiculos", pedido.veiculosPrevistos())
                .param("capacidade", pedido.capacidade()).param("equipe", pedido.equipePrevista())
                .param("responsavel", pedido.responsavel().strip()).param("contrato", pedido.valorContratado(), Types.DECIMAL)
                .param("despesas", pedido.despesasPrevistas(), Types.DECIMAL).param("situacao", pedido.situacao().name())
                .param("obs", pedido.observacoes(), Types.VARCHAR);
        return buscarEvento(salvar(id, comando), false);
    }

    @Transactional
    public Escala salvarEscala(Long id, EscalaPedido pedido, UsuarioLogado ator) {
        AcessoUnidades acesso = AcessoUnidades.de(ator);
        acesso.exigir(pedido.unidadeId());
        EscalaBase atual = id == null ? null : buscarEscala(id, true);
        if (atual != null) acesso.exigir(atual.unidadeId());
        validarPeriodo(pedido.inicio(), pedido.fim());
        validarUnidade(pedido.unidadeId(), atual == null ? null : atual.unidadeId());
        if (pedido.eventoId() != null) {
            Evento evento = buscarEvento(pedido.eventoId(), true);
            acesso.exigir(evento.unidadeId());
            if (!evento.unidadeId().equals(pedido.unidadeId()) || (evento.situacao() == SituacaoEvento.CANCELADO && pedido.situacao() != SituacaoEscala.CANCELADA)) {
                throw new RegraInvalidaException("Escolha um evento disponível na mesma unidade.");
            }
        }
        var equipe = pedido.manobristaIds().stream().distinct().sorted().toList();
        if (equipe.size() != pedido.manobristaIds().size()) throw new RegraInvalidaException("Remova a alocação repetida.");
        var antes = atual == null ? List.<Long>of() : equipe(atual.id());
        var bloqueios = new HashSet<>(equipe);
        bloqueios.addAll(antes);
        var existentes = jdbc.sql("SELECT id FROM manobrista WHERE id IN (:ids) ORDER BY id FOR UPDATE")
                .param("ids", bloqueios).query(Long.class).list();
        if (!existentes.containsAll(equipe)) throw new RegraInvalidaException("Há um manobrista que não existe.");
        var novos = equipe.stream().filter(idEquipe -> !antes.contains(idEquipe)).toList();
        if (!novos.isEmpty() && jdbc.sql("SELECT COUNT(*) FROM manobrista WHERE ativo = FALSE AND id IN (:ids)")
                .param("ids", novos).query(Long.class).single() > 0) {
            throw new RegraInvalidaException("Há um manobrista inativo na nova equipe.");
        }
        if (pedido.situacao() != SituacaoEscala.CANCELADA && jdbc.sql("""
                SELECT EXISTS(SELECT 1 FROM escala e JOIN escala_manobrista m ON e.id = m.escala_id
                  WHERE m.manobrista_id IN (:equipe) AND e.situacao <> 'CANCELADA'
                    AND e.inicio < :fim AND e.fim > :inicio AND e.id <> :atual)
                """).param("equipe", equipe).param("fim", pedido.fim()).param("inicio", pedido.inicio())
                .param("atual", id == null ? 0L : id).query(Boolean.class).single()) {
            throw new ConflitoException("Há um integrante da equipe já escalado nesse horário.");
        }

        String sql = id == null ? """
                INSERT INTO escala (unidade_id, evento_id, inicio, fim, responsavel, situacao, observacoes)
                VALUES (:unidade, :evento, :inicio, :fim, :responsavel, :situacao, :obs)
                """ : """
                UPDATE escala SET unidade_id = :unidade, evento_id = :evento, inicio = :inicio, fim = :fim,
                    responsavel = :responsavel, situacao = :situacao, observacoes = :obs WHERE id = :id
                """;
        var comando = jdbc.sql(sql).param("unidade", pedido.unidadeId()).param("evento", pedido.eventoId(), Types.BIGINT)
                .param("inicio", pedido.inicio()).param("fim", pedido.fim()).param("responsavel", pedido.responsavel().strip())
                .param("situacao", pedido.situacao().name()).param("obs", pedido.observacoes(), Types.VARCHAR);
        long salvo = salvar(id, comando);
        jdbc.sql("DELETE FROM escala_manobrista WHERE escala_id = :id").param("id", salvo).update();
        for (long manobrista : equipe) {
            jdbc.sql("INSERT INTO escala_manobrista VALUES (:escala, :manobrista)")
                    .param("escala", salvo).param("manobrista", manobrista).update();
        }
        jdbc.sql("""
                INSERT INTO escala_historico (escala_id, unidade_id, ator_id, situacao, inicio, fim, equipe,
                    evento_id, responsavel, observacoes)
                VALUES (:id, :unidade, :ator, :situacao, :inicio, :fim, :equipe, :evento, :responsavel, :obs)
                """).param("id", salvo).param("unidade", pedido.unidadeId()).param("ator", ator.id())
                .param("situacao", pedido.situacao().name()).param("inicio", pedido.inicio()).param("fim", pedido.fim())
                .param("equipe", equipe.stream().map(String::valueOf).collect(Collectors.joining(",")))
                .param("evento", pedido.eventoId(), Types.BIGINT).param("responsavel", pedido.responsavel().strip())
                .param("obs", pedido.observacoes(), Types.VARCHAR).update();
        var depois = buscarEscala(salvo, false);
        if (atual != null && (!atual.equals(depois) || !new HashSet<>(antes).equals(new HashSet<>(equipe)))) {
            notificacoes.registrar(CategoriaNotificacao.ESCALA_ALTERADA, salvo + ":" + UUID.randomUUID(),
                    salvo, null, List.of(depois.unidadeId()));
        }
        return depois.comEquipe(equipe);
    }

    @Transactional(readOnly = true)
    public List<AlteracaoEscala> historico(long id, AcessoUnidades acesso) {
        acesso.exigir(buscarEscala(id, false).unidadeId());
        String sql = """
                SELECT h.id, u.nome AS ator, h.registrado_em, h.situacao, h.inicio, h.fim, h.equipe,
                    h.evento_id, h.responsavel, h.observacoes
                FROM escala_historico h JOIN usuario u ON u.id = h.ator_id WHERE h.escala_id = :id
                """;
        if (acesso.todas()) {
            return jdbc.sql(sql + " ORDER BY h.id DESC").param("id", id).query(AlteracaoEscala.class).list();
        }
        return jdbc.sql(sql + " AND h.unidade_id IN (:unidades) ORDER BY h.id DESC")
                .param("id", id).param("unidades", acesso.unidades()).query(AlteracaoEscala.class).list();
    }

    private JdbcClient.StatementSpec consultar(String tabela, AcessoUnidades acesso, Long unidade,
                                                LocalDate de, LocalDate ate, int pagina) {
        if (de != null && ate != null && de.isAfter(ate)) throw new RegraInvalidaException("Período inválido.");
        StringBuilder sql = new StringBuilder("SELECT * FROM " + tabela + " WHERE 1 = 1");
        Map<String, Object> params = new HashMap<>();
        if (unidade != null) {
            acesso.exigir(unidade);
            sql.append(" AND unidade_id = :unidade");
            params.put("unidade", unidade);
        } else if (!acesso.todas()) {
            if (acesso.unidades().isEmpty()) sql.append(" AND 1 = 0");
            else {
                sql.append(" AND unidade_id IN (:unidades)");
                params.put("unidades", acesso.unidades());
            }
        }
        if (de != null) {
            sql.append(" AND fim > :de");
            params.put("de", de.atStartOfDay());
        }
        if (ate != null) {
            sql.append(" AND inicio < :ate");
            params.put("ate", ate.plusDays(1).atStartOfDay());
        }
        return jdbc.sql(sql + " ORDER BY inicio DESC, id DESC LIMIT 50 OFFSET :inicioPagina")
                .params(params).param("inicioPagina", (long) pagina * 50);
    }

    private static long salvar(Long id, JdbcClient.StatementSpec comando) {
        if (id != null) {
            comando.param("id", id).update();
            return id;
        }
        var chave = new GeneratedKeyHolder();
        comando.update(chave, "id");
        return Objects.requireNonNull(chave.getKey()).longValue();
    }

    private Evento buscarEvento(long id, boolean bloquear) {
        return jdbc.sql("SELECT * FROM evento WHERE id = :id" + (bloquear ? " FOR UPDATE" : ""))
                .param("id", id).query(Evento.class).optional().orElseThrow(() -> new NaoEncontradoException("Evento não encontrado."));
    }

    private EscalaBase buscarEscala(long id, boolean bloquear) {
        return jdbc.sql("SELECT * FROM escala WHERE id = :id" + (bloquear ? " FOR UPDATE" : ""))
                .param("id", id).query(EscalaBase.class).optional().orElseThrow(() -> new NaoEncontradoException("Escala não encontrada."));
    }

    private List<Long> equipe(long id) {
        return jdbc.sql("SELECT manobrista_id FROM escala_manobrista WHERE escala_id = :id").param("id", id).query(Long.class).list();
    }

    private void validarUnidade(Long unidade, Long anterior) {
        if (!unidade.equals(anterior) && !unidades.existsByIdAndAtivaTrue(unidade)) {
            throw new RegraInvalidaException("Escolha uma unidade ativa.");
        }
    }

    private static void validarPeriodo(LocalDateTime inicio, LocalDateTime fim) {
        if (!inicio.isBefore(fim)) throw new RegraInvalidaException("O fim deve ocorrer depois do início.");
    }

    private record EscalaBase(long id, long unidadeId, Long eventoId, LocalDateTime inicio, LocalDateTime fim,
                              String responsavel, SituacaoEscala situacao, String observacoes) {
        Escala comEquipe(List<Long> equipe) {
            return new Escala(id, unidadeId, eventoId, inicio, fim, responsavel, situacao, observacoes, equipe);
        }
    }
}
