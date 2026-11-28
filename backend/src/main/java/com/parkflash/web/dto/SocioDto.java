package com.parkflash.web.dto;

import com.parkflash.dominio.Socio;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;

public record SocioDto(Long id, @NotBlank @Size(max = 100) String nome, List<@Valid PercentualUnidadeDto> percentuais) {

    public static SocioDto de(Socio s) {
        return new SocioDto(s.getId(), s.getNome(), s.getPercentuais().stream()
                .map(p -> new PercentualUnidadeDto(p.getUnidadeId(), p.getPercentual()))
                .toList());
    }
}
