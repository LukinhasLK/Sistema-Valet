package com.valetgest.config;

import com.valetgest.entity.Manobrista;
import com.valetgest.entity.Unidade;
import com.valetgest.entity.Usuario;
import com.valetgest.enums.TipoUsuario;
import com.valetgest.repository.ManobristaRepository;
import com.valetgest.repository.UnidadeRepository;
import com.valetgest.repository.UsuarioRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

/**
 * Cria dados de teste quando a aplicação sobe.
 *
 * @Component faz o Spring achar essa classe e executar o método run()
 * automaticamente quando o Spring Boot termina de inicializar.
 *
 * IMPORTANTE: em produção, não rode esse cara!
 * Para rodar só em desenvolvimento, dá pra usar @Profile("dev").
 */
@Component
@RequiredArgsConstructor
public class DadosIniciais implements CommandLineRunner {

    private final UnidadeRepository unidadeRepository;
    private final UsuarioRepository usuarioRepository;
    private final ManobristaRepository manobristaRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) {
        // Só insere se o banco estiver vazio
        if (usuarioRepository.count() > 0) return;

        System.out.println("=== Criando dados iniciais ===");

        // Cria duas unidades de exemplo
        Unidade unidade1 = unidadeRepository.save(Unidade.builder()
                .nome("Restaurante Sabor & Arte")
                .endereco("Rua das Flores, 123")
                .telefone("(11) 1234-5678")
                .ativa(true)
                .build());

        Unidade unidade2 = unidadeRepository.save(Unidade.builder()
                .nome("Pizzaria do Zé")
                .endereco("Av. Paulista, 999")
                .telefone("(11) 9876-5432")
                .ativa(true)
                .build());

        // Cria o usuário DONO (vê tudo)
        usuarioRepository.save(Usuario.builder()
                .nome("Dono Geral")
                .email("dono@valetgest.com")
                .senha(passwordEncoder.encode("123456"))
                .tipo(TipoUsuario.DONO)
                .ativo(true)
                .build());

        // Cria um GERENTE para a primeira unidade
        usuarioRepository.save(Usuario.builder()
                .nome("Gerente da Unidade 1")
                .email("gerente1@valetgest.com")
                .senha(passwordEncoder.encode("123456"))
                .tipo(TipoUsuario.GERENTE)
                .unidade(unidade1)
                .ativo(true)
                .build());

        // Manobristas de exemplo
        manobristaRepository.save(Manobrista.builder()
                .nome("João Silva").telefone("(11) 91111-1111").ativo(true).build());
        manobristaRepository.save(Manobrista.builder()
                .nome("Pedro Souza").telefone("(11) 92222-2222").ativo(true).build());
        manobristaRepository.save(Manobrista.builder()
                .nome("Carlos Lima").telefone("(11) 93333-3333").ativo(true).build());

        System.out.println("=== Dados criados! ===");
        System.out.println("Login DONO:    dono@valetgest.com    / 123456");
        System.out.println("Login GERENTE: gerente1@valetgest.com / 123456");
    }
}
