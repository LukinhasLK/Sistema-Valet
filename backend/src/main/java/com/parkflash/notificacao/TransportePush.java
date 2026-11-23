package com.parkflash.notificacao;

import io.jsonwebtoken.Jwts;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.security.AlgorithmParameters;
import java.security.GeneralSecurityException;
import java.security.KeyFactory;
import java.security.PrivateKey;
import java.security.Signature;
import java.security.spec.ECGenParameterSpec;
import java.security.spec.ECParameterSpec;
import java.security.spec.ECPoint;
import java.security.spec.ECPublicKeySpec;
import java.security.spec.PKCS8EncodedKeySpec;
import java.time.Duration;
import java.time.Instant;
import java.util.Arrays;
import java.util.Base64;
import java.util.Date;
import java.util.Locale;
import java.util.LinkedHashMap;
import java.math.BigInteger;

@Component
public class TransportePush {
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5))
            .followRedirects(HttpClient.Redirect.NEVER).build();
    private final Chaves chaves;
    private final LinkedHashMap<String, Token> tokens = new LinkedHashMap<>(16, .75f, true);

    public TransportePush(@Value("${parkflash.push.chave-publica:}") String publica,
                          @Value("${parkflash.push.chave-privada:}") String privada,
                          @Value("${parkflash.push.contato:}") String contato) {
        this.chaves = carregar(publica.strip(), privada.strip(), contato.strip());
    }

    public boolean configurado() { return chaves != null; }
    public String chavePublica() { return chaves == null ? null : chaves.publica(); }

    public int enviar(String endpoint) throws java.io.IOException, InterruptedException {
        return http.send(preparar(endpoint), HttpResponse.BodyHandlers.discarding()).statusCode();
    }

    public int enviarTeste(String endpoint) throws java.io.IOException, InterruptedException {
        return http.send(preparar(endpoint, "high", "parkflash-teste"), HttpResponse.BodyHandlers.discarding()).statusCode();
    }

    HttpRequest preparar(String endpoint) {
        return preparar(endpoint, "normal", "parkflash");
    }

    private HttpRequest preparar(String endpoint, String urgencia, String topico) {
        URI uri = URI.create(endpoint);
        if (!permitido(uri)) throw new IllegalArgumentException("Provedor Web Push não permitido.");
        String origem = "https://" + uri.getHost().toLowerCase(Locale.ROOT);
        // A mensagem não carrega dados. O worker sempre exibe um aviso genérico.
        return HttpRequest.newBuilder(uri).timeout(Duration.ofSeconds(8))
                .header("Authorization", "vapid t=" + token(origem) + ", k=" + chaves.publica())
                .header("TTL", "300").header("Urgency", urgencia).header("Topic", topico)
                .POST(HttpRequest.BodyPublishers.noBody()).build();
    }

    private synchronized String token(String origem) {
        var agora = Instant.now();
        var atual = tokens.get(origem);
        if (atual != null && atual.expiracao().isAfter(agora.plusSeconds(60))) return atual.valor();
        var expiracao = agora.plus(Duration.ofHours(4));
        String valor = Jwts.builder().audience().single(origem).subject(chaves.contato())
                .expiration(Date.from(expiracao)).signWith(chaves.privada(), Jwts.SIG.ES256).compact();
        tokens.put(origem, new Token(valor, expiracao));
        if (tokens.size() > 16) tokens.remove(tokens.keySet().iterator().next());
        return valor;
    }

    static boolean permitido(URI uri) {
        String host = uri.getHost();
        if (!"https".equalsIgnoreCase(uri.getScheme()) || host == null || uri.getUserInfo() != null
                || uri.getFragment() != null || (uri.getPort() != -1 && uri.getPort() != 443)
                || uri.getPath() == null || uri.getPath().length() < 2) return false;
        host = host.toLowerCase(Locale.ROOT);
        return host.equals("fcm.googleapis.com") || host.equals("updates.push.services.mozilla.com")
                || host.equals("push.apple.com") || host.endsWith(".push.apple.com");
    }

    private static Chaves carregar(String publica, String privada, String contato) {
        if (publica.isEmpty() && privada.isEmpty() && contato.isEmpty()) return null;
        try {
            URI sujeito = URI.create(contato);
            if (!("mailto".equals(sujeito.getScheme()) && !sujeito.getSchemeSpecificPart().isBlank()
                    || "https".equals(sujeito.getScheme()) && sujeito.getHost() != null)) {
                throw new IllegalArgumentException();
            }
            var dec = Base64.getUrlDecoder();
            byte[] coordenadas = dec.decode(publica);
            if (coordenadas.length != 65 || coordenadas[0] != 4) throw new IllegalArgumentException();
            var factory = KeyFactory.getInstance("EC");
            var chavePrivada = factory.generatePrivate(new PKCS8EncodedKeySpec(dec.decode(privada)));
            var parametros = AlgorithmParameters.getInstance("EC");
            parametros.init(new ECGenParameterSpec("secp256r1"));
            var ponto = new ECPoint(new BigInteger(1, Arrays.copyOfRange(coordenadas, 1, 33)),
                    new BigInteger(1, Arrays.copyOfRange(coordenadas, 33, 65)));
            var chavePublica = factory.generatePublic(new ECPublicKeySpec(ponto, parametros.getParameterSpec(ECParameterSpec.class)));
            var assinatura = Signature.getInstance("SHA256withECDSA");
            assinatura.initSign(chavePrivada);
            assinatura.update(coordenadas);
            byte[] prova = assinatura.sign();
            assinatura.initVerify(chavePublica);
            assinatura.update(coordenadas);
            if (!assinatura.verify(prova)) throw new IllegalArgumentException();
            return new Chaves(publica, chavePrivada, contato);
        } catch (GeneralSecurityException | IllegalArgumentException ex) {
            LoggerFactory.getLogger(TransportePush.class).warn("Web Push desativado: configuração VAPID inválida.");
            return null;
        }
    }

    private record Token(String valor, Instant expiracao) {}

    private record Chaves(String publica, PrivateKey privada, String contato) {}
}
