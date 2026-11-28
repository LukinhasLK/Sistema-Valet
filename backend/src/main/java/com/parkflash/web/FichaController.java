package com.parkflash.web;

import com.parkflash.servico.FichaService;
import com.parkflash.seguranca.AcessoUnidades;
import com.parkflash.seguranca.UsuarioLogado;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import com.parkflash.web.dto.FichaRequest;
import com.parkflash.web.dto.FichaResponse;
import com.parkflash.web.dto.TransicaoFicha;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/fichas")
@Tag(name = "Fichas")
public class FichaController {

    private final FichaService servico;

    public FichaController(FichaService servico) {
        this.servico = servico;
    }

    @GetMapping
    public List<FichaResponse> listar(@AuthenticationPrincipal UsuarioLogado ator) {
        return servico.listar(AcessoUnidades.de(ator));
    }

    @GetMapping("/{id}")
    public FichaResponse detalhar(@PathVariable Long id, @AuthenticationPrincipal UsuarioLogado ator) {
        return servico.detalhar(id, AcessoUnidades.de(ator));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Lança uma ficha; totais são calculados pelo servidor")
    public FichaResponse criar(@Valid @RequestBody FichaRequest pedido, @AuthenticationPrincipal UsuarioLogado ator) {
        return servico.criar(pedido, ator);
    }

    @PutMapping("/{id}")
    public FichaResponse atualizar(@PathVariable Long id, @Valid @RequestBody FichaRequest pedido, @AuthenticationPrincipal UsuarioLogado ator) {
        return servico.atualizar(id, pedido, ator);
    }

    @PostMapping("/{id}/transicao")
    public FichaResponse transicao(@PathVariable Long id, @Valid @RequestBody TransicaoFicha pedido,
                                   @AuthenticationPrincipal UsuarioLogado ator) {
        return servico.transicao(id, pedido, ator);
    }

    @GetMapping("/{id}/historico")
    public List<TransicaoFicha.Registro> historico(@PathVariable Long id, @AuthenticationPrincipal UsuarioLogado ator) {
        return servico.historico(id, AcessoUnidades.de(ator));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void excluir(@PathVariable Long id, @AuthenticationPrincipal UsuarioLogado ator) {
        servico.excluir(id, ator);
    }
}
