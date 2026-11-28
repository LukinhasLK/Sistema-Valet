package com.parkflash.servico;

import com.parkflash.dominio.Despesa;
import com.parkflash.erro.ConflitoException;
import com.parkflash.erro.NaoEncontradoException;
import com.parkflash.erro.RegraInvalidaException;
import com.parkflash.repositorio.DespesaRepository;
import com.parkflash.repositorio.UnidadeRepository;
import com.parkflash.web.dto.DespesaDto;
import com.parkflash.web.dto.HistoricoDespesa;
import com.parkflash.seguranca.UsuarioLogado;
import org.springframework.jdbc.core.simple.JdbcClient;

import java.sql.Types;
import com.parkflash.seguranca.AcessoUnidades;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class DespesaService {

    private final DespesaRepository despesas;
    private final UnidadeRepository unidades;
    private final JdbcClient jdbc;

    public DespesaService(DespesaRepository despesas, UnidadeRepository unidades, JdbcClient jdbc) {
        this.despesas = despesas;
        this.unidades = unidades;
        this.jdbc = jdbc;
    }

    @Transactional(readOnly = true)
    public List<DespesaDto> listar(AcessoUnidades acesso) {
        var registros = acesso.todas() ? despesas.findAllByOrderByDataDescIdDesc()
                : despesas.findByUnidadeIdInOrderByDataDescIdDesc(acesso.unidades());
        return registros.stream().map(DespesaDto::de).toList();
    }

    @Transactional
    public DespesaDto criar(DespesaDto dto, UsuarioLogado ator) {
        AcessoUnidades.de(ator).exigir(dto.unidadeId());
        Despesa despesa = new Despesa();
        preencher(despesa, dto);
        despesas.saveAndFlush(despesa);
        auditar(despesa, ator.id(), "CRIAR", null);
        return DespesaDto.de(despesa);
    }

    @Transactional
    public DespesaDto atualizar(Long id, DespesaDto dto, UsuarioLogado ator) {
        Despesa despesa = buscar(id);
        var acesso = AcessoUnidades.de(ator);
        acesso.exigir(despesa.getUnidadeId());
        acesso.exigir(dto.unidadeId());
        if (despesa.isCancelada()) throw new ConflitoException("Uma despesa cancelada não pode ser alterada.");
        auditar(despesa, ator.id(), "ANTES_EDICAO", null);
        preencher(despesa, dto);
        auditar(despesa, ator.id(), "EDITAR", null);
        return DespesaDto.de(despesa);
    }

    @Transactional
    public DespesaDto cancelar(Long id, String justificativa, UsuarioLogado ator) {
        Despesa despesa = buscar(id);
        AcessoUnidades.de(ator).exigir(despesa.getUnidadeId());
        if (!despesa.isCancelada()) {
            despesa.cancelar();
            auditar(despesa, ator.id(), "CANCELAR", justificativa.strip());
        }
        return DespesaDto.de(despesa);
    }

    @Transactional(readOnly = true)
    public List<HistoricoDespesa> historico(long id, AcessoUnidades acesso) {
        var despesa = despesas.findById(id).orElseThrow(() -> new NaoEncontradoException("Despesa não encontrada."));
        acesso.exigir(despesa.getUnidadeId());
        String sql = """
                SELECT h.id, h.acao, u.nome AS ator, h.registrado_em, h.data, h.categoria,
                       h.descricao, h.valor, h.justificativa
                FROM despesa_historico h JOIN usuario u ON u.id = h.ator_id WHERE h.despesa_id = :id
                """;
        if (acesso.todas()) {
            return jdbc.sql(sql + " ORDER BY h.id DESC").param("id", id).query(HistoricoDespesa.class).list();
        }
        return jdbc.sql(sql + " AND h.unidade_id IN (:unidades) ORDER BY h.id DESC")
                .param("id", id).param("unidades", acesso.unidades()).query(HistoricoDespesa.class).list();
    }

    private void auditar(Despesa despesa, long ator, String acao, String justificativa) {
        jdbc.sql("""
                INSERT INTO despesa_historico
                    (despesa_id, unidade_id, ator_id, acao, data, categoria, descricao, valor, justificativa)
                VALUES (:despesa, :unidade, :ator, :acao, :data, :categoria, :descricao, :valor, :justificativa)
                """).param("despesa", despesa.getId()).param("unidade", despesa.getUnidadeId()).param("ator", ator)
                .param("acao", acao).param("data", despesa.getData()).param("categoria", despesa.getCategoria().name())
                .param("descricao", despesa.getDescricao()).param("valor", despesa.getValor())
                .param("justificativa", justificativa, Types.VARCHAR).update();
    }

    private Despesa buscar(Long id) {
        return despesas.buscarParaAlteracao(id).orElseThrow(() -> new NaoEncontradoException("Despesa não encontrada."));
    }

    private void preencher(Despesa despesa, DespesaDto dto) {
        if (!dto.unidadeId().equals(despesa.getUnidadeId()) && !unidades.existsByIdAndAtivaTrue(dto.unidadeId())) {
            throw new RegraInvalidaException("Escolha uma unidade ativa.");
        }
        despesa.setData(dto.data());
        despesa.setUnidadeId(dto.unidadeId());
        despesa.setCategoria(dto.categoria());
        despesa.setDescricao(dto.descricao().trim());
        despesa.setValor(CalculoFicha.arredondar(dto.valor()));
    }
}
