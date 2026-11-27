package com.parkflash.web;

import com.parkflash.seguranca.UsuarioLogado;
import com.parkflash.servico.PendenciaService;
import com.parkflash.web.dto.PendenciaDto;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Pendências do usuário logado (Perdidinho ajudante). Liberado a qualquer autenticado: o serviço filtra por nível. */
@RestController
@RequestMapping("/api/pendencias")
public class PendenciaController {

    private final PendenciaService pendencias;

    public PendenciaController(PendenciaService pendencias) {
        this.pendencias = pendencias;
    }

    @GetMapping
    public List<PendenciaDto> listar(@AuthenticationPrincipal UsuarioLogado ator) {
        return pendencias.listar(ator);
    }
}
