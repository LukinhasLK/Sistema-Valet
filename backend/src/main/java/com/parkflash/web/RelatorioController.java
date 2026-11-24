package com.parkflash.web;

import com.parkflash.servico.RelatorioService;
import com.parkflash.servico.RelatorioExcel;
import com.parkflash.servico.RelatorioPdf;
import com.parkflash.servico.PainelService;
import com.parkflash.seguranca.AcessoUnidades;
import com.parkflash.seguranca.UsuarioLogado;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import com.parkflash.web.dto.DivisaoLucro;
import com.parkflash.web.dto.ResumoPeriodo;
import com.parkflash.web.dto.RelatorioFinanceiro;
import org.springframework.http.*;

import java.io.IOException;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/relatorios")
@Tag(name = "Relatórios")
public class RelatorioController {

    private final RelatorioService servico;
    private final RelatorioExcel excel;
    private final PainelService painel;
    private final RelatorioPdf pdf;

    public RelatorioController(RelatorioService servico, RelatorioExcel excel, PainelService painel, RelatorioPdf pdf) {
        this.servico = servico;
        this.excel = excel;
        this.painel = painel;
        this.pdf = pdf;
    }

    @GetMapping("/resumo")
    @Operation(summary = "Lucro das fichas, despesas fixas e resultado (sem mês = ano inteiro; sem unidade = todas)")
    public ResumoPeriodo resumo(@RequestParam(required = false) Integer mes, @RequestParam int ano,
                                @RequestParam(required = false) Long unidadeId, @AuthenticationPrincipal UsuarioLogado ator) {
        return servico.resumo(mes, ano, unidadeId, AcessoUnidades.de(ator));
    }

    @GetMapping("/painel")
    public PainelService.Resposta painel(@RequestParam int mes, @RequestParam int ano,
                                        @RequestParam(required = false) Long unidadeId,
                                        @AuthenticationPrincipal UsuarioLogado ator) {
        return painel.consultar(mes, ano, unidadeId, AcessoUnidades.de(ator));
    }

    @GetMapping("/financeiro")
    public RelatorioFinanceiro financeiro(@RequestParam(required = false) Integer mes, @RequestParam int ano,
                                          @RequestParam(required = false) Long unidadeId,
                                          @AuthenticationPrincipal UsuarioLogado ator) {
        return servico.financeiro(mes, ano, unidadeId, AcessoUnidades.de(ator));
    }

    @GetMapping("/financeiro/excel")
    public ResponseEntity<byte[]> financeiroExcel(@RequestParam(required = false) Integer mes, @RequestParam int ano,
                                                   @RequestParam(required = false) Long unidadeId,
                                                   @AuthenticationPrincipal UsuarioLogado ator) throws IOException {
        var relatorio = servico.financeiro(mes, ano, unidadeId, AcessoUnidades.de(ator));
        return excelAnexo("parkflash-financeiro-" + relatorio.inicio(), excel.gerar(relatorio));
    }

    @GetMapping("/carros/excel")
    public ResponseEntity<byte[]> carrosExcel(@RequestParam int ano, @RequestParam(required = false) Integer mes,
                                               @RequestParam(required = false) Long unidadeId,
                                               @AuthenticationPrincipal UsuarioLogado ator) throws IOException {
        var relatorio = servico.financeiro(mes, ano, unidadeId, AcessoUnidades.de(ator));
        return excelAnexo("parkflash-carros-" + relatorio.inicio(), excel.carros(relatorio));
    }

    private ResponseEntity<byte[]> excelAnexo(String nome, byte[] arquivo) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename(nome + ".xlsx").build().toString())
                .body(arquivo);
    }

    @GetMapping("/financeiro/pdf")
    public ResponseEntity<byte[]> financeiroPdf(@RequestParam(required = false) Integer mes, @RequestParam int ano,
                                                 @RequestParam(required = false) Long unidadeId,
                                                 @AuthenticationPrincipal UsuarioLogado ator) throws IOException {
        var relatorio = servico.financeiro(mes, ano, unidadeId, AcessoUnidades.de(ator));
        return pdfAnexo("parkflash-financeiro-" + relatorio.inicio(), pdf.financeiro(relatorio));
    }

    @GetMapping("/carros/pdf")
    public ResponseEntity<byte[]> carrosPdf(@RequestParam int ano, @RequestParam(required = false) Integer mes,
                                             @RequestParam(required = false) Long unidadeId,
                                             @AuthenticationPrincipal UsuarioLogado ator) throws IOException {
        var relatorio = servico.financeiro(mes, ano, unidadeId, AcessoUnidades.de(ator));
        return pdfAnexo("parkflash-carros-" + relatorio.inicio(), pdf.carros(relatorio));
    }

    private ResponseEntity<byte[]> pdfAnexo(String nome, byte[] arquivo) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename(nome + ".pdf").build().toString())
                .body(arquivo);
    }

    @GetMapping("/divisao-lucro")
    @Operation(summary = "Rateio do resultado da unidade entre os sócios (somente Proprietário)")
    public DivisaoLucro divisao(@RequestParam(required = false) Integer mes, @RequestParam int ano,
                                @RequestParam(required = false) Long unidadeId, @AuthenticationPrincipal UsuarioLogado ator) {
        return servico.divisao(mes, ano, unidadeId, AcessoUnidades.de(ator));
    }
}
