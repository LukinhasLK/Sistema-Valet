package com.valetgest.controller;

import com.valetgest.dto.FichaRequest;
import com.valetgest.dto.FichaResponse;
import com.valetgest.entity.Usuario;
import com.valetgest.service.FichaService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Endpoints das fichas.
 *
 * Tabela de rotas:
 * POST   /api/fichas      - cria uma ficha
 * GET    /api/fichas      - lista todas (filtradas por permissão)
 * GET    /api/fichas/{id} - busca uma ficha
 * DELETE /api/fichas/{id} - apaga uma ficha
 */
@RestController
@RequestMapping("/api/fichas")
@RequiredArgsConstructor
public class FichaController {


    private final FichaService fichaService;

    /**
     * @AuthenticationPrincipal pega o usuário logado automaticamente
     * (vem do JwtAuthFilter que populou o contexto).
     */
    @PostMapping
    public ResponseEntity<FichaResponse> criar(
            @Valid @RequestBody FichaRequest request,
            @AuthenticationPrincipal Usuario usuarioLogado) {
        return ResponseEntity.ok(fichaService.criar(request, usuarioLogado));
    }

    @GetMapping
    public ResponseEntity<List<FichaResponse>> listar(
            @AuthenticationPrincipal Usuario usuarioLogado) {
        return ResponseEntity.ok(fichaService.listarTodas(usuarioLogado));
    }

    @GetMapping("/{id}")
    public ResponseEntity<FichaResponse> buscar(
            @PathVariable Long id,
            @AuthenticationPrincipal Usuario usuarioLogado) {
        return ResponseEntity.ok(fichaService.buscarPorId(id, usuarioLogado));
    }

    @PatchMapping("/{id}/carros")
    public ResponseEntity<FichaResponse> atualizarCarros(
            @PathVariable Long id,
            @RequestBody java.util.Map<String, Integer> body,
            @AuthenticationPrincipal Usuario usuarioLogado) {
        return ResponseEntity.ok(fichaService.atualizarCarros(id, body.get("quantidadeManobras"), usuarioLogado));
    }

    @PatchMapping("/{id}/data")
    public ResponseEntity<FichaResponse> atualizarData(
            @PathVariable Long id,
            @RequestBody java.util.Map<String, String> body,
            @AuthenticationPrincipal Usuario usuarioLogado) {
        java.time.LocalDate novaData = java.time.LocalDate.parse(body.get("dataFicha"));
        return ResponseEntity.ok(fichaService.atualizarData(id, novaData, usuarioLogado));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deletar(
            @PathVariable Long id,
            @AuthenticationPrincipal Usuario usuarioLogado) {
        fichaService.deletar(id, usuarioLogado);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/despesas")
    public ResponseEntity<FichaResponse> adicionarDespesa(
            @PathVariable Long id,
            @RequestBody FichaRequest.DespesaRequest request,
            @AuthenticationPrincipal Usuario usuarioLogado) {
        return ResponseEntity.ok(fichaService.adicionarDespesa(id, request, usuarioLogado));
    }

    @DeleteMapping("/{id}/despesas/{despId}")
    public ResponseEntity<FichaResponse> removerDespesa(
            @PathVariable Long id,
            @PathVariable Long despId,
            @AuthenticationPrincipal Usuario usuarioLogado) {
        return ResponseEntity.ok(fichaService.removerDespesa(id, despId, usuarioLogado));
    }

    @PostMapping("/{id}/lancamentos")
    public ResponseEntity<FichaResponse> adicionarLancamento(
            @PathVariable Long id,
            @RequestBody FichaRequest.LancamentoManobristaRequest request,
            @AuthenticationPrincipal Usuario usuarioLogado) {
        return ResponseEntity.ok(fichaService.adicionarLancamento(id, request, usuarioLogado));
    }

    @DeleteMapping("/{id}/lancamentos/{lancId}")
    public ResponseEntity<FichaResponse> removerLancamento(
            @PathVariable Long id,
            @PathVariable Long lancId,
            @AuthenticationPrincipal Usuario usuarioLogado) {
        return ResponseEntity.ok(fichaService.removerLancamento(id, lancId, usuarioLogado));
    }
}
