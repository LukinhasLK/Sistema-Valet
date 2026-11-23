package com.parkflash.web.dto;

import com.parkflash.dominio.Unidade;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UnidadeDto(Long id, @NotBlank @Size(max = 100) String nome, @NotBlank @Size(max = 200) String endereco,
                         @Size(max = 20) String telefone, Boolean ativa) {

    public static UnidadeDto de(Unidade u) {
        return new UnidadeDto(u.getId(), u.getNome(), u.getEndereco(), u.getTelefone(), u.isAtiva());
    }
}
