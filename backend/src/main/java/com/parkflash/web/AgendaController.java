package com.parkflash.web;

import com.parkflash.seguranca.AcessoUnidades;
import com.parkflash.seguranca.UsuarioLogado;
import com.parkflash.servico.AgendaService;
import com.parkflash.servico.EventoFinanceiroService;
import com.parkflash.web.dto.AgendaDto.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api")
public class AgendaController {
    private final AgendaService agenda;

    private final EventoFinanceiroService financeiro;

    public AgendaController(AgendaService agenda, EventoFinanceiroService financeiro) {
        this.agenda = agenda;
        this.financeiro = financeiro;
    }

    @GetMapping("/eventos")
    public List<Evento> eventos(@RequestParam(required = false) Long unidadeId, @RequestParam(required = false) LocalDate de,
                                @RequestParam(required = false) LocalDate ate, @RequestParam(defaultValue = "0") @Min(0) int pagina,
                                @AuthenticationPrincipal UsuarioLogado ator) {
        return agenda.eventos(AcessoUnidades.de(ator), unidadeId, de, ate, pagina);
    }

    @GetMapping("/eventos/{id}")
    public Evento evento(@PathVariable long id, @AuthenticationPrincipal UsuarioLogado ator) {
        return agenda.evento(id, AcessoUnidades.de(ator));
    }

    @GetMapping("/eventos/{id}/financeiro")
    public EventoFinanceiroService.Conciliacao financeiro(@PathVariable long id,
            @RequestParam(defaultValue = "FICHA") EventoFinanceiroService.Registro tipo,
            @RequestParam(defaultValue = "0") @Min(0) int pagina, @AuthenticationPrincipal UsuarioLogado ator) {
        return financeiro.consultar(id, tipo, pagina, AcessoUnidades.de(ator));
    }

    @PutMapping("/eventos/{id}/financeiro/{tipo}/{registro}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void vincular(@PathVariable long id, @PathVariable EventoFinanceiroService.Registro tipo,
                         @PathVariable long registro, @AuthenticationPrincipal UsuarioLogado ator) {
        financeiro.vincular(id, tipo, registro, AcessoUnidades.de(ator));
    }

    @DeleteMapping("/eventos/{id}/financeiro/{tipo}/{registro}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void desvincular(@PathVariable long id, @PathVariable EventoFinanceiroService.Registro tipo,
                            @PathVariable long registro, @AuthenticationPrincipal UsuarioLogado ator) {
        financeiro.desvincular(id, tipo, registro, AcessoUnidades.de(ator));
    }

    @GetMapping("/escalas/{id}")
    public Escala escala(@PathVariable long id, @AuthenticationPrincipal UsuarioLogado ator) {
        return agenda.escala(id, AcessoUnidades.de(ator));
    }

    @PostMapping("/eventos")
    @ResponseStatus(HttpStatus.CREATED)
    public Evento criarEvento(@Valid @RequestBody Evento pedido, @AuthenticationPrincipal UsuarioLogado ator) {
        return agenda.salvarEvento(null, pedido, AcessoUnidades.de(ator));
    }

    @PutMapping("/eventos/{id}")
    public Evento atualizarEvento(@PathVariable long id, @Valid @RequestBody Evento pedido, @AuthenticationPrincipal UsuarioLogado ator) {
        return agenda.salvarEvento(id, pedido, AcessoUnidades.de(ator));
    }

    @GetMapping("/escalas")
    public List<Escala> escalas(@RequestParam(required = false) Long unidadeId, @RequestParam(required = false) LocalDate de,
                                @RequestParam(required = false) LocalDate ate, @RequestParam(defaultValue = "0") @Min(0) int pagina,
                                @AuthenticationPrincipal UsuarioLogado ator) {
        return agenda.escalas(AcessoUnidades.de(ator), unidadeId, de, ate, pagina);
    }

    @PostMapping("/escalas")
    @ResponseStatus(HttpStatus.CREATED)
    public Escala criarEscala(@Valid @RequestBody EscalaPedido pedido, @AuthenticationPrincipal UsuarioLogado ator) {
        return agenda.salvarEscala(null, pedido, ator);
    }

    @PutMapping("/escalas/{id}")
    public Escala atualizarEscala(@PathVariable long id, @Valid @RequestBody EscalaPedido pedido, @AuthenticationPrincipal UsuarioLogado ator) {
        return agenda.salvarEscala(id, pedido, ator);
    }

    @GetMapping("/escalas/{id}/historico")
    public List<AlteracaoEscala> historico(@PathVariable long id, @AuthenticationPrincipal UsuarioLogado ator) {
        return agenda.historico(id, AcessoUnidades.de(ator));
    }
}
