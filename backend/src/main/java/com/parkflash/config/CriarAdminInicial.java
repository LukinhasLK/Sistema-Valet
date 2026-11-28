package com.parkflash.config;

import com.parkflash.dominio.NivelAcesso;
import com.parkflash.dominio.Usuario;
import com.parkflash.repositorio.UsuarioRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

/** Sem nenhum usuário ninguém conseguiria entrar: cria o primeiro Proprietário a partir de ADMIN_EMAIL/ADMIN_SENHA. */
@Component
public class CriarAdminInicial implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(CriarAdminInicial.class);

    private final UsuarioRepository usuarios;
    private final PasswordEncoder encoder;
    private final ParkFlashProperties propriedades;

    public CriarAdminInicial(UsuarioRepository usuarios, PasswordEncoder encoder, ParkFlashProperties propriedades) {
        this.usuarios = usuarios;
        this.encoder = encoder;
        this.propriedades = propriedades;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (usuarios.count() > 0) return;

        var admin = propriedades.adminInicial();
        if (admin == null || vazio(admin.email()) || admin.senha() == null || admin.senha().length() < 6) {
            log.warn("Banco sem usuários: defina ADMIN_EMAIL e ADMIN_SENHA (mín. 6 caracteres) para criar o primeiro Proprietário.");
            return;
        }

        var usuario = new Usuario();
        usuario.setNome(vazio(admin.nome()) ? "Administrador" : admin.nome().trim());
        usuario.setEmail(admin.email().trim().toLowerCase());
        usuario.setNivel(NivelAcesso.PROPRIETARIO);
        usuario.setSenhaHash(encoder.encode(admin.senha()));
        usuarios.save(usuario);
        log.info("Proprietário inicial criado: {}", usuario.getEmail());
    }

    private static boolean vazio(String valor) {
        return valor == null || valor.isBlank();
    }
}
