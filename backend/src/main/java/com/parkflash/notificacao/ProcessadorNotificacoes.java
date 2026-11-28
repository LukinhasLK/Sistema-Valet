package com.parkflash.notificacao;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.time.Duration;

@Component
@ConditionalOnProperty(name = "parkflash.notificacoes.processar", havingValue = "true", matchIfMissing = true)
public class ProcessadorNotificacoes {
    private static final Logger LOG = LoggerFactory.getLogger(ProcessadorNotificacoes.class);
    private final FilaNotificacoes fila;
    private final TransportePush transporte;
    private final LembretesEventos lembretes;
    private final boolean enviarPush;

    public ProcessadorNotificacoes(FilaNotificacoes fila, TransportePush transporte, LembretesEventos lembretes,
                                   @Value("${parkflash.push.enviar:true}") boolean enviarPush) {
        this.fila = fila;
        this.transporte = transporte;
        this.lembretes = lembretes;
        this.enviarPush = enviarPush;
    }

    @Scheduled(fixedDelay = 3000, scheduler = "schedulerNotificacoes")
    public void distribuir() {
        fila.distribuir();
    }

    @Scheduled(fixedDelay = 60_000, scheduler = "schedulerNotificacoes")
    public void lembrarEventos() {
        lembretes.registrarProximos();
    }

    @Scheduled(fixedDelay = 3000, scheduler = "schedulerNotificacoes")
    public void entregar() {
        if (!enviarPush || !transporte.configurado()) return;
        for (int i = 0; i < 8; i++) {
            var proxima = fila.buscarProxima(transporte.chavePublica());
            if (proxima.isEmpty()) return;
            var entrega = proxima.get();
            if (entrega.id() != 0 && !enviar(entrega)) return;
        }
    }

    private boolean enviar(FilaNotificacoes.Entrega entrega) {
        try {
            int resposta = transporte.enviar(entrega.endpoint());
            if (resposta >= 200 && resposta < 300) {
                fila.concluir(entrega, "ACEITA", "HTTP_" + resposta, FilaNotificacoes.agora());
            } else if (resposta == 404 || resposta == 410) {
                resultado(entrega, "EXPIRADA", "HTTP_" + resposta, Duration.ZERO);
            } else if (resposta == 429 || resposta == 408 || resposta >= 500) {
                repetir(entrega, "HTTP_" + resposta);
            } else {
                resultado(entrega, "FALHOU", "HTTP_" + resposta, Duration.ZERO);
            }
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            return false; // A reserva expira e outro ciclo pode retomar.
        } catch (IOException ex) {
            repetir(entrega, "FALHA_REDE");
        } catch (RuntimeException ex) {
            resultado(entrega, "FALHOU", "CONFIGURACAO_OU_ENDPOINT", Duration.ZERO);
        }
        return true;
    }

    private void repetir(FilaNotificacoes.Entrega entrega, String codigo) {
        if (entrega.tentativas() >= FilaNotificacoes.MAX_TENTATIVAS) {
            resultado(entrega, "FALHOU", codigo, Duration.ZERO);
        } else {
            resultado(entrega, "PENDENTE", codigo, Duration.ofMinutes(1L << (entrega.tentativas() - 1)));
        }
    }

    private void resultado(FilaNotificacoes.Entrega entrega, String estado, String codigo, Duration atraso) {
        if (fila.concluir(entrega, estado, codigo, FilaNotificacoes.agora().plus(atraso))) {
            LOG.warn("Web Push entrega={} tentativa={} estado={} codigo={}",
                    entrega.id(), entrega.tentativas(), estado, codigo);
        }
    }
}
