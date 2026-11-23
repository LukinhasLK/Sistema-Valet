package com.parkflash.web.dto;

import com.parkflash.dominio.CategoriaDespesa;
import com.parkflash.dominio.Despesa;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;

public record DespesaDto(Long id, @NotNull LocalDate data, @NotNull Long unidadeId, @NotNull CategoriaDespesa categoria,
                         @NotBlank @Size(max = 200) String descricao, @NotNull @DecimalMin("0.01") BigDecimal valor, boolean cancelada) {

    public static DespesaDto de(Despesa d) {
        return new DespesaDto(d.getId(), d.getData(), d.getUnidadeId(), d.getCategoria(), d.getDescricao(), d.getValor(), d.isCancelada());
    }
}
