package com.valetgest.controller;

import com.valetgest.dto.RelatorioMensalResponse;
import com.valetgest.entity.Usuario;
import com.valetgest.service.ExcelExportService;
import com.valetgest.service.PdfExportService;
import com.valetgest.service.RelatorioService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.time.LocalDate;
import java.util.List;

/**
 * Endpoints de relatórios.
 *
 * Três formatos de saída:
 * - JSON (tela do sistema)
 * - PDF (para imprimir)
 * - Excel (para abrir em planilha)
 */
@RestController
@RequestMapping("/api/relatorios")
@RequiredArgsConstructor
public class RelatorioController {

    private final RelatorioService relatorioService;
    private final PdfExportService pdfExportService;
    private final ExcelExportService excelExportService;

    @GetMapping("/carros")
    public ResponseEntity<CarrosResponse> carros(
            @RequestParam Integer ano,
            @RequestParam(required = false) Integer mes,
            @RequestParam(required = false) Long unidadeId,
            @AuthenticationPrincipal Usuario usuarioLogado) {
        return ResponseEntity.ok(relatorioService.gerarRelatorioCarros(ano, mes, unidadeId, usuarioLogado));
    }

    @GetMapping("/carros/pdf")
    public ResponseEntity<byte[]> carrosPdf(
            @RequestParam Integer ano,
            @RequestParam(required = false) Integer mes,
            @RequestParam(required = false) Long unidadeId,
            @RequestParam(required = false) String unidadeNome,
            @AuthenticationPrincipal Usuario usuarioLogado) throws java.io.IOException {
        CarrosResponse dados = relatorioService.gerarRelatorioCarros(ano, mes, unidadeId, usuarioLogado);
        byte[] pdf = pdfExportService.gerarPdfCarros(dados, ano, unidadeNome);
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"carros_" + ano + ".pdf\"")
                .body(pdf);
    }

    @Data
    public static class CarrosResponse {
        private List<ResumoMes> resumo;
        private List<DetalheDia> detalhado;

        @Data
        public static class ResumoMes {
            private int mes;
            private String nomeMes;
            private int totalCarros;
            private int totalFichas;
        }

        @Data
        public static class DetalheDia {
            private Long fichaId;
            private LocalDate data;
            private String unidadeNome;
            private int totalCarros;
        }
    }

    /**
     * Retorna o relatório em JSON.
     * Usado pela tela do sistema.
     */
    @GetMapping("/mensal")
    public ResponseEntity<RelatorioMensalResponse> mensal(
            @RequestParam Integer mes,
            @RequestParam Integer ano,
            @RequestParam(required = false) Long unidadeId,
            @AuthenticationPrincipal Usuario usuarioLogado) {

        RelatorioMensalResponse relatorio =
                relatorioService.gerarRelatorioMensal(mes, ano, unidadeId, usuarioLogado);
        return ResponseEntity.ok(relatorio);
    }

    /**
     * Baixa o relatório em PDF.
     *
     * Headers importantes:
     * - Content-Type: application/pdf (navegador sabe que é PDF)
     * - Content-Disposition: attachment (força download)
     */
    @GetMapping("/mensal/pdf")
    public ResponseEntity<byte[]> mensalPdf(
            @RequestParam Integer mes,
            @RequestParam Integer ano,
            @RequestParam(required = false) Long unidadeId,
            @AuthenticationPrincipal Usuario usuarioLogado) throws IOException {

        RelatorioMensalResponse relatorio =
                relatorioService.gerarRelatorioMensal(mes, ano, unidadeId, usuarioLogado);
        byte[] pdf = pdfExportService.gerarPdfRelatorioMensal(relatorio);

        String nomeArquivo = String.format("relatorio_%02d_%d.pdf", mes, ano);

        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"" + nomeArquivo + "\"")
                .body(pdf);
    }

    /**
     * Baixa o relatório em Excel (.xlsx).
     */
    @GetMapping("/mensal/excel")
    public ResponseEntity<byte[]> mensalExcel(
            @RequestParam Integer mes,
            @RequestParam Integer ano,
            @RequestParam(required = false) Long unidadeId,
            @AuthenticationPrincipal Usuario usuarioLogado) throws IOException {

        RelatorioMensalResponse relatorio =
                relatorioService.gerarRelatorioMensal(mes, ano, unidadeId, usuarioLogado);
        byte[] excel = excelExportService.gerarExcelRelatorioMensal(relatorio);

        String nomeArquivo = String.format("relatorio_%02d_%d.xlsx", mes, ano);

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"" + nomeArquivo + "\"")
                .body(excel);
    }
}
