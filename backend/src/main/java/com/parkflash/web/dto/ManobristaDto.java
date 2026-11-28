package com.parkflash.web.dto;

import com.parkflash.dominio.Manobrista;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ManobristaDto(Long id, @NotBlank @Size(max = 100) String nome, @Size(max = 20) String telefone,
                            @Size(max = 14) String cpf,
                            @com.fasterxml.jackson.annotation.JsonProperty(access = com.fasterxml.jackson.annotation.JsonProperty.Access.WRITE_ONLY)
                            @jakarta.validation.Valid PagamentoManobristaDto.AlterarPix pix, Boolean ativo,
                            @Size(max = 500) String observacoes) {

    public static ManobristaDto de(Manobrista m) {
        return new ManobristaDto(m.getId(), m.getNome(), m.getTelefone(), m.getCpf(), null, m.isAtivo(), m.getObservacoes());
    }
}
