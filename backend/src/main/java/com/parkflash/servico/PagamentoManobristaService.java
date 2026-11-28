package com.parkflash.servico;

import com.parkflash.erro.ConflitoException;
import com.parkflash.erro.NaoEncontradoException;
import com.parkflash.erro.RegraInvalidaException;
import com.parkflash.repositorio.FichaRepository;
import com.parkflash.repositorio.PagamentoManobristaConsultas;
import com.parkflash.seguranca.UsuarioLogado;
import com.parkflash.seguranca.AcessoUnidades;
import com.parkflash.notificacao.EventosNotificacao;
import com.parkflash.notificacao.CategoriaNotificacao;
import com.parkflash.web.dto.PagamentoManobristaDto.*;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.*;

@Service
public class PagamentoManobristaService {
    public static final ZoneId FUSO_NEGOCIO = ZoneId.of("America/Sao_Paulo");
    private static final int LIMITE_COMPROVANTE = 2 * 1024 * 1024;
    private static final byte[] ASSINATURA_PDF = "%PDF-".getBytes(StandardCharsets.US_ASCII);

    private final JdbcClient jdbc;
    private final FichaRepository fichas;
    private final PagamentoManobristaConsultas consultas;
    private final EventosNotificacao notificacoes;

    public PagamentoManobristaService(JdbcClient jdbc, FichaRepository fichas, PagamentoManobristaConsultas consultas, EventosNotificacao notificacoes) {
        this.jdbc = jdbc;
        this.fichas = fichas;
        this.consultas = consultas;
        this.notificacoes = notificacoes;
    }

    @Transactional
    public long reconhecer(long fichaId, Reconhecimento pedido, UsuarioLogado ator) {
        FichaService.bloquear(fichas, fichaId);
        AcessoUnidades.de(ator).exigir(fichas.findById(fichaId).orElseThrow().getUnidadeId());
        var existente = jdbc.sql("SELECT id, valor FROM diaria_a_pagar WHERE ficha_id = :ficha AND manobrista_id = :id")
                .param("ficha", fichaId).param("id", pedido.manobristaId()).query(DiariaReconhecida.class).optional();
        if (existente.isPresent()) {
            if (existente.get().valor().compareTo(pedido.valor()) != 0) {
                throw new ConflitoException("Esta diária já foi reconhecida com outro valor.");
            }
            return existente.get().id();
        }

        Candidato diaria = consultas.candidato(fichaId, pedido.manobristaId(), LocalDate.now(FUSO_NEGOCIO))
                .orElseThrow(() -> new ConflitoException("A diária não está disponível para reconhecimento."));
        if (diaria.custo().compareTo(pedido.custoConferido()) != 0 || !diaria.data().equals(pedido.dataConferida())
                || diaria.unidadeId() != pedido.unidadeConferida() || !diaria.turno().equals(pedido.turnoConferido())) {
            throw new ConflitoException("A ficha foi alterada. Atualize a lista e confira a diária novamente.");
        }
        var chave = new GeneratedKeyHolder();
        jdbc.sql("""
                INSERT INTO diaria_a_pagar (ficha_id, manobrista_id, unidade_id, data_trabalho, custo, valor,
                                            reconhecido_por, reconhecedor)
                VALUES (:ficha, :id, :unidade, :data, :custo, :valor, :ator, :nome)
                """).param("ficha", fichaId).param("id", diaria.manobristaId()).param("unidade", diaria.unidadeId())
                .param("data", diaria.data()).param("custo", diaria.custo()).param("valor", pedido.valor())
                .param("ator", ator.id()).param("nome", nomeDoAtor(ator)).update(chave, "id");
        long id = Objects.requireNonNull(chave.getKey()).longValue();
        notificacoes.registrar(CategoriaNotificacao.PAGAMENTO_PENDENTE, Long.toString(id), fichaId, id,
                List.of(diaria.unidadeId()));
        return id;
    }

    @Transactional
    public Pagamento confirmar(Confirmacao pedido, byte[] comprovante, UsuarioLogado ator) {
        String hash = validarComprovante(comprovante);
        String nomeManobrista = bloquearManobrista(jdbc, pedido.manobristaId());

        Map<Long, Integer> selecao = new HashMap<>();
        for (Selecionada diaria : pedido.diarias()) {
            if (selecao.put(diaria.id(), diaria.revisao()) != null) {
                throw new RegraInvalidaException("Uma diária foi selecionada mais de uma vez.");
            }
        }

        var anterior = jdbc.sql("""
                SELECT p.id, p.manobrista_id, p.data_pagamento AS data, p.forma, p.valor, c.sha256
                FROM pagamento_manobrista p LEFT JOIN pagamento_manobrista_comprovante c ON c.pagamento_id = p.id
                WHERE p.operacao = :operacao
                """).param("operacao", pedido.operacao()).query(Confirmado.class).optional();
        AcessoUnidades acesso = AcessoUnidades.de(ator);
        if (anterior.isPresent()) {
            autorizarPagamento(anterior.get().id(), acesso);
            return repetir(anterior.get(), pedido, selecao, hash);
        }

        List<Saldo> diarias = jdbc.sql("""
                SELECT d.id, d.data_trabalho AS data, d.valor, d.revisao, d.pagamento_ativo_id, d.unidade_id, u.nome AS unidade
                FROM diaria_a_pagar d JOIN unidade u ON u.id = d.unidade_id
                WHERE d.manobrista_id = :manobrista AND d.id IN (:ids)
                """).param("manobrista", pedido.manobristaId()).param("ids", selecao.keySet()).query(Saldo.class).list();

        diarias.forEach(diaria -> acesso.exigir(diaria.unidadeId()));
        if (diarias.size() != selecao.size() || diarias.stream().anyMatch(d ->
                d.pagamentoAtivoId() != null || d.revisao() != selecao.get(d.id()))) {
            throw new ConflitoException("As diárias selecionadas mudaram. Atualize a lista e confira o saldo.");
        }
        if (pedido.data().isAfter(LocalDate.now(FUSO_NEGOCIO))
                || diarias.stream().anyMatch(d -> d.data().isAfter(pedido.data()))) {
            throw new RegraInvalidaException("A data do pagamento deve estar entre o último dia trabalhado selecionado e hoje.");
        }

        BigDecimal total = diarias.stream().map(Saldo::valor).reduce(BigDecimal.ZERO, BigDecimal::add);
        if (total.compareTo(pedido.valor()) != 0) {
            throw new RegraInvalidaException("O valor pago deve corresponder ao total das diárias selecionadas.");
        }

        var chave = new GeneratedKeyHolder();
        jdbc.sql("""
                INSERT INTO pagamento_manobrista (operacao, manobrista_id, manobrista_nome, valor, data_pagamento,
                                                  forma, confirmado_por, confirmador)
                VALUES (:operacao, :manobrista, :nome, :total, :data, :forma, :ator, :confirmador)
                """).param("operacao", pedido.operacao()).param("manobrista", pedido.manobristaId())
                .param("nome", nomeManobrista).param("total", total).param("data", pedido.data())
                .param("forma", pedido.forma().name()).param("ator", ator.id()).param("confirmador", nomeDoAtor(ator))
                .update(chave, "id");
        long id = Objects.requireNonNull(chave.getKey()).longValue();

        for (Saldo diaria : diarias) {
            jdbc.sql("""
                    INSERT INTO pagamento_manobrista_item (pagamento_id, diaria_id, revisao, unidade_nome)
                    VALUES (:pagamento, :diaria, :revisao, :unidade)
                    """).param("pagamento", id).param("diaria", diaria.id()).param("revisao", diaria.revisao())
                    .param("unidade", diaria.unidade()).update();
        }
        jdbc.sql("""
                UPDATE diaria_a_pagar SET pagamento_ativo_id = :pagamento, revisao = revisao + 1 WHERE id IN (:ids)
                """).param("pagamento", id).param("ids", selecao.keySet()).update();

        if (comprovante != null) {
            jdbc.sql("""
                    INSERT INTO pagamento_manobrista_comprovante (pagamento_id, conteudo, sha256)
                    VALUES (:id, :dados, :hash)
                    """).param("id", id).param("dados", comprovante, java.sql.Types.BINARY).param("hash", hash).update();
        }
        notificacoes.registrar(CategoriaNotificacao.PAGAMENTO_CONFIRMADO, Long.toString(id), id, null,
                diarias.stream().map(Saldo::unidadeId).distinct().toList());
        return detalhar(id);
    }

    @Transactional
    public Pagamento estornar(long id, Estorno pedido, UsuarioLogado ator) {
        Pagamento pagamento = detalhar(id, AcessoUnidades.de(ator));
        bloquearManobrista(jdbc, pagamento.manobristaId());
        pagamento = detalhar(id);
        String motivo = pedido.motivo().strip();
        if (pagamento.estornadoEm() != null) {
            if (motivo.equals(pagamento.motivoEstorno())) return pagamento;
            throw new ConflitoException("Este pagamento já foi estornado.");
        }
        jdbc.sql("""
                UPDATE pagamento_manobrista SET estornado_em = CURRENT_TIMESTAMP, estornado_por = :ator,
                    estornador = :nome, motivo_estorno = :motivo WHERE id = :id
                """).param("id", id).param("ator", ator.id()).param("nome", nomeDoAtor(ator)).param("motivo", motivo).update();
        jdbc.sql("""
                UPDATE diaria_a_pagar SET pagamento_ativo_id = NULL, revisao = revisao + 1 WHERE pagamento_ativo_id = :id
                """).param("id", id).update();
        return detalhar(id);
    }

    public Pagamento detalhar(long id, AcessoUnidades acesso) {
        autorizarPagamento(id, acesso);
        return detalhar(id);
    }

    private void autorizarPagamento(long id, AcessoUnidades acesso) {
        if (acesso.todas()) return;
        var unidades = jdbc.sql("""
                SELECT DISTINCT d.unidade_id
                FROM pagamento_manobrista_item i JOIN diaria_a_pagar d ON d.id = i.diaria_id
                WHERE i.pagamento_id = :id
                """).param("id", id).query(Long.class).list();
        if (unidades.isEmpty()) throw new NaoEncontradoException("Pagamento não encontrado.");
        unidades.forEach(acesso::exigir);
    }

    private Pagamento detalhar(long id) {
        return consultas.pagamento(id).orElseThrow(() -> new NaoEncontradoException("Pagamento não encontrado."));
    }

    public byte[] baixarComprovante(long id, AcessoUnidades acesso) {
        autorizarPagamento(id, acesso);
        return jdbc.sql("SELECT conteudo FROM pagamento_manobrista_comprovante WHERE pagamento_id = :id")
                .param("id", id).query((rs, linha) -> rs.getBytes(1)).optional()
                .orElseThrow(() -> new NaoEncontradoException("Comprovante não encontrado."));
    }

    private Pagamento repetir(Confirmado anterior, Confirmacao pedido, Map<Long, Integer> selecao, String hash) {
        Map<Long, Integer> itensOriginais = new HashMap<>();
        jdbc.sql("SELECT diaria_id, revisao FROM pagamento_manobrista_item WHERE pagamento_id = :id")
                .param("id", anterior.id()).query((rs, linha) -> {
                    itensOriginais.put(rs.getLong("diaria_id"), rs.getInt("revisao"));
                    return linha;
                }).list();
        if (!pedido.manobristaId().equals(anterior.manobristaId()) || !pedido.data().equals(anterior.data())
                || pedido.forma() != anterior.forma() || pedido.valor().compareTo(anterior.valor()) != 0
                || !Objects.equals(hash, anterior.sha256()) || !selecao.equals(itensOriginais)) {
            throw new ConflitoException("Esta identificação de operação já foi usada para outro pagamento.");
        }
        return detalhar(anterior.id());
    }

    static String bloquearManobrista(JdbcClient jdbc, long id) {
        return jdbc.sql("SELECT nome FROM manobrista WHERE id = :id FOR UPDATE")
                .param("id", id).query(String.class).optional()
                .orElseThrow(() -> new NaoEncontradoException("Manobrista não encontrado."));
    }

    private String nomeDoAtor(UsuarioLogado ator) {
        return jdbc.sql("SELECT nome FROM usuario WHERE id = :id").param("id", ator.id()).query(String.class)
                .optional().orElseThrow(() -> new NaoEncontradoException("Usuário não encontrado."));
    }

    private static String validarComprovante(byte[] conteudo) {
        if (conteudo == null) return null;
        if (conteudo.length <= ASSINATURA_PDF.length || conteudo.length > LIMITE_COMPROVANTE
                || !Arrays.equals(conteudo, 0, ASSINATURA_PDF.length, ASSINATURA_PDF, 0, ASSINATURA_PDF.length)) {
            throw new RegraInvalidaException("Anexe um comprovante em PDF de até 2 MB.");
        }
        return HexFormat.of().formatHex(PixManobristaService.sha256(conteudo));
    }

    private record DiariaReconhecida(long id, BigDecimal valor) {}
    private record Saldo(long id, LocalDate data, BigDecimal valor, int revisao, Long pagamentoAtivoId, Long unidadeId, String unidade) {}
    private record Confirmado(long id, Long manobristaId, LocalDate data, Forma forma, BigDecimal valor, String sha256) {}

    private record DiariaAnulavel(long id, long fichaId, long manobristaId, long unidadeId, LocalDate dataTrabalho,
                                  BigDecimal valor, String reconhecedor, Long pagamentoAtivoId) {}

    /**
     * Anula uma diária lançada errada. Só a gestão (regra de rota) e só se a diária nunca entrou em
     * nenhum pagamento: o que já foi pago, mesmo estornado, fica no histórico financeiro.
     * A diária sai do saldo a pagar e fica registrada em diaria_anulacao; a ficha volta a poder
     * ser corrigida e a diária volta a aparecer na conferência para ser reconhecida com o valor certo.
     */
    @Transactional
    public void anular(long diariaId, String motivo, UsuarioLogado ator) {
        long fichaId = jdbc.sql("SELECT ficha_id FROM diaria_a_pagar WHERE id = :id").param("id", diariaId)
                .query(Long.class).optional().orElseThrow(() -> new NaoEncontradoException("Diária não encontrada."));
        FichaService.bloquear(fichas, fichaId);
        DiariaAnulavel diaria = jdbc.sql("""
                SELECT id, ficha_id, manobrista_id, unidade_id, data_trabalho, valor, reconhecedor, pagamento_ativo_id
                FROM diaria_a_pagar WHERE id = :id FOR UPDATE""").param("id", diariaId)
                .query(DiariaAnulavel.class).optional().orElseThrow(() -> new NaoEncontradoException("Diária não encontrada."));
        AcessoUnidades.de(ator).exigir(diaria.unidadeId());
        if (diaria.pagamentoAtivoId() != null) {
            throw new ConflitoException("Esta diária já foi paga. Estorne o pagamento antes de anular.");
        }
        boolean jaPaga = jdbc.sql("SELECT EXISTS(SELECT 1 FROM pagamento_manobrista_item WHERE diaria_id = :id)")
                .param("id", diariaId).query(Boolean.class).single();
        if (jaPaga) {
            throw new ConflitoException("Esta diária fez parte de um pagamento estornado e fica no histórico; ela não pode ser anulada.");
        }
        jdbc.sql("""
                INSERT INTO diaria_anulacao (diaria_id, ficha_id, manobrista_id, unidade_id, data_trabalho, valor,
                    reconhecedor, motivo, anulado_por)
                VALUES (:id, :ficha, :manobrista, :unidade, :data, :valor, :reconhecedor, :motivo, :ator)""")
                .param("id", diaria.id()).param("ficha", diaria.fichaId()).param("manobrista", diaria.manobristaId())
                .param("unidade", diaria.unidadeId()).param("data", diaria.dataTrabalho()).param("valor", diaria.valor())
                .param("reconhecedor", diaria.reconhecedor()).param("motivo", motivo.strip()).param("ator", ator.id())
                .update();
        jdbc.sql("DELETE FROM diaria_a_pagar WHERE id = :id").param("id", diariaId).update();
    }
}
