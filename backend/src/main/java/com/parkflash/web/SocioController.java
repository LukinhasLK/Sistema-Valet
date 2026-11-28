package com.parkflash.web;

import com.parkflash.servico.SocioService;
import com.parkflash.servico.RateioService;
import com.parkflash.seguranca.UsuarioLogado;
import com.parkflash.web.dto.RateioUnidadeDto;
import org.springframework.security.core.annotation.AuthenticationPrincipal;

import java.time.LocalDate;
import com.parkflash.web.dto.SocioDto;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/socios")
@Tag(name = "Sócios")
public class SocioController {

    private final SocioService servico;
    private final RateioService rateios;

    public SocioController(SocioService servico, RateioService rateios) {
        this.servico = servico;
        this.rateios = rateios;
    }

    @GetMapping
    public List<SocioDto> listar() {
        return servico.listar();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public SocioDto criar(@Valid @RequestBody SocioDto dto) {
        return servico.criar(dto);
    }

    @PutMapping("/{id}")
    public SocioDto atualizar(@PathVariable Long id, @Valid @RequestBody SocioDto dto) {
        return servico.atualizar(id, dto);
    }

    @GetMapping("/rateio/{unidadeId}")
    public List<RateioService.Cota> rateio(@PathVariable long unidadeId, @RequestParam LocalDate data) {
        return rateios.cotas(unidadeId, data);
    }

    @GetMapping("/rateio/{unidadeId}/historico")
    public List<RateioUnidadeDto.Revisao> historico(@PathVariable long unidadeId) {
        return rateios.historico(unidadeId);
    }

    @PostMapping("/rateio/{unidadeId}")
    @ResponseStatus(HttpStatus.CREATED)
    public void configurar(@PathVariable long unidadeId, @Valid @RequestBody RateioUnidadeDto pedido,
                            @AuthenticationPrincipal UsuarioLogado ator) {
        rateios.configurar(unidadeId, pedido, ator.id());
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void excluir(@PathVariable Long id) {
        servico.excluir(id);
    }
}
