package com.valetgest.controller;

import com.valetgest.dto.SenhaRequest;
import com.valetgest.dto.UsuarioRequest;
import com.valetgest.dto.UsuarioResponse;
import com.valetgest.entity.Unidade;
import com.valetgest.entity.Usuario;
import com.valetgest.enums.TipoUsuario;
import com.valetgest.exception.NegocioException;
import com.valetgest.repository.UnidadeRepository;
import com.valetgest.repository.UsuarioRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/usuarios")
@RequiredArgsConstructor
public class UsuarioController {

    private final UsuarioRepository usuarioRepository;
    private final UnidadeRepository unidadeRepository;
    private final PasswordEncoder passwordEncoder;

    @GetMapping
    public ResponseEntity<List<UsuarioResponse>> listar() {
        List<UsuarioResponse> lista = usuarioRepository.findAllByAtivoTrue()
                .stream()
                .map(UsuarioResponse::from)
                .collect(Collectors.toList());
        return ResponseEntity.ok(lista);
    }

    @PostMapping
    public ResponseEntity<UsuarioResponse> criar(@RequestBody UsuarioRequest req) {
        if (req.getNome() == null || req.getNome().isBlank())
            throw new NegocioException("Nome é obrigatório");
        if (req.getEmail() == null || req.getEmail().isBlank())
            throw new NegocioException("Email é obrigatório");
        if (usuarioRepository.existsByEmail(req.getEmail()))
            throw new NegocioException("Email já cadastrado");
        if (req.getSenha() == null || req.getSenha().length() < 6)
            throw new NegocioException("Senha deve ter pelo menos 6 caracteres");

        Usuario usuario = Usuario.builder()
                .nome(req.getNome())
                .email(req.getEmail())
                .senha(passwordEncoder.encode(req.getSenha()))
                .tipo(TipoUsuario.valueOf(req.getTipo()))
                .ativo(true)
                .build();

        if (req.getUnidadeId() != null) {
            Unidade unidade = unidadeRepository.findById(req.getUnidadeId())
                    .orElseThrow(() -> new NegocioException("Unidade não encontrada"));
            usuario.setUnidade(unidade);
        }

        usuarioRepository.save(usuario);
        return ResponseEntity.ok(UsuarioResponse.from(usuario));
    }

    @PutMapping("/{id}")
    public ResponseEntity<UsuarioResponse> atualizar(@PathVariable Long id,
                                                      @RequestBody UsuarioRequest req) {
        Usuario usuario = usuarioRepository.findById(id)
                .orElseThrow(() -> new NegocioException("Usuário não encontrado"));

        usuario.setNome(req.getNome());
        usuario.setEmail(req.getEmail());
        usuario.setTipo(TipoUsuario.valueOf(req.getTipo()));

        if (req.getUnidadeId() != null) {
            Unidade unidade = unidadeRepository.findById(req.getUnidadeId())
                    .orElseThrow(() -> new NegocioException("Unidade não encontrada"));
            usuario.setUnidade(unidade);
        } else {
            usuario.setUnidade(null);
        }

        usuarioRepository.save(usuario);
        return ResponseEntity.ok(UsuarioResponse.from(usuario));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> desativar(@PathVariable Long id,
                                           @AuthenticationPrincipal Usuario logado) {
        if (logado.getId().equals(id))
            throw new NegocioException("Você não pode desativar sua própria conta");

        Usuario usuario = usuarioRepository.findById(id)
                .orElseThrow(() -> new NegocioException("Usuário não encontrado"));
        usuario.setAtivo(false);
        usuarioRepository.save(usuario);
        return ResponseEntity.noContent().build();
    }

    // Troca de senha do próprio usuário logado
    @PutMapping("/senha")
    public ResponseEntity<Void> trocarSenhaPropria(@AuthenticationPrincipal Usuario logado,
                                                    @RequestBody SenhaRequest req) {
        if (!passwordEncoder.matches(req.getSenhaAtual(), logado.getSenha()))
            throw new NegocioException("Senha atual incorreta");
        if (req.getNovaSenha() == null || req.getNovaSenha().length() < 6)
            throw new NegocioException("Nova senha deve ter pelo menos 6 caracteres");

        logado.setSenha(passwordEncoder.encode(req.getNovaSenha()));
        usuarioRepository.save(logado);
        return ResponseEntity.noContent().build();
    }

    // Reset de senha pelo DONO (sem precisar da senha atual)
    @PutMapping("/{id}/senha")
    public ResponseEntity<Void> resetarSenha(@PathVariable Long id,
                                              @RequestBody SenhaRequest req) {
        if (req.getNovaSenha() == null || req.getNovaSenha().length() < 6)
            throw new NegocioException("Nova senha deve ter pelo menos 6 caracteres");

        Usuario usuario = usuarioRepository.findById(id)
                .orElseThrow(() -> new NegocioException("Usuário não encontrado"));
        usuario.setSenha(passwordEncoder.encode(req.getNovaSenha()));
        usuarioRepository.save(usuario);
        return ResponseEntity.noContent().build();
    }
}
