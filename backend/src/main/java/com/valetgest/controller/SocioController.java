package com.valetgest.controller;

import com.valetgest.entity.Socio;
import com.valetgest.entity.SocioUnidade;
import com.valetgest.entity.Unidade;
import com.valetgest.repository.SocioRepository;
import com.valetgest.repository.UnidadeRepository;
import jakarta.transaction.Transactional;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/socios")
@RequiredArgsConstructor
public class SocioController {

    private final SocioRepository socioRepository;
    private final UnidadeRepository unidadeRepository;

    @GetMapping
    public ResponseEntity<List<SocioResponse>> listar() {
        return ResponseEntity.ok(
            socioRepository.findByAtivoTrue().stream()
                .map(SocioResponse::from)
                .collect(Collectors.toList())
        );
    }

    @GetMapping("/unidade/{unidadeId}")
    public ResponseEntity<List<SocioUnidadeResponse>> listarPorUnidade(@PathVariable Long unidadeId) {
        List<Socio> socios = socioRepository.findByUnidadeId(unidadeId);
        List<SocioUnidadeResponse> resp = socios.stream().map(s -> {
            BigDecimal pct = s.getParticipacoes().stream()
                .filter(p -> p.getUnidade().getId().equals(unidadeId))
                .map(SocioUnidade::getPorcentagem)
                .findFirst().orElse(BigDecimal.ZERO);
            return new SocioUnidadeResponse(s.getId(), s.getNome(), pct);
        }).collect(Collectors.toList());
        return ResponseEntity.ok(resp);
    }

    @PostMapping
    public ResponseEntity<SocioResponse> criar(@RequestBody SocioRequest req) {
        Socio socio = Socio.builder().nome(req.getNome()).ativo(true).build();
        return ResponseEntity.ok(SocioResponse.from(socioRepository.save(socio)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<SocioResponse> atualizar(@PathVariable Long id, @RequestBody SocioRequest req) {
        return socioRepository.findById(id).map(socio -> {
            socio.setNome(req.getNome());
            return ResponseEntity.ok(SocioResponse.from(socioRepository.save(socio)));
        }).orElse(ResponseEntity.notFound().build());
    }

    @Transactional
    @PutMapping("/{id}/porcentagens")
    public ResponseEntity<SocioResponse> atualizarPorcentagens(
            @PathVariable Long id,
            @RequestBody List<PorcentagemRequest> porcentagens) {

        return socioRepository.findById(id).map(socio -> {
            socio.getParticipacoes().clear();
            socioRepository.saveAndFlush(socio); // força DELETE antes dos INSERTs

            for (PorcentagemRequest p : porcentagens) {
                if (p.getPorcentagem() == null || p.getPorcentagem().compareTo(BigDecimal.ZERO) <= 0) continue;
                Unidade unidade = unidadeRepository.findById(p.getUnidadeId()).orElse(null);
                if (unidade == null) continue;
                SocioUnidade su = SocioUnidade.builder()
                    .socio(socio)
                    .unidade(unidade)
                    .porcentagem(p.getPorcentagem())
                    .build();
                socio.getParticipacoes().add(su);
            }

            return ResponseEntity.ok(SocioResponse.from(socioRepository.save(socio)));
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> desativar(@PathVariable Long id) {
        return socioRepository.findById(id).map(socio -> {
            socio.setAtivo(false);
            socioRepository.save(socio);
            return ResponseEntity.noContent().<Void>build();
        }).orElse(ResponseEntity.notFound().build());
    }

    // ── DTOs ──

    @Data public static class SocioRequest { private String nome; }

    @Data public static class PorcentagemRequest {
        private Long unidadeId;
        private BigDecimal porcentagem;
    }

    @Data public static class SocioResponse {
        private Long id;
        private String nome;
        private List<ParticipacaoResponse> participacoes;

        public static SocioResponse from(Socio s) {
            SocioResponse r = new SocioResponse();
            r.id   = s.getId();
            r.nome = s.getNome();
            r.participacoes = s.getParticipacoes().stream()
                .map(p -> {
                    ParticipacaoResponse pr = new ParticipacaoResponse();
                    pr.unidadeId   = p.getUnidade().getId();
                    pr.unidadeNome = p.getUnidade().getNome();
                    pr.porcentagem = p.getPorcentagem();
                    return pr;
                }).collect(Collectors.toList());
            return r;
        }
    }

    @Data public static class ParticipacaoResponse {
        private Long unidadeId;
        private String unidadeNome;
        private BigDecimal porcentagem;
    }

    @Data public static class SocioUnidadeResponse {
        private Long id;
        private String nome;
        private BigDecimal porcentagem;
        public SocioUnidadeResponse(Long id, String nome, BigDecimal porcentagem) {
            this.id = id; this.nome = nome; this.porcentagem = porcentagem;
        }
    }
}
