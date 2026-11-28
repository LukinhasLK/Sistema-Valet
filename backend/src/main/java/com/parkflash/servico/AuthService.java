package com.parkflash.servico;

import com.parkflash.dominio.Usuario;
import com.parkflash.erro.MuitasTentativasException;
import com.parkflash.erro.NaoEncontradoException;
import com.parkflash.erro.RegraInvalidaException;
import com.parkflash.repositorio.UsuarioRepository;
import com.parkflash.seguranca.JwtService;
import com.parkflash.web.dto.LoginRequest;
import com.parkflash.web.dto.LoginResponse;
import com.parkflash.web.dto.TrocarSenhaRequest;
import com.parkflash.web.dto.UsuarioResponse;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.Locale;
import java.util.Optional;

@Service
public class AuthService {

    /** 5 senhas erradas em até 15 minutos bloqueiam o identificador por 15 minutos. */
    static final int MAXIMO_FALHAS = 5;
    static final Duration JANELA = Duration.ofMinutes(15);
    static final Duration BLOQUEIO = Duration.ofMinutes(15);

    private final UsuarioRepository usuarios;
    private final PasswordEncoder encoder;
    private final JwtService jwt;
    private final JdbcClient jdbc;
    private final Clock relogio = Clock.systemUTC();
    /** Comparado quando a conta não existe: a resposta leva o mesmo tempo e não revela quais contas existem. */
    private final String hashFicticio;

    public AuthService(UsuarioRepository usuarios, PasswordEncoder encoder, JwtService jwt, JdbcClient jdbc) {
        this.usuarios = usuarios;
        this.encoder = encoder;
        this.jwt = jwt;
        this.jdbc = jdbc;
        this.hashFicticio = encoder.encode("parkflash-conta-inexistente");
    }

    private record Tentativa(int falhas, OffsetDateTime primeiraFalha, OffsetDateTime bloqueadoAte) {}

    /**
     * Aceita e-mail ou nome. A mesma mensagem e o mesmo tempo para usuário inexistente e senha errada.
     * As falhas são contadas por identificador digitado, exista a conta ou não.
     */
    @Transactional(noRollbackFor = {BadCredentialsException.class, MuitasTentativasException.class})
    public LoginResponse login(LoginRequest pedido) {
        String identificador = pedido.identificador().trim();
        String chave = identificador.toLowerCase(Locale.ROOT);
        OffsetDateTime agora = OffsetDateTime.now(relogio);

        var tentativa = jdbc.sql("""
                SELECT falhas, primeira_falha, bloqueado_ate FROM login_tentativa WHERE identificador = :chave FOR UPDATE""")
                .param("chave", chave).query(Tentativa.class).optional();
        if (tentativa.isPresent() && tentativa.get().bloqueadoAte() != null && tentativa.get().bloqueadoAte().isAfter(agora)) {
            long minutos = Math.max(1, Duration.between(agora, tentativa.get().bloqueadoAte()).toMinutes() + 1);
            throw new MuitasTentativasException("Muitas tentativas erradas. Tente de novo em " + minutos + " minuto(s).");
        }

        Optional<Usuario> conta = usuarios.findByEmailIgnoreCase(identificador)
                .or(() -> usuarios.findFirstByNomeIgnoreCase(identificador))
                .filter(Usuario::isAtivo);
        boolean senhaCerta = encoder.matches(pedido.senha(), conta.map(Usuario::getSenhaHash).orElse(hashFicticio));
        if (conta.isEmpty() || !senhaCerta) {
            registrarFalha(chave, tentativa, agora);
            throw new BadCredentialsException("E-mail/usuário ou senha incorretos.");
        }
        if (tentativa.isPresent()) {
            jdbc.sql("DELETE FROM login_tentativa WHERE identificador = :chave").param("chave", chave).update();
        }
        Usuario usuario = conta.get();
        return new LoginResponse(jwt.gerar(usuario), UsuarioResponse.de(usuario));
    }

    private void registrarFalha(String chave, Optional<Tentativa> anterior, OffsetDateTime agora) {
        boolean janelaNova = anterior.isEmpty() || anterior.get().primeiraFalha().plus(JANELA).isBefore(agora);
        int falhas = janelaNova ? 1 : anterior.get().falhas() + 1;
        OffsetDateTime inicio = janelaNova ? agora : anterior.get().primeiraFalha();
        OffsetDateTime bloqueio = falhas >= MAXIMO_FALHAS ? agora.plus(BLOQUEIO) : null;
        if (bloqueio != null) {
            falhas = 0; // depois do bloqueio, recomeça a contagem
            inicio = agora;
        }
        int alterados = jdbc.sql("""
                UPDATE login_tentativa SET falhas = :falhas, primeira_falha = :inicio, bloqueado_ate = :bloqueio
                WHERE identificador = :chave""")
                .param("falhas", falhas).param("inicio", inicio).param("bloqueio", bloqueio).param("chave", chave).update();
        if (alterados == 0) {
            jdbc.sql("""
                    INSERT INTO login_tentativa (identificador, falhas, primeira_falha, bloqueado_ate)
                    VALUES (:chave, :falhas, :inicio, :bloqueio)""")
                    .param("chave", chave).param("falhas", falhas).param("inicio", inicio).param("bloqueio", bloqueio).update();
        }
    }

    @Transactional(readOnly = true)
    public UsuarioResponse atual(Long usuarioId) {
        return UsuarioResponse.de(buscar(usuarioId));
    }

    @Transactional
    public void trocarSenha(Long usuarioId, TrocarSenhaRequest pedido) {
        Usuario usuario = buscar(usuarioId);
        if (!encoder.matches(pedido.senhaAtual(), usuario.getSenhaHash())) {
            throw new RegraInvalidaException("A senha atual está incorreta.");
        }
        usuario.setSenhaHash(encoder.encode(pedido.novaSenha()));
    }

    /** "Sair de todos os aparelhos": invalida todos os logins e o link de agenda deste usuário. */
    @Transactional
    public void encerrarTodasAsSessoes(Long usuarioId) {
        buscar(usuarioId).encerrarSessoes();
    }

    private Usuario buscar(Long id) {
        return Optional.ofNullable(id).flatMap(usuarios::findById)
                .orElseThrow(() -> new NaoEncontradoException("Usuário não encontrado."));
    }
}
