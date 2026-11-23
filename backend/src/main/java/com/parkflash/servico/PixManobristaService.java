package com.parkflash.servico;

import com.parkflash.dominio.NivelAcesso;
import com.parkflash.erro.NaoEncontradoException;
import com.parkflash.erro.RegraInvalidaException;
import com.parkflash.seguranca.UsuarioLogado;
import com.parkflash.web.dto.PagamentoManobristaDto.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.Locale;
import java.util.regex.Pattern;

@Service
public class PixManobristaService {
    private static final Pattern EMAIL = Pattern.compile(
            "^[a-z0-9.!#$'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$");

    private final JdbcClient jdbc;
    private final SecretKeySpec segredo;
    private final SecureRandom random = new SecureRandom();

    public PixManobristaService(JdbcClient jdbc, @Value("${parkflash.pix-segredo}") String segredo) {
        this.jdbc = jdbc;
        this.segredo = segredo.length() >= 32
                ? new SecretKeySpec(sha256(segredo.getBytes(StandardCharsets.UTF_8)), "AES") : null;
    }

    @Transactional(readOnly = true)
    public Pix consultar(long id, UsuarioLogado ator) {
        autorizarConsulta(id, ator);
        return jdbc.sql("SELECT tipo, chave_mascarada FROM manobrista_pix WHERE manobrista_id = :id")
                .param("id", id).query(Pix.class).optional()
                .orElseThrow(() -> new NaoEncontradoException("Nenhuma chave Pix cadastrada para este manobrista."));
    }

    @Transactional
    public Pix salvar(long id, AlterarPix pedido, UsuarioLogado ator) {
        if (ator.nivel() != NivelAcesso.PROPRIETARIO) {
            throw new AccessDeniedException("Somente o proprietário pode alterar chaves Pix.");
        }
        verificarSegredo();
        PagamentoManobristaService.bloquearManobrista(jdbc, id);
        String chave = normalizar(pedido.tipo(), pedido.chave());
        var atual = jdbc.sql("SELECT tipo, chave_cifrada, chave_mascarada FROM manobrista_pix WHERE manobrista_id = :id")
                .param("id", id).query(PixGuardado.class).optional();
        if (atual.isPresent() && atual.get().tipo() == pedido.tipo()
                && decifrar(id, atual.get()).equals(chave)) {
            return new Pix(pedido.tipo(), atual.get().chaveMascarada());
        }

        String mascara = mascarar(pedido.tipo(), chave);
        String sql = atual.isPresent()
                ? "UPDATE manobrista_pix SET tipo = :tipo, chave_cifrada = :chave, chave_mascarada = :mascara WHERE manobrista_id = :id"
                : "INSERT INTO manobrista_pix (manobrista_id, tipo, chave_cifrada, chave_mascarada) VALUES (:id, :tipo, :chave, :mascara)";
        jdbc.sql(sql).param("id", id).param("tipo", pedido.tipo().name())
                .param("chave", cifrar(id, pedido.tipo(), chave)).param("mascara", mascara).update();
        auditar(id, ator, "ATUALIZOU", pedido.tipo());
        return new Pix(pedido.tipo(), mascara);
    }

    @Transactional
    public ChavePix revelar(long id, UsuarioLogado ator) {
        autorizarConsulta(id, ator);
        verificarSegredo();
        var pix = jdbc.sql("SELECT tipo, chave_cifrada, chave_mascarada FROM manobrista_pix WHERE manobrista_id = :id")
                .param("id", id).query(PixGuardado.class).optional()
                .orElseThrow(() -> new NaoEncontradoException("Nenhuma chave Pix cadastrada para este manobrista."));
        String chave = decifrar(id, pix);
        auditar(id, ator, "CONSULTOU", pix.tipo());
        return new ChavePix(chave);
    }

    private void autorizarConsulta(long id, UsuarioLogado ator) {
        if (ator.nivel() == NivelAcesso.PROPRIETARIO) return;
        if (ator.nivel() != NivelAcesso.GERENTE || ator.unidadeIds().isEmpty()
                || !jdbc.sql("""
                    SELECT EXISTS (SELECT 1 FROM diaria_a_pagar
                                   WHERE manobrista_id = :id AND unidade_id IN (:unidades))
                    """).param("id", id).param("unidades", ator.unidadeIds()).query(Boolean.class).single()) {
            throw new AccessDeniedException("Chave Pix fora do escopo do usuário.");
        }
    }

    private void auditar(long id, UsuarioLogado ator, String acao, TipoPix tipo) {
        jdbc.sql("""
                INSERT INTO manobrista_pix_auditoria (manobrista_id, usuario_id, acao, tipo)
                VALUES (:id, :usuario, :acao, :tipo)
                """).param("id", id).param("usuario", ator.id()).param("acao", acao).param("tipo", tipo.name()).update();
    }

    String normalizar(TipoPix tipo, String entrada) {
        if (entrada == null || entrada.isBlank() || entrada.length() > 254) {
            throw new RegraInvalidaException("Informe uma chave Pix válida.");
        }
        String valor = entrada.strip();
        String digitos = valor.replaceAll("[. /()-]", "");
        return switch (tipo) {
            case CPF -> exigir(digitos, digitos.matches("[0-9]{11}") && documentoValido(digitos, 9));
            case CNPJ -> {
                String cnpj = digitos.toUpperCase(Locale.ROOT);
                yield exigir(cnpj, cnpj.matches("[0-9A-Z]{12}[0-9]{2}") && documentoValido(cnpj, 12));
            }
            case TELEFONE -> {
                if (digitos.matches("[0-9]{10,11}")) {
                    digitos = "+55" + digitos;
                }
                yield exigir(digitos, digitos.matches("\\+[1-9][0-9]{1,14}"));
            }
            case EMAIL -> {
                String email = valor.toLowerCase(Locale.ROOT);
                yield exigir(email, email.length() <= 77 && EMAIL.matcher(email).matches());
            }
            case ALEATORIA -> exigir(valor.toLowerCase(Locale.ROOT),
                    valor.matches("(?i)[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}")
                            && !valor.equals("00000000-0000-0000-0000-000000000000"));
        };
    }

    private static String exigir(String valor, boolean valido) {
        if (!valido) throw new RegraInvalidaException("Chave Pix inválida para o tipo selecionado.");
        return valor;
    }

    private static boolean documentoValido(String valor, int base) {
        if (valor.chars().distinct().count() == 1) return false;
        for (int tamanho = base; tamanho < base + 2; tamanho++) {
            int soma = 0;
            for (int i = 0; i < tamanho; i++) {
                int distancia = tamanho - i - 1;
                int peso = base == 9 ? distancia + 2 : distancia % 8 + 2;
                soma += (valor.charAt(i) - '0') * peso;
            }
            int digito = soma % 11 < 2 ? 0 : 11 - soma % 11;
            if (valor.charAt(tamanho) - '0' != digito) return false;
        }
        return true;
    }

    private static String mascarar(TipoPix tipo, String chave) {
        if (tipo == TipoPix.EMAIL) {
            return chave.charAt(0) + "•••@" + chave.substring(chave.indexOf('@') + 1);
        }
        return "•••• " + chave.substring(chave.length() - 4);
    }

    private String cifrar(long id, TipoPix tipo, String chave) {
        byte[] iv = new byte[12];
        random.nextBytes(iv);
        byte[] cifra = criptografar(Cipher.ENCRYPT_MODE, id, tipo, iv, chave.getBytes(StandardCharsets.UTF_8));
        return Base64.getEncoder().encodeToString(ByteBuffer.allocate(iv.length + cifra.length).put(iv).put(cifra).array());
    }

    private String decifrar(long id, PixGuardado pix) {
        ByteBuffer dados = ByteBuffer.wrap(Base64.getDecoder().decode(pix.chaveCifrada()));
        byte[] iv = new byte[12];
        dados.get(iv);
        byte[] cifra = new byte[dados.remaining()];
        dados.get(cifra);
        return new String(criptografar(Cipher.DECRYPT_MODE, id, pix.tipo(), iv, cifra), StandardCharsets.UTF_8);
    }

    private void verificarSegredo() {
        if (segredo == null) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Configure PIX_SEGREDO no servidor para cadastrar ou consultar chaves Pix completas.");
        }
    }

    private byte[] criptografar(int modo, long id, TipoPix tipo, byte[] iv, byte[] dados) {
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(modo, segredo, new GCMParameterSpec(128, iv));
            cipher.updateAAD((id + ":" + tipo.name()).getBytes(StandardCharsets.UTF_8));
            return cipher.doFinal(dados);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("Não foi possível processar a chave Pix.", e);
        }
    }

    static byte[] sha256(byte[] dados) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(dados);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private record PixGuardado(TipoPix tipo, String chaveCifrada, String chaveMascarada) {}
}
