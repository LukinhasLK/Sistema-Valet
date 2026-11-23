package com.parkflash.notificacao;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.jsonwebtoken.Jwts;
import org.junit.jupiter.api.Test;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.KeyPairGenerator;
import java.security.interfaces.ECPublicKey;
import java.security.spec.ECGenParameterSpec;
import java.time.Instant;
import java.util.Base64;

import static org.assertj.core.api.Assertions.assertThat;

class TransportePushTest {
    @Test
    void assinaVapidParaOrigemDoProvedorESemDadosSensiveis() throws Exception {
        var gerador = KeyPairGenerator.getInstance("EC");
        gerador.initialize(new ECGenParameterSpec("secp256r1"));
        var par = gerador.generateKeyPair();
        var publica = (ECPublicKey) par.getPublic();
        byte[] ponto = new byte[65];
        ponto[0] = 4;
        var x = publica.getW().getAffineX().toByteArray();
        var y = publica.getW().getAffineY().toByteArray();
        System.arraycopy(x, Math.max(0, x.length - 32), ponto, 1 + Math.max(0, 32 - x.length), Math.min(32, x.length));
        System.arraycopy(y, Math.max(0, y.length - 32), ponto, 33 + Math.max(0, 32 - y.length), Math.min(32, y.length));
        var base = Base64.getUrlEncoder().withoutPadding();
        var contato = "mailto:teste@example.test";
        var transporte = new TransportePush(base.encodeToString(ponto), base.encodeToString(par.getPrivate().getEncoded()), contato);
        assertThat(transporte.configurado()).isTrue();
        var pedido = transporte.preparar("https://web.push.apple.com/path");
        var auth = pedido.headers().firstValue("Authorization").orElseThrow();
        var campos = auth.split(", k=", 2);
        assertThat(campos[0]).startsWith("vapid t=");
        assertThat(campos[1]).isEqualTo(base.encodeToString(ponto));
        var jwt = campos[0].substring(8);
        var payload = new String(Base64.getUrlDecoder().decode(jwt.split("\\.")[1]), StandardCharsets.UTF_8);
        var aud = new ObjectMapper().readTree(payload).path("aud");
        assertThat(aud.isTextual()).isTrue();
        assertThat(aud.textValue()).isEqualTo("https://web.push.apple.com");
        var claims = Jwts.parser().verifyWith(publica).build().parseSignedClaims(jwt).getPayload();
        assertThat(claims.getAudience()).containsExactly("https://web.push.apple.com");
        assertThat(claims.getSubject()).isEqualTo(contato);
        assertThat(claims.getExpiration().toInstant()).isBetween(Instant.now(), Instant.now().plusSeconds(14_401));
        assertThat(pedido.bodyPublisher().orElseThrow().contentLength()).isZero();
        assertThat(transporte.preparar("https://web.push.apple.com/outro")
                .headers().firstValue("Authorization")).contains(auth);
        assertThat(transporte.preparar("https://fcm.googleapis.com/path")
                .headers().firstValue("Authorization")).isNotEqualTo(java.util.Optional.of(auth));
    }

    @Test
    void validaProvedorEDesativaConfiguracaoInvalida() {
        assertThat(new TransportePush("invalida", "", "mailto:teste@example.test").configurado()).isFalse();
        assertThat(TransportePush.permitido(URI.create("https://fcm.googleapis.com/fcm/send/id"))).isTrue();
        assertThat(TransportePush.permitido(URI.create("https://updates.push.services.mozilla.com/wpush/v2/id"))).isTrue();
        assertThat(TransportePush.permitido(URI.create("https://web.push.apple.com/push/id"))).isTrue();
        assertThat(TransportePush.permitido(URI.create("https://fcm.googleapis.com.invalid.test/id"))).isFalse();
        assertThat(TransportePush.permitido(URI.create("http://fcm.googleapis.com/fcm/send/id"))).isFalse();
        assertThat(TransportePush.permitido(URI.create("https://localhost/id"))).isFalse();
    }
}
