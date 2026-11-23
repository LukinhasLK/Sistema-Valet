package com.parkflash.servico;

import com.parkflash.dominio.Usuario;
import com.parkflash.erro.NaoEncontradoException;
import com.parkflash.erro.RegraInvalidaException;
import com.parkflash.repositorio.UsuarioRepository;
import com.parkflash.seguranca.JwtService;
import com.parkflash.web.dto.LoginRequest;
import com.parkflash.web.dto.LoginResponse;
import com.parkflash.web.dto.TrocarSenhaRequest;
import com.parkflash.web.dto.UsuarioResponse;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

@Service
public class AuthService {

    private final UsuarioRepository usuarios;
    private final PasswordEncoder encoder;
    private final JwtService jwt;

    public AuthService(UsuarioRepository usuarios, PasswordEncoder encoder, JwtService jwt) {
        this.usuarios = usuarios;
        this.encoder = encoder;
        this.jwt = jwt;
    }

    /** Aceita e-mail ou nome. A mesma mensagem para usuário inexistente e senha errada. */
    @Transactional(readOnly = true)
    public LoginResponse login(LoginRequest pedido) {
        String identificador = pedido.identificador().trim();
        Usuario usuario = usuarios.findByEmailIgnoreCase(identificador)
                .or(() -> usuarios.findFirstByNomeIgnoreCase(identificador))
                .filter(Usuario::isAtivo)
                .filter(u -> encoder.matches(pedido.senha(), u.getSenhaHash()))
                .orElseThrow(() -> new BadCredentialsException("E-mail/usuário ou senha incorretos."));
        return new LoginResponse(jwt.gerar(usuario), UsuarioResponse.de(usuario));
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

    private Usuario buscar(Long id) {
        return Optional.ofNullable(id).flatMap(usuarios::findById)
                .orElseThrow(() -> new NaoEncontradoException("Usuário não encontrado."));
    }
}
