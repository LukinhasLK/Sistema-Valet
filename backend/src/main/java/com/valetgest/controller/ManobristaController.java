package com.valetgest.controller;

import com.valetgest.entity.Manobrista;
import com.valetgest.repository.ManobristaRepository;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/manobristas")
@RequiredArgsConstructor
public class ManobristaController {

    private final ManobristaRepository manobristaRepository;

    @GetMapping
    public ResponseEntity<List<Manobrista>> listar() {
        return ResponseEntity.ok(manobristaRepository.findByAtivoTrue());
    }

    @PostMapping
    public ResponseEntity<Manobrista> criar(@Valid @RequestBody Manobrista manobrista) {
        return ResponseEntity.ok(manobristaRepository.save(manobrista));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Manobrista> atualizar(
            @PathVariable Long id,
            @Valid @RequestBody Manobrista dados) {
        return manobristaRepository.findById(id)
                .map(m -> {
                    m.setNome(dados.getNome());
                    m.setCpf(dados.getCpf());
                    m.setTelefone(dados.getTelefone());
                    m.setAtivo(dados.getAtivo());
                    return ResponseEntity.ok(manobristaRepository.save(m));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> desativar(@PathVariable Long id) {
        return manobristaRepository.findById(id)
                .map(m -> {
                    m.setAtivo(false);
                    manobristaRepository.save(m);
                    return ResponseEntity.noContent().<Void>build();
                })
                .orElse(ResponseEntity.notFound().build());
    }
}
