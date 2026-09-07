package com.valetgest.controller;

import com.valetgest.entity.Unidade;
import com.valetgest.repository.UnidadeRepository;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * CRUD básico de unidades.
 *
 * Em projetos pequenos, é OK o controller chamar o repository direto.
 * Em projetos maiores, sempre coloque um Service no meio.
 */
@RestController
@RequestMapping("/api/unidades")
@RequiredArgsConstructor
public class UnidadeController {

    private final UnidadeRepository unidadeRepository;

    @GetMapping
    public ResponseEntity<List<Unidade>> listar() {
        return ResponseEntity.ok(unidadeRepository.findByAtivaTrue());
    }

    @GetMapping("/{id}")
    public ResponseEntity<Unidade> buscar(@PathVariable Long id) {
        return unidadeRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<Unidade> criar(@Valid @RequestBody Unidade unidade) {
        return ResponseEntity.ok(unidadeRepository.save(unidade));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Unidade> atualizar(
            @PathVariable Long id,
            @Valid @RequestBody Unidade dados) {
        return unidadeRepository.findById(id)
                .map(u -> {
                    u.setNome(dados.getNome());
                    u.setEndereco(dados.getEndereco());
                    u.setTelefone(dados.getTelefone());
                    u.setAtiva(dados.getAtiva());
                    return ResponseEntity.ok(unidadeRepository.save(u));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Não deletamos de verdade - só desativamos.
     * Por quê? Porque pode ter fichas ligadas a essa unidade,
     * e se apagar tudo no banco vamos perder histórico.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> desativar(@PathVariable Long id) {
        return unidadeRepository.findById(id)
                .map(u -> {
                    u.setAtiva(false);
                    unidadeRepository.save(u);
                    return ResponseEntity.noContent().<Void>build();
                })
                .orElse(ResponseEntity.notFound().build());
    }
}
