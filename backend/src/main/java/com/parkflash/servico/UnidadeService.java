package com.parkflash.servico;

import com.parkflash.dominio.Unidade;
import com.parkflash.erro.ConflitoException;
import org.springframework.dao.DataIntegrityViolationException;
import com.parkflash.erro.NaoEncontradoException;
import com.parkflash.repositorio.UnidadeRepository;
import com.parkflash.web.dto.UnidadeDto;
import com.parkflash.seguranca.AcessoUnidades;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import org.springframework.jdbc.core.simple.JdbcClient;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class UnidadeService {

    private final UnidadeRepository unidades;

    private final AuditoriaAdministrativa auditoria;

    private final JdbcClient jdbc;

    /** Registros de dinheiro ou operação: qualquer um deles impede a exclusão definitiva (tabela → rótulo no singular e no plural). */
    private static final Map<String, String[]> VINCULOS = new LinkedHashMap<>();
    static {
        VINCULOS.put("ficha", new String[] {"ficha", "fichas"});
        VINCULOS.put("ficha_historico", new String[] {"registro de histórico de fichas", "registros de histórico de fichas"});
        VINCULOS.put("despesa", new String[] {"despesa", "despesas"});
        VINCULOS.put("despesa_historico", new String[] {"registro de histórico de despesas", "registros de histórico de despesas"});
        VINCULOS.put("diaria_a_pagar", new String[] {"diária de manobrista", "diárias de manobristas"});
        VINCULOS.put("diaria_anulacao", new String[] {"diária anulada", "diárias anuladas"});
        VINCULOS.put("evento", new String[] {"evento", "eventos"});
        VINCULOS.put("escala", new String[] {"escala", "escalas"});
        VINCULOS.put("escala_historico", new String[] {"registro de histórico de escalas", "registros de histórico de escalas"});
    }

    public UnidadeService(UnidadeRepository unidades, AuditoriaAdministrativa auditoria, JdbcClient jdbc) {
        this.unidades = unidades;
        this.auditoria = auditoria;
        this.jdbc = jdbc;
    }

    @Transactional(readOnly = true)
    public List<UnidadeDto> listar(AcessoUnidades acesso) {
        var registros = acesso.todas() ? unidades.findAll(Sort.by("id"))
                : unidades.findByIdInOrderById(acesso.unidades());
        return registros.stream().map(UnidadeDto::de).toList();
    }

    @Transactional
    public UnidadeDto criar(UnidadeDto dto, long ator) {
        if (unidades.existsByNomeIgnoreCase(dto.nome().trim())) {
            throw new ConflitoException("Já existe uma unidade com esse nome.");
        }
        Unidade unidade = new Unidade();
        preencher(unidade, dto);
        var criada = UnidadeDto.de(unidades.saveAndFlush(unidade));
        auditar(null, criada, ator);
        return criada;
    }

    @Transactional
    public UnidadeDto atualizar(Long id, UnidadeDto dto, long ator) {
        Unidade unidade = buscarParaAlteracao(id);
        if (unidades.existsByNomeIgnoreCaseAndIdNot(dto.nome().trim(), id)) {
            throw new ConflitoException("Já existe uma unidade com esse nome.");
        }
        var anterior = UnidadeDto.de(unidade);
        preencher(unidade, dto);
        var atual = UnidadeDto.de(unidade);
        auditar(anterior, atual, ator);
        return atual;
    }

    @Transactional
    public void desativar(Long id, long ator) {
        var unidade = buscarParaAlteracao(id);
        var anterior = UnidadeDto.de(unidade);
        unidade.setAtiva(false);
        auditar(anterior, UnidadeDto.de(unidade), ator);
    }

    /**
     * Exclusão definitiva: só para unidade sem nenhum registro de operação ou dinheiro.
     * Configurações sem lançamento (acesso de usuários, participação e rateio de sócios, destino de
     * notificações) saem junto, na mesma transação. A trilha administrativa da unidade permanece.
     */
    @Transactional
    public void excluir(Long id, long ator) {
        var unidade = buscarParaAlteracao(id);
        var existentes = new ArrayList<String>();
        VINCULOS.forEach((tabela, rotulo) -> {
            long total = jdbc.sql("SELECT COUNT(*) FROM " + tabela + " WHERE unidade_id = :id").param("id", id)
                    .query(Long.class).single();
            if (total > 0) existentes.add(total + " " + (total == 1 ? rotulo[0] : rotulo[1]));
        });
        if (!existentes.isEmpty()) {
            throw new ConflitoException(unidade.getNome() + " tem " + juntar(existentes)
                    + ". Para preservar o histórico, desative a unidade.");
        }
        jdbc.sql("DELETE FROM rateio_unidade_socio WHERE rateio_id IN (SELECT id FROM rateio_unidade WHERE unidade_id = :id)").param("id", id).update();
        for (String tabela : List.of("rateio_unidade", "socio_participacao", "usuario_unidade", "notificacao_evento_unidade")) {
            jdbc.sql("DELETE FROM " + tabela + " WHERE unidade_id = :id").param("id", id).update();
        }
        var anterior = UnidadeDto.de(unidade);
        try {
            unidades.delete(unidade);
            unidades.flush();
        } catch (DataIntegrityViolationException e) {
            // Alguém lançou algo nesta unidade entre a checagem e a exclusão: o banco recusa e nada é apagado.
            throw new ConflitoException("Acabou de entrar um lançamento em " + unidade.getNome()
                    + ". Atualize a tela: para preservar o histórico, desative a unidade.");
        }
        auditoria.registrar(AuditoriaAdministrativa.Tipo.UNIDADE, id, ator, "Situação", situacao(anterior.ativa()), "Excluída");
        auditoria.registrar(AuditoriaAdministrativa.Tipo.UNIDADE, id, ator, "Nome", anterior.nome(), null);
    }

    private static String juntar(List<String> itens) {
        if (itens.size() == 1) return itens.get(0);
        return String.join(", ", itens.subList(0, itens.size() - 1)) + " e " + itens.get(itens.size() - 1);
    }

    private Unidade buscarParaAlteracao(Long id) {
        return unidades.buscarParaAlteracao(id).orElseThrow(() -> new NaoEncontradoException("Unidade não encontrada."));
    }

    private void auditar(UnidadeDto antes, UnidadeDto atual, long ator) {
        var tipo = AuditoriaAdministrativa.Tipo.UNIDADE;
        auditoria.registrar(tipo, atual.id(), ator, "Nome", antes == null ? null : antes.nome(), atual.nome());
        auditoria.registrar(tipo, atual.id(), ator, "Endereço", antes == null ? null : antes.endereco(), atual.endereco());
        auditoria.registrar(tipo, atual.id(), ator, "Telefone", antes == null ? null : antes.telefone(), atual.telefone());
        auditoria.registrar(tipo, atual.id(), ator, "Situação",
                antes == null ? null : situacao(antes.ativa()), situacao(atual.ativa()));
    }

    private static String situacao(boolean ativa) { return ativa ? "Ativa" : "Inativa"; }

    public Unidade buscar(Long id) {
        return unidades.findById(id).orElseThrow(() -> new NaoEncontradoException("Unidade não encontrada."));
    }

    private static void preencher(Unidade unidade, UnidadeDto dto) {
        unidade.setNome(dto.nome().trim());
        unidade.setEndereco(dto.endereco().trim());
        unidade.setTelefone(dto.telefone());
        if (dto.ativa() != null) unidade.setAtiva(dto.ativa());
    }
}
