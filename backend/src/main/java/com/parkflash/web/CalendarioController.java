package com.parkflash.web;

import com.parkflash.seguranca.UsuarioLogado;
import com.parkflash.servico.CalendarioService;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;

/**
 * Link de agenda para assinar no Google Calendar (e no iPhone/Outlook).
 * `/link` é da própria conta (gerente ou proprietário); o `.ics` é público, protegido pelo token do link.
 */
@RestController
@RequestMapping("/api/agenda")
public class CalendarioController {

    private static final MediaType ICS = new MediaType("text", "calendar", java.nio.charset.StandardCharsets.UTF_8);

    private final CalendarioService calendario;

    public CalendarioController(CalendarioService calendario) {
        this.calendario = calendario;
    }

    @GetMapping("/link")
    public CalendarioService.Link link(@AuthenticationPrincipal UsuarioLogado ator) {
        return calendario.link(ator.id());
    }

    @PostMapping("/link")
    @ResponseStatus(HttpStatus.CREATED)
    public CalendarioService.NovoLink gerar(@AuthenticationPrincipal UsuarioLogado ator) {
        return calendario.gerar(ator.id());
    }

    @DeleteMapping("/link")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void revogar(@AuthenticationPrincipal UsuarioLogado ator) {
        calendario.revogar(ator.id());
    }

    @GetMapping("/{token:[A-Za-z0-9_-]{20,100}}.ics")
    public ResponseEntity<String> ics(@PathVariable String token) {
        return ResponseEntity.ok()
                .contentType(ICS)
                .cacheControl(CacheControl.maxAge(Duration.ofMinutes(5)).cachePrivate())
                .header("Content-Disposition", "inline; filename=\"parkflash.ics\"")
                .header("X-Robots-Tag", "noindex")
                .body(calendario.ics(token));
    }
}
