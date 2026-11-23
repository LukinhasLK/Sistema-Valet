package com.parkflash.servico;

import com.parkflash.dominio.Unidade;
import com.parkflash.erro.ConflitoException;
import com.parkflash.erro.NaoEncontradoException;
import com.parkflash.repositorio.UnidadeRepository;
import com.parkflash.web.dto.UnidadeDto;
import com.parkflash.seguranca.AcessoUnidades;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class UnidadeService {

    private final UnidadeRepository unidades;

    private final AuditoriaAdministrativa auditoria;

    public UnidadeService(UnidadeRepository unidades, AuditoriaAdministrativa auditoria) {
        this.unidades = unidades;
        this.auditoria = auditoria;
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
