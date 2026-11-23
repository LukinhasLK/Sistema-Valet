package com.parkflash.web;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import com.parkflash.repositorio.UsuarioRepository;

import java.util.Set;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
@TestPropertySource(properties = "spring.datasource.url=jdbc:h2:mem:parkflash-teste;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH")
class ApiIntegracaoTest {

    private static final String PROPRIETARIO = "lucasrodrigues.10@icloud.com";
    private static final String GERENTE = "pedro@email.com";
    private static final String OPERADOR = "dario@email.com";

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper json;

    @Autowired
    private UsuarioRepository usuarios;

    @Autowired
    private jakarta.persistence.EntityManager entidades;

    private void concederUnidade(long usuario, long unidade) {
        var conta = usuarios.findById(usuario).orElseThrow();
        conta.definirUnidades(Set.of(unidade));
        usuarios.flush();
    }

    private String token(String email, String senha) throws Exception {
        String corpo = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"identificador\":\"" + email + "\",\"senha\":\"" + senha + "\"}"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return json.readTree(corpo).get("token").asText();
    }

    private String token(String email) throws Exception {
        return token(email, "123456");
    }

    private static MockHttpServletRequestBuilder comToken(MockHttpServletRequestBuilder req, String token) {
        return req.header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON);
    }

    private static String ficha(String data, String turno, String manobristas) {
        return """
                {"data":"%s","unidadeId":1,"turno":"%s","fichaInicio":100,"fichaFim":150,"fichasCanceladas":2,
                 "valorDinheiro":500,"valorCartao":1000,"taxaMaquininha":2,
                 "manobristas":[%s],
                 "despesasAdicionais":[{"descricao":"Lanche","valor":30}],
                 "totalBruto":999999,"totalLiquido":999999,"totalCarros":999}
                """.formatted(data, turno, manobristas);
    }

    @Test
    void loginDevolveTokenEUsuarioSemSenha() throws Exception {
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"identificador\":\"Lucas\",\"senha\":\"123456\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token", not(emptyString())))
                .andExpect(jsonPath("$.usuario.nivel").value("Proprietário"))
                .andExpect(jsonPath("$.usuario.senha").doesNotExist())
                .andExpect(jsonPath("$.usuario.senhaHash").doesNotExist());
    }

    @Test
    void senhaErradaETokenAusenteOuAdulteradoSao401() throws Exception {
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"identificador\":\"" + OPERADOR + "\",\"senha\":\"errada\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.mensagem").value("E-mail/usuário ou senha incorretos."));
        mvc.perform(get("/api/fichas")).andExpect(status().isUnauthorized());

        String original = token(OPERADOR);
        int inicioAssinatura = original.lastIndexOf('.') + 1;
        char substituto = original.charAt(inicioAssinatura) == 'A' ? 'B' : 'A';
        String adulterado = original.substring(0, inicioAssinatura) + substituto + original.substring(inicioAssinatura + 1);
        mvc.perform(comToken(get("/api/fichas"), adulterado)).andExpect(status().isUnauthorized());
    }

    @Test
    void permissoesPorNivelNoServidor() throws Exception {
        String operador = token(OPERADOR);
        String gerente = token(GERENTE);
        String proprietario = token(PROPRIETARIO);

        mvc.perform(comToken(get("/api/fichas"), operador)).andExpect(status().isOk());
        mvc.perform(comToken(get("/api/despesas"), operador)).andExpect(status().isForbidden());
        mvc.perform(comToken(get("/api/relatorios/resumo?ano=2026"), operador)).andExpect(status().isForbidden());
        mvc.perform(comToken(delete("/api/fichas/1"), operador)).andExpect(status().isForbidden());
        mvc.perform(comToken(post("/api/unidades").content("{\"nome\":\"X\",\"endereco\":\"Y\"}"), operador))
                .andExpect(status().isForbidden());

        mvc.perform(comToken(get("/api/despesas"), gerente)).andExpect(status().isOk());
        mvc.perform(comToken(get("/api/usuarios"), gerente)).andExpect(status().isForbidden());
        mvc.perform(comToken(get("/api/relatorios/divisao-lucro?ano=2026&unidadeId=1"), gerente)).andExpect(status().isForbidden());
        mvc.perform(comToken(delete("/api/socios/1"), gerente)).andExpect(status().isForbidden());

        mvc.perform(comToken(get("/api/usuarios"), proprietario))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].senhaHash").doesNotExist());
    }

    @Test
    void servidorCalculaTotaisEBloqueiaDuplicadaEManobristaRepetido() throws Exception {
        String operador = token(OPERADOR);
        concederUnidade(3, 1);
        String equipe = "{\"manobristaId\":1,\"diaria\":80},{\"manobristaId\":2,\"diaria\":90}";

        // 500 + (1000 − 2%) − 170 − 30 = 1280
        mvc.perform(comToken(post("/api/fichas"), operador).content(ficha("2030-01-10", "noite", equipe)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.totalCarros").value(48))
                .andExpect(jsonPath("$.totalBruto").value(1500.0))
                .andExpect(jsonPath("$.totalLiquido").value(1280.0))
                .andExpect(jsonPath("$.turno").value("noite"));

        mvc.perform(comToken(post("/api/fichas"), operador).content(ficha("2030-01-10", "noite", equipe)))
                .andExpect(status().isConflict());

        String repetido = "{\"manobristaId\":1,\"diaria\":80},{\"manobristaId\":1,\"diaria\":80}";
        mvc.perform(comToken(post("/api/fichas"), operador).content(ficha("2030-01-11", "dia", repetido)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.mensagem", containsString("duas vezes")));
    }

    @Test
    void desativaUnidadeEManobristaSemRemoverFichas() throws Exception {
        String proprietario = token(PROPRIETARIO);
        mvc.perform(comToken(delete("/api/unidades/1"), proprietario)).andExpect(status().isNoContent());
        mvc.perform(comToken(get("/api/unidades"), proprietario))
                .andExpect(jsonPath("$[?(@.id == 1)].ativa", contains(false)));
        mvc.perform(comToken(get("/api/fichas"), proprietario))
                .andExpect(jsonPath("$[?(@.unidadeId == 1)]", not(empty())));
        mvc.perform(comToken(post("/api/fichas"), proprietario).content(ficha("2039-01-01", "dia", "")))
                .andExpect(status().isBadRequest());
        mvc.perform(comToken(delete("/api/manobristas/1"), proprietario)).andExpect(status().isNoContent());
        mvc.perform(comToken(get("/api/manobristas"), proprietario))
                .andExpect(jsonPath("$[?(@.id == 1)].ativo", contains(false)));
        mvc.perform(comToken(post("/api/fichas"), proprietario).content(ficha("2039-01-02", "dia",
                "{\"manobristaId\":1,\"diaria\":10}").replace("\"unidadeId\":1", "\"unidadeId\":2")))
                .andExpect(status().isBadRequest());
    }

    @Test
    void resumoDescontaDespesasFixasComoOFront() throws Exception {
        mvc.perform(comToken(get("/api/relatorios/resumo?mes=6&ano=2026"), token(PROPRIETARIO)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.lucroFichas").value(5377.25))
                .andExpect(jsonPath("$.despesasFixas").value(8420.0))
                .andExpect(jsonPath("$.resultado").value(-3042.75));
    }

    @Test
    void novoUsuarioEntraComSenhaGuardadaComoHashETrocaASenha() throws Exception {
        String proprietario = token(PROPRIETARIO);
        mvc.perform(comToken(post("/api/usuarios"), proprietario)
                        .content("{\"nome\":\"Ana\",\"email\":\"Ana@Email.com\",\"nivel\":\"Gerente\",\"senha\":\"segredo1\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.email").value("ana@email.com"))
                .andExpect(jsonPath("$.senha").doesNotExist());

        mvc.perform(comToken(post("/api/usuarios"), proprietario)
                        .content("{\"nome\":\"Ana 2\",\"email\":\"ana@email.com\",\"nivel\":\"Operador\",\"senha\":\"segredo1\"}"))
                .andExpect(status().isConflict());

        String ana = token("ana@email.com", "segredo1");
        mvc.perform(comToken(put("/api/auth/senha"), ana).content("{\"senhaAtual\":\"errada\",\"novaSenha\":\"nova1234\"}"))
                .andExpect(status().isBadRequest());
        mvc.perform(comToken(put("/api/auth/senha"), ana).content("{\"senhaAtual\":\"segredo1\",\"novaSenha\":\"nova1234\"}"))
                .andExpect(status().isNoContent());
        mvc.perform(comToken(get("/api/auth/me"), ana)).andExpect(status().isUnauthorized());
        token("ana@email.com", "nova1234");
    }

    @Test
    void usuarioExcluidoPerdeOAcessoMesmoComTokenValido() throws Exception {
        String operador = token(OPERADOR);
        mvc.perform(comToken(delete("/api/usuarios/3"), token(PROPRIETARIO))).andExpect(status().isNoContent());
        mvc.perform(comToken(get("/api/fichas"), operador)).andExpect(status().isUnauthorized());
    }

    @Test
    void escopoVazioNaoTrazDadosEAlteracaoDeVinculoValeNoMesmoToken() throws Exception {
        String gerente = token(GERENTE);
        mvc.perform(comToken(get("/api/unidades"), gerente)).andExpect(jsonPath("$.length()").value(0));
        mvc.perform(comToken(get("/api/fichas"), gerente)).andExpect(jsonPath("$.length()").value(0));
        mvc.perform(comToken(get("/api/despesas"), gerente)).andExpect(jsonPath("$.length()").value(0));
        mvc.perform(comToken(get("/api/relatorios/resumo?ano=2026"), gerente))
                .andExpect(jsonPath("$.quantidadeFichas").value(0));
        concederUnidade(2, 1);
        mvc.perform(comToken(get("/api/unidades"), gerente))
                .andExpect(jsonPath("$[*].id", contains(1)));
        mvc.perform(comToken(get("/api/fichas"), gerente))
                .andExpect(jsonPath("$[*].unidadeId", everyItem(is(1))));
        mvc.perform(comToken(get("/api/despesas"), gerente))
                .andExpect(jsonPath("$[*].unidadeId", everyItem(is(1))));
        mvc.perform(comToken(get("/api/relatorios/resumo?ano=2026&unidadeId=2"), gerente))
                .andExpect(status().isForbidden());
        mvc.perform(comToken(get("/api/socios"), gerente)).andExpect(status().isForbidden());
        mvc.perform(comToken(get("/api/manobristas"), gerente)).andExpect(jsonPath("$[0].cpf").isEmpty());
        mvc.perform(comToken(post("/api/fichas"), gerente).content(ficha("2030-01-01", "dia", "")
                .replace("\"unidadeId\":1", "\"unidadeId\":2"))).andExpect(status().isForbidden());
        mvc.perform(comToken(get("/api/pagamentos-manobristas/resumo?unidadeId=2"), gerente))
                .andExpect(status().isForbidden());
    }

    @Test
    void pixSomaAoBrutoELiquidoSemReceberTaxaEContinuaEmEdicaoPorClienteAntigo() throws Exception {
        String proprietario = token(PROPRIETARIO);
        String equipe = "{\"manobristaId\":1,\"diaria\":80}";
        String antigo = ficha("2030-02-10", "noite", equipe);
        String comPix = antigo.replace("\"valorCartao\":1000", "\"valorCartao\":1000,\"valorPix\":25.30");
        String resposta = mvc.perform(comToken(post("/api/fichas"), proprietario).content(comPix))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.totalBruto").value(1525.30))
                .andExpect(jsonPath("$.totalLiquido").value(1395.30))
                .andReturn().getResponse().getContentAsString();
        long id = json.readTree(resposta).get("id").asLong();
        mvc.perform(comToken(put("/api/fichas/" + id), proprietario).content(antigo))
                .andExpect(status().isOk()).andExpect(jsonPath("$.valorPix").value(25.30));
        mvc.perform(comToken(put("/api/fichas/" + id), proprietario)
                .content(comPix.replace("25.30", "1.234"))).andExpect(status().isBadRequest());
        mvc.perform(comToken(get("/api/fichas/" + id), proprietario))
                .andExpect(jsonPath("$.valorPix").value(25.30));
    }

    @Test
    void fechamentoExigeConferenciaEscopoEGestaoEReabreComMotivoAuditado() throws Exception {
        String dono = token(PROPRIETARIO);
        String gerente = token(GERENTE);
        String operador = token(OPERADOR);
        concederUnidade(3, 1);
        String corpo = ficha("2031-03-10", "noite", "");
        long id = json.readTree(mvc.perform(comToken(post("/api/fichas"), dono).content(corpo))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.situacao").value("EM_EDICAO"))
                .andReturn().getResponse().getContentAsString()).get("id").asLong();
        String url = "/api/fichas/" + id;
        mvc.perform(comToken(post(url + "/transicao"), dono).content("{\"acao\":\"FECHAR\"}"))
                .andExpect(status().isConflict());
        mvc.perform(comToken(post(url + "/transicao"), operador).content("{\"acao\":\"ENVIAR\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.situacao").value("PRONTA"));
        mvc.perform(comToken(post(url + "/transicao"), gerente).content("{\"acao\":\"FECHAR\"}"))
                .andExpect(status().isForbidden());
        concederUnidade(2, 1);
        mvc.perform(comToken(post(url + "/transicao"), operador).content("{\"acao\":\"FECHAR\"}"))
                .andExpect(status().isForbidden());
        mvc.perform(comToken(post(url + "/transicao"), gerente).content("{\"acao\":\"FECHAR\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.situacao").value("FECHADA"))
                .andExpect(jsonPath("$.fechadoPor").value(2));
        mvc.perform(comToken(put(url), dono).content(corpo)).andExpect(status().isConflict());
        mvc.perform(comToken(delete(url), dono)).andExpect(status().isConflict());
        mvc.perform(comToken(post(url + "/transicao"), gerente).content("{\"acao\":\"REABRIR\"}"))
                .andExpect(status().isBadRequest());
        mvc.perform(comToken(post(url + "/transicao"), gerente)
                        .content("{\"acao\":\"REABRIR\",\"justificativa\":\"Conferir voucher\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.situacao").value("EM_EDICAO"));
        mvc.perform(comToken(get(url + "/historico"), gerente))
                .andExpect(jsonPath("$[0].justificativa").value("Conferir voucher"));
        mvc.perform(comToken(delete(url), dono)).andExpect(status().isNoContent());
        mvc.perform(comToken(get(url), dono)).andExpect(status().isNotFound());
        mvc.perform(comToken(get(url + "/historico"), gerente))
                .andExpect(jsonPath("$[0].acao").value("CANCELAR"));
    }

    @Test
    void exportacaoExcelUsaMesmoResumoEPermissaoDoRelatorio() throws Exception {
        String gerente = token(GERENTE);
        concederUnidade(2, 1);
        String filtro = "?ano=2026&mes=6&unidadeId=1";
        var resposta = mvc.perform(comToken(get("/api/relatorios/financeiro" + filtro), gerente))
                .andExpect(status().isOk()).andReturn().getResponse();
        var relatorio = json.readTree(resposta.getContentAsByteArray());
        var binario = mvc.perform(comToken(get("/api/relatorios/financeiro/excel" + filtro), gerente))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray();
        try (var planilha = new org.apache.poi.xssf.usermodel.XSSFWorkbook(new java.io.ByteArrayInputStream(binario))) {
            org.assertj.core.api.Assertions.assertThat(planilha.getSheet("Resumo").getRow(8).getCell(1).getNumericCellValue())
                    .isEqualTo(relatorio.at("/resumo/resultado").asDouble());
            var porUnidade = planilha.getSheet("Fichas por unidade");
            assertThat(porUnidade.getLastRowNum()).isEqualTo(1);
            assertThat(porUnidade.getRow(1).getCell(3).getNumericCellValue())
                    .isEqualTo(relatorio.at("/resumo/totalBruto").asDouble());
            org.assertj.core.api.Assertions.assertThat(planilha.getSheet("Fichas").getLastRowNum())
                    .isEqualTo(relatorio.get("linhas").size());
        }
        var carros = "/api/relatorios/carros/excel";
        var arquivo = mvc.perform(comToken(get(carros + filtro), gerente))
                .andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store"))
                .andReturn().getResponse().getContentAsByteArray();
        try (var planilha = new org.apache.poi.xssf.usermodel.XSSFWorkbook(new java.io.ByteArrayInputStream(arquivo))) {
            var aba = planilha.getSheet("Carros por mês");
            var total = aba.getRow(aba.getLastRowNum());
            assertThat(total.getCell(2).getNumericCellValue()).isEqualTo(relatorio.at("/resumo/totalCarros").asDouble());
            assertThat(total.getCell(4).getNumericCellValue()).isEqualTo(relatorio.at("/resumo/lucroFichas").asDouble());
        }
        mvc.perform(comToken(get(carros + "?ano=2026&unidadeId=2"), gerente)).andExpect(status().isForbidden());
        mvc.perform(comToken(get(carros + filtro), token(OPERADOR))).andExpect(status().isForbidden());
        mvc.perform(comToken(get("/api/relatorios/financeiro/excel?ano=2026&unidadeId=2"), gerente))
                .andExpect(status().isForbidden());
    }

    @Test
    void auditoriaAdministrativaRegistraCamposEProtegeHistorico() throws Exception {
        String dono = token(PROPRIETARIO);
        String operador = token(OPERADOR);
        var unidade = json.readTree(mvc.perform(comToken(post("/api/unidades"), dono)
                        .content("{\"nome\":\"Auditoria sintética\",\"endereco\":\"Rua A\"}"))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString());
        String url = "/api/unidades/" + unidade.get("id").asLong();
        mvc.perform(comToken(put(url), dono).content("{\"nome\":\"Auditoria sintética\",\"endereco\":\"Rua B\"}"))
                .andExpect(status().isOk());
        mvc.perform(comToken(delete(url), dono)).andExpect(status().isNoContent());
        mvc.perform(comToken(get(url + "/auditoria"), dono))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.itens[0].campo").value("Situação"))
                .andExpect(jsonPath("$.itens[0].anterior").value("Ativa"))
                .andExpect(jsonPath("$.itens[0].atual").value("Inativa"))
                .andExpect(jsonPath("$.itens[1].anterior").value("Rua A"));
        mvc.perform(comToken(get(url + "/auditoria"), operador)).andExpect(status().isForbidden());

        for (int i = 0; i < 26; i++) {
            mvc.perform(comToken(put(url), dono)
                            .content(("{\"nome\":\"Auditoria sintética\",\"endereco\":\"Rua %d\"}").formatted(i)))
                    .andExpect(status().isOk());
        }
        var pagina = json.readTree(mvc.perform(comToken(get(url + "/auditoria"), dono))
                .andExpect(jsonPath("$.itens", hasSize(25)))
                .andReturn().getResponse().getContentAsString());
        long cursor = pagina.get("proximo").asLong();
        var anterior = json.readTree(mvc.perform(comToken(get(url + "/auditoria").param("antes", Long.toString(cursor)), dono))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        assertThat(anterior.get("itens").get(0).get("id").asLong()).isLessThan(cursor);

        var conta = json.readTree(mvc.perform(comToken(post("/api/usuarios"), dono)
                        .content("{\"nome\":\"Teste auditoria\",\"email\":\"auditado@example.test\",\"nivel\":\"Operador\",\"senha\":\"teste-sintetico\",\"unidadeIds\":[1]}"))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString());
        String usuario = "/api/usuarios/" + conta.get("id").asLong();
        mvc.perform(comToken(put(usuario), dono)
                        .content("{\"nome\":\"Teste auditoria\",\"email\":\"auditado@example.test\",\"nivel\":\"Gerente\",\"unidadeIds\":[2]}"))
                .andExpect(status().isOk());
        mvc.perform(comToken(delete(usuario), dono)).andExpect(status().isNoContent());
        mvc.perform(comToken(get(usuario + "/auditoria"), dono))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.itens[0].atual").value("Desativado"))
                .andExpect(jsonPath("$.itens[1].anterior").value("1"))
                .andExpect(jsonPath("$.itens[1].atual").value("2"))
                .andExpect(jsonPath("$.itens[2].anterior").value("Operador"))
                .andExpect(jsonPath("$.itens[2].atual").value("Gerente"));
        mvc.perform(comToken(get(usuario + "/auditoria"), operador)).andExpect(status().isForbidden());
        mvc.perform(comToken(get("/api/usuarios?incluirInativos=true"), dono))
                .andExpect(jsonPath("$[?(@.email == 'auditado@example.test')].ativo", contains(false)));
    }

    @Test
    void conciliaEventoComFichaFechadaEDespesaSemDuplicarEObservaReabertura() throws Exception {
        String dono = token(PROPRIETARIO);
        concederUnidade(2, 2);
        String gerente = token(GERENTE);
        String dadosEvento = """
                {"unidadeId":1,"nome":"Conciliação","contratante":"Teste","local":"Local de teste",
                 "inicio":"2030-07-20T08:00:00","fim":"2030-07-20T22:00:00","veiculosPrevistos":20,
                 "capacidade":50,"equipePrevista":2,"responsavel":"Teste","situacao":"REALIZADO"}
                """;
        var evento = mvc.perform(comToken(post("/api/eventos"), dono).content(dadosEvento))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        var segundo = mvc.perform(comToken(post("/api/eventos"), dono).content(dadosEvento.replace("Conciliação", "Outro evento")))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        String eventoUrl = "/api/eventos/" + json.readTree(evento).get("id").asLong();
        String financeiro = eventoUrl + "/financeiro";
        String ficha = mvc.perform(comToken(post("/api/fichas"), dono)
                        .content(ficha("2030-07-20", "dia", "{\"manobristaId\":1,\"diaria\":25}")))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        long fichaId = json.readTree(ficha).get("id").asLong();
        String transicao = "/api/fichas/" + fichaId + "/transicao";
        String vinculo = financeiro + "/FICHA/" + fichaId;
        mvc.perform(comToken(put(vinculo), dono)).andExpect(status().isBadRequest());
        for (String acao : java.util.List.of("ENVIAR", "FECHAR")) {
            mvc.perform(comToken(post(transicao), dono).content("{\"acao\":\"" + acao + "\"}"))
                    .andExpect(status().isOk());
        }
        entidades.flush();
        mvc.perform(comToken(get(financeiro), gerente)).andExpect(status().isForbidden());
        mvc.perform(comToken(put(vinculo), dono)).andExpect(status().isNoContent());
        mvc.perform(comToken(put(vinculo), dono)).andExpect(status().isNoContent());
        mvc.perform(comToken(put("/api/eventos/" + json.readTree(segundo).get("id").asLong()
                + "/financeiro/FICHA/" + fichaId), dono)).andExpect(status().isConflict());
        var despesa = mvc.perform(comToken(post("/api/despesas"), dono)
                        .content("{\"unidadeId\":1,\"data\":\"2030-07-20\",\"categoria\":\"Outros\",\"descricao\":\"Despesa teste\",\"valor\":20}"))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        mvc.perform(comToken(put(financeiro + "/DESPESA/" + json.readTree(despesa).get("id").asLong()), dono))
                .andExpect(status().isNoContent());
        mvc.perform(comToken(get(financeiro), dono))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.resultado").value(1405))
                .andExpect(jsonPath("$.fichas.validos").value(1))
                .andExpect(jsonPath("$.despesas.validos").value(1));
        mvc.perform(comToken(put(eventoUrl), dono).content(dadosEvento.replace("2030-07-20", "2030-07-21")))
                .andExpect(status().isConflict());
        mvc.perform(comToken(post(transicao), dono).content("{\"acao\":\"REABRIR\",\"justificativa\":\"Revisão de teste\"}"))
                .andExpect(status().isOk());
        entidades.flush();
        mvc.perform(comToken(get(financeiro), dono)).andExpect(status().isOk())
                .andExpect(jsonPath("$.resultado").value(-20))
                .andExpect(jsonPath("$.itens[0].vinculado").value(true))
                .andExpect(jsonPath("$.itens[0].elegivel").value(false));
        mvc.perform(comToken(delete(vinculo), dono)).andExpect(status().isNoContent());
    }

    @Test
    void modalidadeDaEquipePersisteSemRecalcularCustoEClienteAntigoMantemRegistro() throws Exception {
        String dono = token(PROPRIETARIO);
        String base = ficha("2026-12-31", "noite", "{\"manobristaId\":1,\"diaria\":25}");
        String corpo = base.replace("\"diaria\":25", "\"diaria\":25,\"modalidade\":\"VALOR_FIXO_POR_MANOBRA\"");
        var resposta = mvc.perform(comToken(post("/api/fichas"), dono).content(corpo))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.manobristas[0].diaria").value(25))
                .andExpect(jsonPath("$.manobristas[0].modalidade").value("VALOR_FIXO_POR_MANOBRA"))
                .andExpect(jsonPath("$.totalLiquido").value(1425))
                .andReturn().getResponse().getContentAsString();
        String caminho = "/api/fichas/" + json.readTree(resposta).get("id").asLong();
        mvc.perform(comToken(get(caminho), dono))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.manobristas[0].modalidade").value("VALOR_FIXO_POR_MANOBRA"));
        mvc.perform(comToken(put(caminho), dono).content(base))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.manobristas[0].modalidade").value("VALOR_FIXO_POR_MANOBRA"))
                .andExpect(jsonPath("$.totalLiquido").value(1425));
        mvc.perform(comToken(put(caminho), dono).content(corpo.replace("VALOR_FIXO_POR_MANOBRA", "PORCENTAGEM")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.manobristas[0].modalidade").value("PORCENTAGEM"))
                .andExpect(jsonPath("$.totalLiquido").value(1425));
        mvc.perform(comToken(put(caminho), dono).content(corpo.replace("VALOR_FIXO_POR_MANOBRA", "DESCONHECIDA")))
                .andExpect(status().isBadRequest());
    }

    @Test
    void exportaPdfsComEscopoDoGerenteEConteudoDoRelatorio() throws Exception {
        concederUnidade(2, 1);
        String gerente = token(GERENTE);
        String operador = token(OPERADOR);
        for (var relatorio : java.util.Map.of(
                "financeiro/pdf", "Relatório financeiro", "carros/pdf", "Carros por mês").entrySet()) {
            var caminho = "/api/relatorios/" + relatorio.getKey();
            var resposta = mvc.perform(comToken(get(caminho).param("ano", "2026").param("unidadeId", "1"), gerente))
                    .andExpect(status().isOk())
                    .andExpect(content().contentType(MediaType.APPLICATION_PDF))
                    .andExpect(header().string("Content-Disposition", startsWith("attachment")))
                    .andExpect(header().string("Cache-Control", "no-store"))
                    .andReturn().getResponse();
            try (var pdf = Loader.loadPDF(resposta.getContentAsByteArray())) {
                assertThat(new PDFTextStripper().getText(pdf)).contains(relatorio.getValue(), "2026");
            }
            mvc.perform(comToken(get(caminho).param("ano", "2026").param("unidadeId", "2"), gerente))
                    .andExpect(status().isForbidden());
            mvc.perform(comToken(get(caminho).param("ano", "2026"), operador))
                    .andExpect(status().isForbidden());
        }
    }

    @Test
    void rateioAtomicamenteFechaEmCemEPreservaVigencia() throws Exception {
        String dono = token(PROPRIETARIO);
        String inicio = java.time.YearMonth.now(com.parkflash.servico.PagamentoManobristaService.FUSO_NEGOCIO)
                .plusMonths(1).atDay(1).toString();
        String anterior = java.time.LocalDate.parse(inicio).minusDays(1).toString();
        String url = "/api/socios/rateio/1";
        var antes = mvc.perform(comToken(get(url + "?data=" + anterior), dono))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        String pedido = """
                {"vigenteDesde":"%s","partes":[{"socioId":1,"percentual":55},{"socioId":2,"percentual":45}]}
                """.formatted(inicio);
        mvc.perform(comToken(post(url), dono).content(pedido.replace("45", "44.99")))
                .andExpect(status().isBadRequest());
        mvc.perform(comToken(post(url), dono).content(pedido)).andExpect(status().isCreated());
        mvc.perform(comToken(get(url + "?data=" + inicio), dono))
                .andExpect(jsonPath("$[*].percentual", contains(55.0, 45.0)));
        var depois = mvc.perform(comToken(get(url + "?data=" + anterior), dono))
                .andReturn().getResponse().getContentAsString();
        org.assertj.core.api.Assertions.assertThat(depois).isEqualTo(antes);
    }

    @Test
    void agendaAssociaEscalaDetectaConflitoEAbreHorarioAoCancelar() throws Exception {
        String gerente = token(GERENTE);
        concederUnidade(2, 1);
        String evento = """
                {"unidadeId":1,"nome":"Evento sintético","contratante":"Cliente teste","local":"Local teste",
                 "inicio":"2035-01-10T18:00","fim":"2035-01-10T23:30","veiculosPrevistos":30,
                 "capacidade":35,"equipePrevista":2,"responsavel":"Plantão","situacao":"PLANEJADO"}
                """;
        long eventoId = json.readTree(mvc.perform(comToken(post("/api/eventos"), gerente).content(evento))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString()).get("id").asLong();
        mvc.perform(comToken(get("/api/eventos?unidadeId=2"), gerente)).andExpect(status().isForbidden());
        String escala = """
                {"unidadeId":1,"eventoId":%d,"inicio":"2035-01-10T18:00","fim":"2035-01-10T22:00",
                 "responsavel":"Plantão","situacao":"PLANEJADA","manobristaIds":[1,2]}
                """.formatted(eventoId);
        long escalaId = json.readTree(mvc.perform(comToken(post("/api/escalas"), gerente).content(escala))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString()).get("id").asLong();
        mvc.perform(comToken(post("/api/escalas"), gerente).content(escala)).andExpect(status().isConflict());
        mvc.perform(comToken(put("/api/eventos/" + eventoId), gerente)
                .content(evento.replace("PLANEJADO", "CANCELADO"))).andExpect(status().isConflict());
        mvc.perform(comToken(put("/api/escalas/" + escalaId), gerente)
                .content(escala.replace("PLANEJADA", "CANCELADA"))).andExpect(status().isOk());
        mvc.perform(comToken(get("/api/escalas/" + escalaId + "/historico"), gerente))
                .andExpect(jsonPath("$[*].situacao", contains("CANCELADA", "PLANEJADA")));
        mvc.perform(comToken(post("/api/escalas"), gerente).content(escala)).andExpect(status().isCreated());
    }

    @Test
    void painelComparaPeriodosEmUmSoEscopo() throws Exception {
        String gerente = token(GERENTE);
        concederUnidade(2, 1);
        mvc.perform(comToken(get("/api/relatorios/painel?ano=2026&mes=6"), gerente))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.porUnidade[*].unidadeId", everyItem(is(1))))
                .andExpect(jsonPath("$.pagamentosPendentes").value(0));
        mvc.perform(comToken(get("/api/relatorios/painel?ano=2026&mes=6&unidadeId=2"), gerente))
                .andExpect(status().isForbidden());
    }

    @Test
    void despesaCanceladaSaiDosTotaisEConservaVersoes() throws Exception {
        String gerente = token(GERENTE);
        concederUnidade(2, 1);
        String filtro = "?ano=2036&mes=12&unidadeId=1";
        String pedido = """
                {"data":"2036-12-10","unidadeId":1,"categoria":"Outros","descricao":"Despesa de teste","valor":20.00}
                """;
        long id = json.readTree(mvc.perform(comToken(post("/api/despesas"), gerente).content(pedido))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString()).get("id").asLong();
        String url = "/api/despesas/" + id;
        mvc.perform(comToken(put(url), gerente).content(pedido.replace("20.00", "30.00")))
                .andExpect(status().isOk());
        mvc.perform(comToken(get("/api/relatorios/resumo" + filtro), gerente))
                .andExpect(jsonPath("$.despesasFixas").value(30));
        mvc.perform(comToken(post(url + "/cancelamento"), gerente)
                        .content("{\"justificativa\":\"Lançamento duplicado\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.cancelada").value(true));
        mvc.perform(comToken(get("/api/relatorios/resumo" + filtro), gerente))
                .andExpect(jsonPath("$.despesasFixas").value(0));
        mvc.perform(comToken(get(url + "/historico"), gerente))
                .andExpect(jsonPath("$[*].acao", contains("CANCELAR", "EDITAR", "ANTES_EDICAO", "CRIAR")))
                .andExpect(jsonPath("$[0].justificativa").value("Lançamento duplicado"));
    }

    @Test
    void validacaoDevolveMensagemDoCampo() throws Exception {
        JsonNode erro = json.readTree(mvc.perform(comToken(post("/api/despesas"), token(GERENTE))
                        .content("{\"data\":\"2026-06-01\",\"unidadeId\":1,\"categoria\":\"Aluguel\",\"descricao\":\"\",\"valor\":0}"))
                .andExpect(status().isBadRequest())
                .andReturn().getResponse().getContentAsString());
        org.assertj.core.api.Assertions.assertThat(erro.get("campos").has("descricao")).isTrue();
        org.assertj.core.api.Assertions.assertThat(erro.get("campos").has("valor")).isTrue();
    }
}
