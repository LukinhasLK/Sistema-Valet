package com.parkflash.servico;

import com.parkflash.dominio.DespesaAdicional;
import com.parkflash.dominio.Ficha;
import com.parkflash.dominio.NivelAcesso;
import com.parkflash.dominio.ModalidadeCusto;
import com.parkflash.dominio.SituacaoFicha;
import com.parkflash.web.dto.TransicaoFicha;
import com.parkflash.seguranca.UsuarioLogado;
import com.parkflash.seguranca.AcessoUnidades;
import com.parkflash.web.dto.PagamentoManobristaDto.*;
import org.springframework.security.access.AccessDeniedException;
import java.util.UUID;
import com.parkflash.notificacao.EventosNotificacao;
import com.parkflash.notificacao.CategoriaNotificacao;
import com.parkflash.dominio.FichaManobrista;
import com.parkflash.erro.ConflitoException;
import com.parkflash.erro.NaoEncontradoException;
import com.parkflash.erro.RegraInvalidaException;
import com.parkflash.repositorio.FichaRepository;
import com.parkflash.repositorio.ManobristaRepository;
import com.parkflash.repositorio.UnidadeRepository;
import com.parkflash.web.dto.DespesaAdicionalDto;
import com.parkflash.web.dto.FichaRequest;
import com.parkflash.web.dto.FichaResponse;
import com.parkflash.web.dto.ManobristaFichaDto;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;

@Service
public class FichaService {

    private final FichaRepository fichas;
    private final UnidadeRepository unidades;
    private final ManobristaRepository manobristas;
    private final JdbcClient jdbc;
    private final PagamentoManobristaService pagamentos;
    private final EventosNotificacao notificacoes;

    public FichaService(FichaRepository fichas, UnidadeRepository unidades, ManobristaRepository manobristas, JdbcClient jdbc, PagamentoManobristaService pagamentos, EventosNotificacao notificacoes) {
        this.fichas = fichas;
        this.unidades = unidades;
        this.manobristas = manobristas;
        this.jdbc = jdbc;
        this.pagamentos = pagamentos;
        this.notificacoes = notificacoes;
    }

    @Transactional(readOnly = true)
    public List<FichaResponse> listar(AcessoUnidades acesso) {
        var registros = acesso.todas() ? fichas.findAllByOrderByDataDescIdDesc()
                : fichas.findByUnidadeIdInOrderByDataDescIdDesc(acesso.unidades());
        return registros.stream().map(FichaResponse::de).toList();
    }

    @Transactional(readOnly = true)
    public FichaResponse detalhar(Long id, AcessoUnidades acesso) {
        Ficha ficha = buscar(id);
        acesso.exigir(ficha.getUnidadeId());
        return FichaResponse.de(ficha);
    }

    @Transactional
    public FichaResponse criar(FichaRequest pedido, UsuarioLogado ator) {
        AcessoUnidades.de(ator).exigir(pedido.unidadeId());
        if (fichas.existsByDataAndUnidadeIdAndTurno(pedido.data(), pedido.unidadeId(), pedido.turno())) {
            throw duplicada();
        }
        Ficha ficha = new Ficha();
        ficha.habilitarControlePagamentos();
        ficha.setResponsavelId(ator.id());
        preencher(ficha, pedido);
        fichas.saveAndFlush(ficha);
        auditar(ficha, ator.id(), "CRIAR", null);
        notificacoes.registrar(CategoriaNotificacao.FICHA_CRIADA, ficha.getId(), ficha.getUnidadeId());
        var equipe = Objects.requireNonNullElse(pedido.manobristas(), List.<ManobristaFichaDto>of());
        for (var linha : equipe.stream().sorted(java.util.Comparator.comparing(ManobristaFichaDto::manobristaId)).toList()) {
            registrarDiaria(ficha, linha, ator);
        }
        return FichaResponse.de(ficha);
    }

    private void registrarDiaria(Ficha ficha, ManobristaFichaDto linha, UsuarioLogado ator) {
        if (linha.pagaNaFicha() == null || linha.diaria().signum() == 0) return;
        boolean paga = linha.pagaNaFicha();
        if (paga && ator.nivel() == NivelAcesso.OPERADOR) {
            throw new AccessDeniedException("Somente a gestão pode confirmar pagamentos.");
        }
        if (paga && linha.formaPagamento() == null) {
            throw new RegraInvalidaException("Informe a forma usada para pagar a diária.");
        }
        BigDecimal valor = CalculoFicha.arredondar(linha.diaria());
        long id = pagamentos.reconhecer(ficha.getId(), new Reconhecimento(linha.manobristaId(), valor, valor,
                ficha.getData(), ficha.getTurno().name(), ficha.getUnidadeId()), ator);
        if (paga) {
            pagamentos.confirmar(new Confirmacao(UUID.randomUUID(), linha.manobristaId(),
                    List.of(new Selecionada(id, 0)), ficha.getData(), linha.formaPagamento(), true, valor), null, ator);
        }
    }

    @Transactional
    public FichaResponse atualizar(Long id, FichaRequest pedido, UsuarioLogado ator) {
        bloquear(fichas, id);
        Ficha ficha = buscar(id);
        var acesso = AcessoUnidades.de(ator);
        acesso.exigir(ficha.getUnidadeId());
        acesso.exigir(pedido.unidadeId());
        exigirEdicao(ficha);
        verificarDiariasReconhecidas(id, ficha, pedido);
        if (fichas.existsByDataAndUnidadeIdAndTurnoAndIdNot(pedido.data(), pedido.unidadeId(), pedido.turno(), id)) {
            throw duplicada();
        }
        preencher(ficha, pedido);
        auditar(ficha, ator.id(), "ALTERAR", null);
        return FichaResponse.de(ficha);
    }

    @Transactional
    public void excluir(Long id, UsuarioLogado ator) {
        bloquear(fichas, id);
        Ficha ficha = buscar(id);
        AcessoUnidades.de(ator).exigir(ficha.getUnidadeId());
        exigirEdicao(ficha);
        if (jdbc.sql("SELECT COUNT(*) FROM diaria_a_pagar WHERE ficha_id = :id")
                .param("id", id).query(Long.class).single() > 0) {
            throw new ConflitoException("A ficha possui diárias reconhecidas e faz parte do histórico financeiro.");
        }
        ficha.mudarSituacao(SituacaoFicha.CANCELADA, null, null);
        auditar(ficha, ator.id(), "CANCELAR", null);
    }

    @Transactional
    public FichaResponse transicao(Long id, TransicaoFicha pedido, UsuarioLogado ator) {
        bloquear(fichas, id);
        Ficha ficha = buscar(id);
        AcessoUnidades.de(ator).exigir(ficha.getUnidadeId());
        if (pedido.acao() != TransicaoFicha.Acao.ENVIAR && ator.nivel() == NivelAcesso.OPERADOR) {
            throw new AccessDeniedException("Somente a gestão pode decidir a conferência da ficha.");
        }
        String motivo = pedido.justificativa() == null ? null : pedido.justificativa().strip();
        byte[] assinatura = lerAssinatura(pedido);
        SituacaoFicha destino = switch (pedido.acao()) {
            case ENVIAR -> depoisDe(ficha, SituacaoFicha.EM_EDICAO, SituacaoFicha.PRONTA);
            case FECHAR -> depoisDe(ficha, SituacaoFicha.PRONTA, SituacaoFicha.FECHADA);
            case DEVOLVER, REABRIR -> {
                if (motivo == null || motivo.isBlank()) {
                    throw new RegraInvalidaException("Informe o motivo da correção.");
                }
                SituacaoFicha origem = pedido.acao() == TransicaoFicha.Acao.DEVOLVER
                        ? SituacaoFicha.PRONTA : SituacaoFicha.FECHADA;
                yield depoisDe(ficha, origem, SituacaoFicha.EM_EDICAO);
            }
        };
        ficha.mudarSituacao(destino, ator.id(), OffsetDateTime.now(ZoneOffset.UTC));
        auditar(ficha, ator.id(), pedido.acao().name(), motivo);
        // A assinatura vale só para o fechamento em vigor: reabrir ou fechar de novo descarta a anterior.
        if (pedido.acao() == TransicaoFicha.Acao.FECHAR || pedido.acao() == TransicaoFicha.Acao.REABRIR) {
            jdbc.sql("DELETE FROM ficha_assinatura WHERE ficha_id = :id").param("id", ficha.getId()).update();
        }
        if (assinatura != null) {
            jdbc.sql("INSERT INTO ficha_assinatura (ficha_id, imagem, assinado_por) VALUES (:id, :imagem, :ator)")
                    .param("id", ficha.getId()).param("imagem", assinatura).param("ator", ator.id()).update();
        }
        if (destino == SituacaoFicha.PRONTA) {
            notificacoes.registrar(CategoriaNotificacao.FICHA_AGUARDANDO_FECHAMENTO,
                    ficha.getId() + ":" + UUID.randomUUID(), ficha.getId(), null, List.of(ficha.getUnidadeId()));
        }
        return FichaResponse.de(ficha);
    }

    /** Assinatura do último fechamento, como data URL para exibir direto num <img>. */
    public record Assinatura(String imagem, String autor, OffsetDateTime assinadoEm) {}

    private static final String PREFIXO_PNG = "data:image/png;base64,";
    private static final int LIMITE_ASSINATURA = 250_000;

    /** Valida a assinatura desenhada: só no fechamento, só PNG, até 250 KB. */
    private static byte[] lerAssinatura(TransicaoFicha pedido) {
        String valor = pedido.assinatura();
        if (valor == null || valor.isBlank()) return null;
        if (pedido.acao() != TransicaoFicha.Acao.FECHAR) {
            throw new RegraInvalidaException("A assinatura só é registrada no fechamento da ficha.");
        }
        if (!valor.startsWith(PREFIXO_PNG)) throw new RegraInvalidaException("Assinatura em formato inválido.");
        byte[] bytes;
        try {
            bytes = java.util.Base64.getDecoder().decode(valor.substring(PREFIXO_PNG.length()));
        } catch (IllegalArgumentException e) {
            throw new RegraInvalidaException("Assinatura em formato inválido.");
        }
        boolean png = bytes.length > 8 && (bytes[0] & 0xFF) == 0x89 && bytes[1] == 'P' && bytes[2] == 'N' && bytes[3] == 'G';
        if (!png) throw new RegraInvalidaException("Assinatura em formato inválido.");
        if (bytes.length > LIMITE_ASSINATURA) throw new RegraInvalidaException("Assinatura grande demais.");
        return bytes;
    }

    @Transactional(readOnly = true)
    public Assinatura assinatura(Long id, AcessoUnidades acesso) {
        var unidade = jdbc.sql("SELECT unidade_id FROM ficha WHERE id = :id").param("id", id)
                .query(Long.class).optional().orElseThrow(() -> new NaoEncontradoException("Ficha não encontrada."));
        acesso.exigir(unidade);
        return jdbc.sql("""
                SELECT a.imagem, u.nome, a.assinado_em FROM ficha_assinatura a JOIN usuario u ON u.id = a.assinado_por
                WHERE a.ficha_id = :id""").param("id", id)
                .query((rs, i) -> new Assinatura(PREFIXO_PNG + java.util.Base64.getEncoder().encodeToString(rs.getBytes("imagem")),
                        rs.getString("nome"), rs.getObject("assinado_em", OffsetDateTime.class)))
                .optional().orElseThrow(() -> new NaoEncontradoException("Esta ficha não tem assinatura registrada."));
    }

    @Transactional
    public void sinalizarDivergencia(long id, String motivo, UsuarioLogado ator) {
        if (ator.nivel() == NivelAcesso.OPERADOR) throw new AccessDeniedException("Operação reservada à gestão.");
        bloquear(fichas, id);
        Ficha ficha = buscar(id);
        AcessoUnidades.de(ator).exigir(ficha.getUnidadeId());
        boolean existe = jdbc.sql("SELECT EXISTS (SELECT 1 FROM ficha_historico WHERE ficha_id = :id AND acao = 'DIVERGENCIA')")
                .param("id", id).query(Boolean.class).single();
        if (existe) return;
        auditar(ficha, ator.id(), "DIVERGENCIA", motivo.strip());
        notificacoes.registrar(CategoriaNotificacao.DIVERGENCIA_FINANCEIRA, ficha.getId(), ficha.getUnidadeId());
    }

    @Transactional(readOnly = true)
    public List<TransicaoFicha.Registro> historico(Long id, AcessoUnidades acesso) {
        var unidade = jdbc.sql("SELECT unidade_id FROM ficha WHERE id = :id").param("id", id)
                .query(Long.class).optional().orElseThrow(() -> new NaoEncontradoException("Ficha não encontrada."));
        acesso.exigir(unidade);
        String sql = """
                SELECT h.acao, u.nome AS ator, h.justificativa, h.registrado_em
                FROM ficha_historico h JOIN usuario u ON u.id = h.ator_id
                WHERE h.ficha_id = :id
                """;
        if (!acesso.todas()) {
            return jdbc.sql(sql + " AND h.unidade_id IN (:unidades) ORDER BY h.id DESC")
                    .param("id", id).param("unidades", acesso.unidades())
                    .query(TransicaoFicha.Registro.class).list();
        }
        return jdbc.sql(sql + " ORDER BY h.id DESC").param("id", id).query(TransicaoFicha.Registro.class).list();
    }

    private void auditar(Ficha ficha, Long atorId, String acao, String motivo) {
        jdbc.sql("""
                INSERT INTO ficha_historico (ficha_id, ator_id, unidade_id, acao, justificativa)
                VALUES (:ficha, :ator, :unidade, :acao, :motivo)
                """).param("ficha", ficha.getId()).param("ator", atorId).param("unidade", ficha.getUnidadeId())
                .param("acao", acao).param("motivo", motivo, java.sql.Types.VARCHAR).update();
    }

    private static SituacaoFicha depoisDe(Ficha ficha, SituacaoFicha atual, SituacaoFicha destino) {
        if (ficha.getSituacao() != atual) {
            throw new ConflitoException("A ficha está em outra etapa. Atualize e confira a situação.");
        }
        return destino;
    }

    private static void exigirEdicao(Ficha ficha) {
        depoisDe(ficha, SituacaoFicha.EM_EDICAO, SituacaoFicha.EM_EDICAO);
    }

    static void bloquear(FichaRepository fichas, long id) {
        fichas.bloquearId(id).orElseThrow(() -> new NaoEncontradoException("Ficha não encontrada."));
    }

    private void verificarDiariasReconhecidas(long id, Ficha ficha, FichaRequest pedido) {
        List<FichaManobrista> diarias = jdbc.sql("SELECT manobrista_id, custo FROM diaria_a_pagar WHERE ficha_id = :id")
                .param("id", id)
                .query((rs, linha) -> new FichaManobrista(rs.getLong("manobrista_id"), rs.getBigDecimal("custo")))
                .list();
        List<ManobristaFichaDto> equipe = Objects.requireNonNullElse(pedido.manobristas(), List.of());
        for (FichaManobrista diaria : diarias) {
            if (!ficha.getData().equals(pedido.data()) || !ficha.getUnidadeId().equals(pedido.unidadeId())
                    || ficha.getTurno() != pedido.turno()
                    || equipe.stream().noneMatch(m -> m.manobristaId().equals(diaria.getManobristaId())
                        && CalculoFicha.arredondar(m.diaria()).compareTo(diaria.getDiaria()) == 0)) {
                throw new ConflitoException("Data, unidade, turno e diárias reconhecidas da ficha estão vinculados ao histórico financeiro.");
            }
        }
    }

    private Ficha buscar(Long id) {
        return fichas.findById(id).filter(ficha -> ficha.getSituacao() != SituacaoFicha.CANCELADA).orElseThrow(() -> new NaoEncontradoException("Ficha não encontrada."));
    }

    private static ConflitoException duplicada() {
        return new ConflitoException("Já existe uma ficha para esta unidade, data e turno.");
    }

    /** Valida a ficha e recalcula os totais — o servidor não confia nos totais do cliente. */
    private void preencher(Ficha ficha, FichaRequest pedido) {
        if (!pedido.unidadeId().equals(ficha.getUnidadeId()) && !unidades.existsByIdAndAtivaTrue(pedido.unidadeId())) {
            throw new RegraInvalidaException("Escolha uma unidade ativa.");
        }

        int canceladas = Objects.requireNonNullElse(pedido.fichasCanceladas(), 0);
        if (pedido.fichaFim() - pedido.fichaInicio() - canceladas < 0) {
            throw new RegraInvalidaException("A ficha final precisa ser maior que a inicial mais as canceladas.");
        }

        var anteriores = ficha.getManobristas().stream()
                .collect(Collectors.toMap(FichaManobrista::getManobristaId, FichaManobrista::getModalidade));
        List<FichaManobrista> equipe = Objects.requireNonNullElse(pedido.manobristas(), List.<ManobristaFichaDto>of())
                .stream()
                .map(m -> new FichaManobrista(m.manobristaId(), CalculoFicha.arredondar(m.diaria()),
                        Objects.requireNonNullElse(m.modalidade(),
                                anteriores.getOrDefault(m.manobristaId(), ModalidadeCusto.DIARIA_FIXA))))
                .toList();
        var ids = new HashSet<Long>();
        for (FichaManobrista m : equipe) {
            if (!ids.add(m.getManobristaId())) {
                throw new RegraInvalidaException("O mesmo manobrista aparece duas vezes na ficha.");
            }
        }
        if (manobristas.countByIdIn(ids) != ids.size()) {
            throw new RegraInvalidaException("Manobrista não encontrado.");
        }
        var novos = ids.stream().filter(id -> !anteriores.containsKey(id)).toList();
        if (!novos.isEmpty() && manobristas.countByIdInAndAtivoTrue(novos) != novos.size()) {
            throw new RegraInvalidaException("Selecione somente manobristas ativos para novos lançamentos.");
        }

        List<DespesaAdicional> despesas = Objects.requireNonNullElse(pedido.despesasAdicionais(), List.<DespesaAdicionalDto>of())
                .stream()
                .map(d -> new DespesaAdicional(d.descricao().trim(), CalculoFicha.arredondar(d.valor())))
                .toList();

        BigDecimal dinheiro = CalculoFicha.arredondar(Objects.requireNonNullElse(pedido.valorDinheiro(), BigDecimal.ZERO));
        BigDecimal cartao = CalculoFicha.arredondar(Objects.requireNonNullElse(pedido.valorCartao(), BigDecimal.ZERO));
        BigDecimal pix = Objects.requireNonNullElse(pedido.valorPix(), ficha.getValorPix());
        BigDecimal taxa = CalculoFicha.arredondar(pedido.taxaMaquininha());

        ficha.setData(pedido.data());
        ficha.setUnidadeId(pedido.unidadeId());
        ficha.setTurno(pedido.turno());
        ficha.setFichaInicio(pedido.fichaInicio());
        ficha.setFichaFim(pedido.fichaFim());
        ficha.setFichasCanceladas(canceladas);
        ficha.setTotalCarros(CalculoFicha.totalCarros(pedido.fichaInicio(), pedido.fichaFim(), canceladas));
        ficha.setValorDinheiro(dinheiro);
        ficha.setValorCartao(cartao);
        ficha.setValorPix(pix);
        if (pedido.valorInicialCaixa() != null) ficha.setValorInicialCaixa(pedido.valorInicialCaixa());
        if (pedido.valorFinalCaixa() != null) ficha.setValorFinalCaixa(pedido.valorFinalCaixa());
        if (pedido.observacoes() != null) ficha.setObservacoes(pedido.observacoes().strip());
        ficha.setTaxaMaquininha(taxa);
        ficha.setManobristas(equipe);
        ficha.setDespesasAdicionais(despesas);
        ficha.setTotalBruto(CalculoFicha.totalBruto(dinheiro, cartao, pix));
        ficha.setTotalLiquido(CalculoFicha.saldoFinal(dinheiro, cartao, pix, taxa, equipe, despesas));
    }
}
