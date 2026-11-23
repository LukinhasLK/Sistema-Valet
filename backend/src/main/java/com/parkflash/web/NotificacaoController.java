package com.parkflash.web;

import com.parkflash.erro.ConflitoException;
import com.parkflash.notificacao.CaixaNotificacoes;
import com.parkflash.notificacao.CategoriaNotificacao;
import com.parkflash.notificacao.DispositivosPush;
import com.parkflash.notificacao.TransportePush;
import com.parkflash.seguranca.UsuarioLogado;
import com.parkflash.servico.FichaService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/notificacoes")
public class NotificacaoController {
    private final CaixaNotificacoes caixa;
    private final DispositivosPush dispositivos;
    private final TransportePush transporte;
    private final FichaService fichas;
    private final boolean enviarPush;

    public NotificacaoController(CaixaNotificacoes caixa, DispositivosPush dispositivos,
                                 TransportePush transporte, FichaService fichas,
                                 @Value("${parkflash.push.enviar:true}") boolean enviarPush) {
        this.caixa = caixa;
        this.dispositivos = dispositivos;
        this.transporte = transporte;
        this.fichas = fichas;
        this.enviarPush = enviarPush;
    }

    @GetMapping
    public List<CaixaNotificacoes.Item> listar(@RequestParam(required = false) @Positive Long antes,
                                              @RequestParam(defaultValue = "false") boolean naoLidas,
                                              @AuthenticationPrincipal UsuarioLogado ator) {
        return caixa.listar(ator.id(), antes, naoLidas);
    }

    @GetMapping("/pendentes")
    public Map<String, Long> pendentes(@AuthenticationPrincipal UsuarioLogado ator) {
        return Map.of("total", caixa.pendentes(ator.id()));
    }

    @PutMapping("/{id}/leitura")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void ler(@PathVariable long id, @AuthenticationPrincipal UsuarioLogado ator) {
        caixa.ler(ator.id(), id);
    }

    @PutMapping("/leitura")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void lerTodas(@AuthenticationPrincipal UsuarioLogado ator) {
        caixa.ler(ator.id(), null);
    }

    @GetMapping("/preferencias")
    public List<CaixaNotificacoes.Preferencia> preferencias(@AuthenticationPrincipal UsuarioLogado ator) {
        return caixa.preferencias(ator.id());
    }

    @PutMapping("/preferencias/{categoria}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void preferir(@PathVariable CategoriaNotificacao categoria, @Valid @RequestBody Preferencia pedido,
                         @AuthenticationPrincipal UsuarioLogado ator) {
        caixa.preferir(ator.id(), categoria, pedido.ativa());
    }

    @GetMapping("/push")
    public ConfigPush configuracao(@RequestParam(required = false) UUID dispositivo,
                                   @AuthenticationPrincipal UsuarioLogado ator) {
        return new ConfigPush(transporte.chavePublica(), dispositivos.inscrito(ator.id(), dispositivo), enviarPush && transporte.configurado());
    }

    @PutMapping("/push/{dispositivo}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void inscrever(@PathVariable UUID dispositivo, @Valid @RequestBody Inscricao pedido,
                           @AuthenticationPrincipal UsuarioLogado ator) {
        dispositivos.inscrever(ator.id(), dispositivo, pedido.endpoint(), pedido.chavePublica());
    }

    @DeleteMapping("/push/{dispositivo}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void remover(@PathVariable UUID dispositivo, @AuthenticationPrincipal UsuarioLogado ator) {
        dispositivos.remover(ator.id(), dispositivo);
    }

    @PostMapping("/push/{dispositivo}/teste")
    public ResultadoTeste testar(@PathVariable UUID dispositivo, @AuthenticationPrincipal UsuarioLogado ator) {
        if (!enviarPush || !transporte.configurado()) {
            throw new ConflitoException("O envio ao celular está indisponível neste ambiente.");
        }
        String endpoint = dispositivos.reservarTeste(ator.id(), dispositivo);
        try {
            int codigo = transporte.enviarTeste(endpoint);
            if (codigo == 404 || codigo == 410) {
                dispositivos.removerExpirada(ator.id(), dispositivo, endpoint);
                return new ResultadoTeste("EXPIRADA", codigo);
            }
            return new ResultadoTeste(codigo >= 200 && codigo < 300 ? "ACEITA" : "FALHOU", codigo);
        } catch (InterruptedException erro) {
            Thread.currentThread().interrupt();
            return new ResultadoTeste("FALHA_REDE", null);
        } catch (java.io.IOException erro) {
            return new ResultadoTeste("FALHA_REDE", null);
        }
    }

    @GetMapping("/push/diagnostico")
    public List<DispositivosPush.Diagnostico> diagnostico(@AuthenticationPrincipal UsuarioLogado ator) {
        return dispositivos.diagnostico(ator.id());
    }

    @PostMapping("/divergencias/{fichaId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void divergencia(@PathVariable long fichaId, @Valid @RequestBody Divergencia pedido,
                            @AuthenticationPrincipal UsuarioLogado ator) {
        fichas.sinalizarDivergencia(fichaId, pedido.motivo(), ator);
    }

    public record Preferencia(@NotNull Boolean ativa) {}
    public record Inscricao(@NotBlank @Size(max = 2048) String endpoint, @NotBlank @Size(max = 100) String chavePublica) {}
    public record ResultadoTeste(String estado, Integer codigo) {}
    public record ConfigPush(String chavePublica, boolean inscrito, boolean envioAtivo) {}
    public record Divergencia(@NotBlank @Size(max = 500) String motivo) {}
}
