package com.parkflash.web;

import com.parkflash.servico.DespesaService;
import com.parkflash.seguranca.AcessoUnidades;
import com.parkflash.seguranca.UsuarioLogado;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import com.parkflash.web.dto.DespesaDto;
import com.parkflash.web.dto.HistoricoDespesa;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/despesas")
@Tag(name = "Despesas fixas")
public class DespesaController {

    private final DespesaService servico;

    public DespesaController(DespesaService servico) {
        this.servico = servico;
    }

    @GetMapping
    public List<DespesaDto> listar(@AuthenticationPrincipal UsuarioLogado ator) {
        return servico.listar(AcessoUnidades.de(ator));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public DespesaDto criar(@Valid @RequestBody DespesaDto dto, @AuthenticationPrincipal UsuarioLogado ator) {
        return servico.criar(dto, ator);
    }

    @PutMapping("/{id}")
    public DespesaDto atualizar(@PathVariable Long id, @Valid @RequestBody DespesaDto dto, @AuthenticationPrincipal UsuarioLogado ator) {
        return servico.atualizar(id, dto, ator);
    }

    @GetMapping("/{id}/historico")
    public List<HistoricoDespesa> historico(@PathVariable long id, @AuthenticationPrincipal UsuarioLogado ator) {
        return servico.historico(id, AcessoUnidades.de(ator));
    }

    @PostMapping("/{id}/cancelamento")
    public DespesaDto cancelar(@PathVariable long id, @Valid @RequestBody HistoricoDespesa.Cancelamento cancelamento,
                               @AuthenticationPrincipal UsuarioLogado ator) {
        return servico.cancelar(id, cancelamento.justificativa(), ator);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void excluir(@PathVariable Long id, @AuthenticationPrincipal UsuarioLogado ator) {
        servico.cancelar(id, "Cancelamento pela API legada.", ator);
    }
}
