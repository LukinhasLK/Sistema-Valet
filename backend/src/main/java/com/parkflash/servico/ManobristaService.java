package com.parkflash.servico;

import com.parkflash.dominio.Manobrista;
import com.parkflash.dominio.NivelAcesso;
import com.parkflash.seguranca.UsuarioLogado;
import com.parkflash.erro.NaoEncontradoException;
import com.parkflash.repositorio.ManobristaRepository;
import com.parkflash.web.dto.ManobristaDto;
import org.springframework.data.domain.Sort;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class ManobristaService {

    private final ManobristaRepository manobristas;

    private final PixManobristaService pix;

    public ManobristaService(ManobristaRepository manobristas, PixManobristaService pix) {
        this.pix = pix;
        this.manobristas = manobristas;
    }

    @Transactional(readOnly = true)
    public List<ManobristaDto> listar(UsuarioLogado ator) {
        return manobristas.findAll(Sort.by("id")).stream()
                .map(m -> ator.nivel() == NivelAcesso.PROPRIETARIO ? ManobristaDto.de(m)
                        : new ManobristaDto(m.getId(), m.getNome(), null, null, null, m.isAtivo(), null)).toList();
    }

    @Transactional
    public ManobristaDto criar(ManobristaDto dto, UsuarioLogado ator) {
        if (ator.nivel() != NivelAcesso.PROPRIETARIO && dto.pix() != null) {
            throw new AccessDeniedException("Somente o proprietário pode cadastrar chaves Pix.");
        }
        Manobrista manobrista = new Manobrista();
        preencher(manobrista, dto);
        if (ator.nivel() != NivelAcesso.PROPRIETARIO) {
            manobrista.setAtivo(true);
            manobrista.setObservacoes(null);
        }
        manobristas.saveAndFlush(manobrista);
        if (dto.pix() != null) pix.salvar(manobrista.getId(), dto.pix(), ator);
        return ator.nivel() == NivelAcesso.PROPRIETARIO ? ManobristaDto.de(manobrista)
                : new ManobristaDto(manobrista.getId(), manobrista.getNome(), null, null, null, true, null);
    }

    @Transactional
    public ManobristaDto atualizar(Long id, ManobristaDto dto) {
        Manobrista manobrista = buscar(id);
        preencher(manobrista, dto);
        return ManobristaDto.de(manobrista);
    }

    @Transactional
    public void desativar(Long id) {
        buscar(id).setAtivo(false);
    }

    private Manobrista buscar(Long id) {
        return manobristas.findById(id).orElseThrow(() -> new NaoEncontradoException("Manobrista não encontrado."));
    }

    private static void preencher(Manobrista manobrista, ManobristaDto dto) {
        manobrista.setNome(dto.nome().trim());
        manobrista.setTelefone(dto.telefone());
        manobrista.setCpf(dto.cpf());
        if (dto.ativo() != null) manobrista.setAtivo(dto.ativo());
        if (dto.observacoes() != null) manobrista.setObservacoes(dto.observacoes().strip());
    }
}
