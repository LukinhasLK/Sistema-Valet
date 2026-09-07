package com.valetgest.service;

import com.valetgest.dto.FichaRequest;
import com.valetgest.dto.FichaResponse;
import com.valetgest.entity.*;
import com.valetgest.enums.TipoUsuario;
import com.valetgest.exception.NegocioException;
import com.valetgest.repository.FichaRepository;
import com.valetgest.repository.ManobristaRepository;
import com.valetgest.repository.UnidadeRepository;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Service responsável por toda lógica das fichas.
 */
@Service
@RequiredArgsConstructor
public class FichaService {

    private final FichaRepository fichaRepository;
    private final UnidadeRepository unidadeRepository;
    private final ManobristaRepository manobristaRepository;

    /**
     * @Transactional garante que ou tudo é salvo, ou nada é.
     * Se der erro no meio do caminho, faz rollback automático.
     */
    @Transactional
    public FichaResponse criar(FichaRequest request, Usuario usuarioLogado) {

        // Validação: valor final tem que ser >= valor inicial
        if (request.getValorFinal().compareTo(request.getValorInicial()) < 0) {
            throw new NegocioException("Valor final deve ser maior ou igual ao valor inicial");
        }

        Unidade unidade = unidadeRepository.findById(request.getUnidadeId())
                .orElseThrow(() -> new NegocioException("Unidade não encontrada"));

        // Se for gerente, só pode criar ficha pra unidade dele
        validarPermissaoUnidade(usuarioLogado, unidade);

        Ficha ficha = Ficha.builder()
                .dataFicha(request.getDataFicha())
                .unidade(unidade)
                .usuarioCriador(usuarioLogado)
                .valorInicial(request.getValorInicial())
                .valorFinal(request.getValorFinal())
                .quantidadeManobras(request.getQuantidadeManobras())
                .porcentagemCartao(request.getPorcentagemCartao())
                .valorEmCartao(request.getValorEmCartao())
                .valorDinheiro(request.getValorDinheiro() != null ? request.getValorDinheiro() : java.math.BigDecimal.ZERO)
                .observacoes(request.getObservacoes())
                .build();

        // Adiciona os lançamentos dos manobristas
        request.getLancamentos().forEach(lancReq -> {
            Manobrista manobrista = manobristaRepository.findById(lancReq.getManobristaId())
                    .orElseThrow(() -> new NegocioException(
                            "Manobrista " + lancReq.getManobristaId() + " não encontrado"));

            LancamentoManobrista lancamento = LancamentoManobrista.builder()
                    .ficha(ficha)
                    .manobrista(manobrista)
                    .tipoPagamento(lancReq.getTipoPagamento())
                    .quantidadeManobras(lancReq.getQuantidadeManobras())
                    .valorPorManobra(lancReq.getValorPorManobra())
                    .porcentagem(lancReq.getPorcentagem())
                    .valorPago(lancReq.getValorPago())
                    .build();

            ficha.getLancamentos().add(lancamento);
        });

        // Adiciona as despesas
        request.getDespesas().forEach(despReq -> {
            Despesa despesa = Despesa.builder()
                    .ficha(ficha)
                    .descricao(despReq.getDescricao())
                    .valor(despReq.getValor())
                    .build();
            ficha.getDespesas().add(despesa);
        });

        Ficha salva = fichaRepository.save(ficha);
        return FichaResponse.fromEntity(salva);
    }

    public FichaResponse buscarPorId(Long id, Usuario usuarioLogado) {
        Ficha ficha = fichaRepository.findById(id)
                .orElseThrow(() -> new NegocioException("Ficha não encontrada"));

        validarPermissaoUnidade(usuarioLogado, ficha.getUnidade());
        return FichaResponse.fromEntity(ficha);
    }

    public List<FichaResponse> listarTodas(Usuario usuarioLogado) {
        List<Ficha> fichas;
        if (usuarioLogado.getTipo() == TipoUsuario.DONO) {
            fichas = fichaRepository.findAll();
        } else {
            // Gerente só vê fichas da unidade dele
            fichas = fichaRepository.findByUnidadeIdAndDataFichaBetweenOrderByDataFichaAsc(
                    usuarioLogado.getUnidade().getId(),
                    java.time.LocalDate.now().minusYears(10),
                    java.time.LocalDate.now().plusDays(1)
            );
        }
        return fichas.stream().map(FichaResponse::fromEntity).toList();
    }

    @Transactional
    public FichaResponse atualizarCarros(Long id, Integer quantidade, Usuario usuarioLogado) {
        Ficha ficha = fichaRepository.findById(id)
                .orElseThrow(() -> new NegocioException("Ficha não encontrada"));
        validarPermissaoUnidade(usuarioLogado, ficha.getUnidade());
        if (quantidade == null || quantidade < 0) throw new NegocioException("Quantidade inválida");
        ficha.setQuantidadeManobras(quantidade);
        return FichaResponse.fromEntity(fichaRepository.save(ficha));
    }

    @Transactional
    public FichaResponse atualizarData(Long id, java.time.LocalDate novaData, Usuario usuarioLogado) {
        Ficha ficha = fichaRepository.findById(id)
                .orElseThrow(() -> new NegocioException("Ficha não encontrada"));
        validarPermissaoUnidade(usuarioLogado, ficha.getUnidade());
        ficha.setDataFicha(novaData);
        return FichaResponse.fromEntity(fichaRepository.save(ficha));
    }

    @Transactional
    public void deletar(Long id, Usuario usuarioLogado) {
        Ficha ficha = fichaRepository.findById(id)
                .orElseThrow(() -> new NegocioException("Ficha não encontrada"));
        validarPermissaoUnidade(usuarioLogado, ficha.getUnidade());
        fichaRepository.delete(ficha);
    }

    @Transactional
    public FichaResponse adicionarDespesa(Long fichaId, FichaRequest.DespesaRequest despReq, Usuario usuarioLogado) {
        Ficha ficha = fichaRepository.findById(fichaId)
                .orElseThrow(() -> new NegocioException("Ficha não encontrada"));
        validarPermissaoUnidade(usuarioLogado, ficha.getUnidade());

        Despesa despesa = Despesa.builder()
                .ficha(ficha)
                .descricao(despReq.getDescricao())
                .valor(despReq.getValor())
                .build();

        ficha.getDespesas().add(despesa);
        return FichaResponse.fromEntity(fichaRepository.save(ficha));
    }

    @Transactional
    public FichaResponse removerDespesa(Long fichaId, Long despId, Usuario usuarioLogado) {
        Ficha ficha = fichaRepository.findById(fichaId)
                .orElseThrow(() -> new NegocioException("Ficha não encontrada"));
        validarPermissaoUnidade(usuarioLogado, ficha.getUnidade());
        boolean removido = ficha.getDespesas().removeIf(d -> d.getId().equals(despId));
        if (!removido) throw new NegocioException("Despesa não encontrada nesta ficha");
        return FichaResponse.fromEntity(fichaRepository.save(ficha));
    }

    @Transactional
    public FichaResponse adicionarLancamento(Long fichaId, FichaRequest.LancamentoManobristaRequest lancReq, Usuario usuarioLogado) {
        Ficha ficha = fichaRepository.findById(fichaId)
                .orElseThrow(() -> new NegocioException("Ficha não encontrada"));
        validarPermissaoUnidade(usuarioLogado, ficha.getUnidade());

        Manobrista manobrista = manobristaRepository.findById(lancReq.getManobristaId())
                .orElseThrow(() -> new NegocioException("Manobrista não encontrado"));

        LancamentoManobrista lancamento = LancamentoManobrista.builder()
                .ficha(ficha)
                .manobrista(manobrista)
                .tipoPagamento(lancReq.getTipoPagamento())
                .quantidadeManobras(lancReq.getQuantidadeManobras())
                .valorPorManobra(lancReq.getValorPorManobra())
                .porcentagem(lancReq.getPorcentagem())
                .valorPago(lancReq.getValorPago())
                .build();

        ficha.getLancamentos().add(lancamento);
        return FichaResponse.fromEntity(fichaRepository.save(ficha));
    }

    @Transactional
    public FichaResponse removerLancamento(Long fichaId, Long lancId, Usuario usuarioLogado) {
        Ficha ficha = fichaRepository.findById(fichaId)
                .orElseThrow(() -> new NegocioException("Ficha não encontrada"));
        validarPermissaoUnidade(usuarioLogado, ficha.getUnidade());
        boolean removido = ficha.getLancamentos().removeIf(l -> l.getId().equals(lancId));
        if (!removido) throw new NegocioException("Lançamento não encontrado nesta ficha");
        return FichaResponse.fromEntity(fichaRepository.save(ficha));
    }

    /**
     * Helper: gerente só pode mexer em fichas da unidade dele.
     * Dono pode mexer em qualquer uma.
     */
    private void validarPermissaoUnidade(Usuario usuario, Unidade unidade) {
        if (usuario.getTipo() == TipoUsuario.DONO) {
            return; // dono pode tudo
        }
        if (usuario.getUnidade() == null
                || !usuario.getUnidade().getId().equals(unidade.getId())) {
            throw new NegocioException("Você não tem permissão para essa unidade");
        }
    }
}
