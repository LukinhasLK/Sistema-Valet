package com.valetgest.controller;

import com.valetgest.repository.DespesaRepository;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/despesas")
@RequiredArgsConstructor
public class DespesaController {

    private final DespesaRepository despesaRepository;

    @GetMapping
    public ResponseEntity<List<DespesaResponse>> listar() {
        List<DespesaResponse> resp = despesaRepository.findAllComFicha().stream()
            .map(d -> {
                DespesaResponse r = new DespesaResponse();
                r.id          = d.getId();
                r.fichaId     = d.getFicha().getId();
                r.fichaData   = d.getFicha().getDataFicha();
                r.unidadeNome = d.getFicha().getUnidade().getNome();
                r.descricao   = d.getDescricao();
                r.valor       = d.getValor();
                return r;
            }).collect(Collectors.toList());
        return ResponseEntity.ok(resp);
    }

    @Data
    public static class DespesaResponse {
        Long id;
        Long fichaId;
        LocalDate fichaData;
        String unidadeNome;
        String descricao;
        BigDecimal valor;
    }
}
