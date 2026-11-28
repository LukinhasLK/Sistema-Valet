package com.parkflash.web;

import com.parkflash.seguranca.UsuarioLogado;
import com.parkflash.servico.SociedadeService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Visão do sócio: unidades onde tem participação e a parte dele no resultado do mês. */
@RestController
@RequestMapping("/api/sociedade")
public class SociedadeController {

    private final SociedadeService sociedade;

    public SociedadeController(SociedadeService sociedade) {
        this.sociedade = sociedade;
    }

    @GetMapping
    public SociedadeService.Sociedade consultar(@RequestParam int mes, @RequestParam int ano,
                                                @RequestParam(required = false) Long socioId,
                                                @AuthenticationPrincipal UsuarioLogado ator) {
        return sociedade.consultar(ator, socioId, mes, ano);
    }
}
