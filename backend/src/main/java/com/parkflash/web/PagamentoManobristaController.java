package com.parkflash.web;

import com.parkflash.erro.RegraInvalidaException;
import com.parkflash.repositorio.PagamentoManobristaConsultas;
import com.parkflash.seguranca.UsuarioLogado;
import com.parkflash.seguranca.AcessoUnidades;
import com.parkflash.servico.PagamentoManobristaService;
import com.parkflash.servico.PixManobristaService;
import com.parkflash.web.dto.PagamentoManobristaDto.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDate;
import java.util.Map;

import static com.parkflash.servico.PagamentoManobristaService.FUSO_NEGOCIO;

@RestController
@RequestMapping("/api/pagamentos-manobristas")
public class PagamentoManobristaController {
    private final PagamentoManobristaConsultas consultas;
    private final PagamentoManobristaService pagamentos;
    private final PixManobristaService pix;

    public PagamentoManobristaController(PagamentoManobristaConsultas consultas,
                                         PagamentoManobristaService pagamentos, PixManobristaService pix) {
        this.consultas = consultas;
        this.pagamentos = pagamentos;
        this.pix = pix;
    }

    @GetMapping("/resumo")
    public Resumo resumo(@ModelAttribute Filtro filtro, @AuthenticationPrincipal UsuarioLogado ator) {
        return consultas.resumo(filtro, AcessoUnidades.de(ator));
    }

    @GetMapping("/diarias")
    public Pagina<Diaria> diarias(@ModelAttribute Filtro filtro,
                                  @RequestParam(defaultValue = "0") @Min(0) int pagina,
                                  @RequestParam(defaultValue = "15") @Min(1) @Max(50) int tamanho,
                                  @AuthenticationPrincipal UsuarioLogado ator) {
        return consultas.diarias(filtro, pagina, tamanho, AcessoUnidades.de(ator));
    }

    @GetMapping("/conferencia")
    public Pagina<Candidato> candidatos(@ModelAttribute Filtro filtro,
                                        @RequestParam(defaultValue = "0") @Min(0) int pagina,
                                        @RequestParam(defaultValue = "15") @Min(1) @Max(50) int tamanho,
                                        @AuthenticationPrincipal UsuarioLogado ator) {
        return consultas.candidatos(filtro, pagina, tamanho, LocalDate.now(FUSO_NEGOCIO), AcessoUnidades.de(ator));
    }

    @PostMapping("/conferencia/{fichaId}")
    public Map<String, Long> reconhecer(@PathVariable long fichaId, @Valid @RequestBody Reconhecimento pedido,
                                       @AuthenticationPrincipal UsuarioLogado ator) {
        return Map.of("id", pagamentos.reconhecer(fichaId, pedido, ator));
    }

    @GetMapping("/historico")
    public Pagina<Pagamento> historico(@ModelAttribute Filtro filtro,
                                       @RequestParam(defaultValue = "0") @Min(0) int pagina,
                                       @RequestParam(defaultValue = "15") @Min(1) @Max(50) int tamanho,
                                       @AuthenticationPrincipal UsuarioLogado ator) {
        return consultas.historico(filtro, pagina, tamanho, AcessoUnidades.de(ator));
    }

    @GetMapping("/historico/{id}")
    public Pagamento detalhar(@PathVariable long id, @AuthenticationPrincipal UsuarioLogado ator) {
        return pagamentos.detalhar(id, AcessoUnidades.de(ator));
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Pagamento confirmar(@Valid @RequestPart Confirmacao dados,
                                @RequestPart(required = false) MultipartFile comprovante,
                                @AuthenticationPrincipal UsuarioLogado ator) {
        try {
            return pagamentos.confirmar(dados, comprovante == null ? null : comprovante.getBytes(), ator);
        } catch (IOException e) {
            throw new RegraInvalidaException("Não foi possível ler o comprovante.");
        }
    }

    @PostMapping("/historico/{id}/estorno")
    public Pagamento estornar(@PathVariable long id, @Valid @RequestBody Estorno pedido,
                               @AuthenticationPrincipal UsuarioLogado ator) {
        return pagamentos.estornar(id, pedido, ator);
    }

    /** Anula uma diária lançada errada (nunca paga). O motivo fica registrado. */
    @PostMapping("/diarias/{id}/anulacao")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void anular(@PathVariable long id, @Valid @RequestBody Estorno pedido, @AuthenticationPrincipal UsuarioLogado ator) {
        pagamentos.anular(id, pedido.motivo(), ator);
    }

    @GetMapping("/historico/{id}/comprovante")
    public ResponseEntity<byte[]> comprovante(@PathVariable long id, @AuthenticationPrincipal UsuarioLogado ator) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename("comprovante-" + id + ".pdf").build().toString())
                .contentType(MediaType.APPLICATION_PDF).body(pagamentos.baixarComprovante(id, AcessoUnidades.de(ator)));
    }

    @GetMapping("/pix/{id}")
    public ResponseEntity<Pix> consultarPix(@PathVariable long id, @AuthenticationPrincipal UsuarioLogado ator) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(pix.consultar(id, ator));
    }

    @PutMapping("/pix/{id}")
    public ResponseEntity<Pix> salvarPix(@PathVariable long id, @Valid @RequestBody AlterarPix pedido,
                                         @AuthenticationPrincipal UsuarioLogado ator) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(pix.salvar(id, pedido, ator));
    }

    @PostMapping("/pix/{id}/revelar")
    public ResponseEntity<ChavePix> revelarPix(@PathVariable long id, @AuthenticationPrincipal UsuarioLogado ator) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(pix.revelar(id, ator));
    }
}
