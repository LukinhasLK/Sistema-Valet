package com.parkflash.web;

import com.parkflash.servico.UnidadeService;
import com.parkflash.seguranca.AcessoUnidades;
import com.parkflash.seguranca.UsuarioLogado;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import com.parkflash.web.dto.UnidadeDto;
import com.parkflash.servico.AuditoriaAdministrativa;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/unidades")
@Tag(name = "Unidades")
public class UnidadeController {

    private final UnidadeService servico;

    private final AuditoriaAdministrativa auditoria;

    public UnidadeController(UnidadeService servico, AuditoriaAdministrativa auditoria) {
        this.servico = servico;
        this.auditoria = auditoria;
    }

    @GetMapping
    public List<UnidadeDto> listar(@AuthenticationPrincipal UsuarioLogado ator) {
        return servico.listar(AcessoUnidades.de(ator));
    }

    @GetMapping("/{id}/auditoria")
    public AuditoriaAdministrativa.Pagina auditoria(@PathVariable long id, @RequestParam(required = false) Long antes) {
        return auditoria.consultar(AuditoriaAdministrativa.Tipo.UNIDADE, id, antes);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public UnidadeDto criar(@Valid @RequestBody UnidadeDto dto,
                              @AuthenticationPrincipal UsuarioLogado ator) {
        return servico.criar(dto, ator.id());
    }

    @PutMapping("/{id}")
    public UnidadeDto atualizar(@PathVariable Long id, @Valid @RequestBody UnidadeDto dto,
                              @AuthenticationPrincipal UsuarioLogado ator) {
        return servico.atualizar(id, dto, ator.id());
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void desativar(@PathVariable Long id, @AuthenticationPrincipal UsuarioLogado ator) {
        servico.desativar(id, ator.id());
    }

    @DeleteMapping("/{id}/definitivo")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void excluir(@PathVariable Long id, @AuthenticationPrincipal UsuarioLogado ator) {
        servico.excluir(id, ator.id());
    }
}
