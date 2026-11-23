package com.parkflash.web;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.parkflash.servico.PagamentoManobristaService;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {
        "spring.datasource.url=${PARKFLASH_TEST_DB_URL:jdbc:h2:mem:parkflash-pagamentos;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH}",
        "spring.datasource.username=${PARKFLASH_TEST_DB_USER:sa}",
        "spring.datasource.password=${PARKFLASH_TEST_DB_PASSWORD:}",
})
@AutoConfigureMockMvc
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class PagamentoManobristaIntegracaoTest {
    private static final String API = "/api/pagamentos-manobristas";
    private static final byte[] PDF = "%PDF-1.4\n%%EOF".getBytes(StandardCharsets.US_ASCII);
    private final LocalDate hoje = LocalDate.now(PagamentoManobristaService.FUSO_NEGOCIO);

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired JdbcClient jdbc;
    private String proprietario;
    private String operador;

    @BeforeAll
    void autenticar() throws Exception {
        proprietario = token("lucasrodrigues.10@icloud.com");
        operador = token("dario@email.com");
    }

    @Test
    void fichasAntigasRetroativasEFuturasNaoGeramDivida() throws Exception {
        long manobrista = criarManobrista("Teste legado");
        long retroativa = criarFicha(hoje.minusDays(1), criarUnidade(), manobrista, 100);
        long futura = criarFicha(hoje.plusDays(1), criarUnidade(), manobrista, 100);
        mvc.perform(comToken(get(API + "/resumo").param("manobristaId", Long.toString(manobrista)), proprietario))
                .andExpect(status().isOk()).andExpect(jsonPath("$.aPagar").value(0));
        mvc.perform(comToken(get(API + "/conferencia").param("manobristaId", Long.toString(manobrista)), proprietario))
                .andExpect(status().isOk()).andExpect(jsonPath("$.total").value(0));
        assertThat(jdbc.sql("SELECT controle_pagamentos FROM ficha WHERE id = 1").query(Boolean.class).single()).isFalse();
        for (long id : new long[] { retroativa, futura }) {
            mvc.perform(comToken(post(API + "/conferencia/" + id), proprietario)
                            .content(reconhecimento(manobrista, 1, 100, 100, hoje)))
                    .andExpect(status().isConflict());
        }
    }

    @Test
    void reconheceRevisaConfirmaComprovanteEstornaEReabreSaldoComAuditoria() throws Exception {
        long manobrista = criarManobrista("Teste financeiro");
        long unidade = criarUnidade();
        long unidade2 = criarUnidade();
        long ficha = criarFicha(hoje, unidade, manobrista, 90);
        long ficha2 = criarFicha(hoje, unidade2, manobrista, 40);
        String filtro = Long.toString(manobrista);
        mvc.perform(comToken(get(API + "/conferencia").param("busca", "financeiro").param("tamanho", "1"), proprietario))
                .andExpect(status().isOk()).andExpect(jsonPath("$.total").value(2)).andExpect(jsonPath("$.itens.length()").value(1));
        mvc.perform(comToken(post(API + "/conferencia/" + ficha), proprietario).content(reconhecimento(manobrista, unidade, 89, 80, hoje)))
                .andExpect(status().isConflict());
        long diaria = reconhecer(ficha, unidade, manobrista, 90, 80);
        assertThat(reconhecer(ficha, unidade, manobrista, 90, 80)).isEqualTo(diaria);
        long diaria2 = reconhecer(ficha2, unidade2, manobrista, 40, 40);

        mvc.perform(comToken(put("/api/fichas/" + ficha), proprietario).content(ficha(hoje, unidade, manobrista, 79)))
                .andExpect(status().isConflict());
        mvc.perform(comToken(put("/api/fichas/" + ficha), proprietario).content(ficha(hoje, unidade, manobrista, 90)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.manobristas[0].diaria").value(90));
        mvc.perform(comToken(delete("/api/fichas/" + ficha), proprietario)).andExpect(status().isConflict());

        mvc.perform(comToken(get(API + "/resumo").param("manobristaId", filtro), proprietario))
                .andExpect(status().isOk()).andExpect(jsonPath("$.aPagar").value(120))
                .andExpect(jsonPath("$.manobristasPendentes").value(1)).andExpect(jsonPath("$.unidades.length()").value(2))
                .andExpect(jsonPath("$.meses[0].aPagar").value(120));
        mvc.perform(comToken(get(API + "/diarias").param("manobristaId", filtro).param("situacao", "PENDENTE"), proprietario))
                .andExpect(status().isOk()).andExpect(jsonPath("$.total").value(2));

        UUID op = UUID.randomUUID();
        String diarias = selecionada(diaria, 0) + "," + selecionada(diaria2, 0);
        String dados = confirmacao(op, manobrista, diarias, 120, hoje);
        enviar(dados.replace("true", "false"), PDF).andExpect(status().isBadRequest());
        enviar(confirmacao(UUID.randomUUID(), manobrista, diarias, 119, hoje), null).andExpect(status().isBadRequest());
        enviar(confirmacao(UUID.randomUUID(), manobrista, diarias, 120, hoje.minusDays(1)), null).andExpect(status().isBadRequest());
        enviar(dados, "qualquer arquivo".getBytes(StandardCharsets.UTF_8)).andExpect(status().isBadRequest());
        long id = corpo(enviar(dados, PDF).andExpect(status().isOk())
                .andExpect(jsonPath("$.temComprovante").value(true))
                .andExpect(jsonPath("$.confirmador").value("Lucas"))
                .andExpect(jsonPath("$.itens.length()").value(2))).get("id").asLong();

        enviar(dados, PDF).andExpect(status().isOk()).andExpect(jsonPath("$.id").value(id));
        enviar(dados, null).andExpect(status().isConflict());
        enviar(confirmacao(UUID.randomUUID(), manobrista, diarias, 120, hoje), null).andExpect(status().isConflict());
        mvc.perform(comToken(get(API + "/historico/" + id + "/comprovante"), proprietario))
                .andExpect(status().isOk()).andExpect(content().bytes(PDF))
                .andExpect(header().string("Content-Disposition", "attachment; filename=\"comprovante-" + id + ".pdf\""));
        mvc.perform(comToken(get(API + "/resumo").param("manobristaId", filtro).param("unidadeId", Long.toString(unidade))
                        .param("inicio", hoje.toString()).param("fim", hoje.toString()), proprietario))
                .andExpect(status().isOk()).andExpect(jsonPath("$.aPagar").value(0))
                .andExpect(jsonPath("$.pago").value(80)).andExpect(jsonPath("$.pagamentos").value(1))
                .andExpect(jsonPath("$.meses[0].pago").value(80));
        mvc.perform(comToken(get(API + "/historico").param("manobristaId", filtro).param("unidadeId", Long.toString(unidade2)), proprietario))
                .andExpect(status().isOk()).andExpect(jsonPath("$.total").value(1)).andExpect(jsonPath("$.itens[0].valor").value(120));

        String estorno = API + "/historico/" + id + "/estorno";
        mvc.perform(comToken(post(estorno), proprietario).content("{\"motivo\":\" \"}")).andExpect(status().isBadRequest());
        for (int i = 0; i < 2; i++) {
            mvc.perform(comToken(post(estorno), proprietario).content("{\"motivo\":\"Registro duplicado no extrato\"}"))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.estornador").value("Lucas"))
                    .andExpect(jsonPath("$.motivoEstorno").value("Registro duplicado no extrato"));
        }
        mvc.perform(comToken(get(API + "/resumo").param("manobristaId", filtro), proprietario))
                .andExpect(status().isOk()).andExpect(jsonPath("$.aPagar").value(120))
                .andExpect(jsonPath("$.pago").value(0)).andExpect(jsonPath("$.pagamentos").value(0));
        mvc.perform(comToken(get(API + "/diarias").param("manobristaId", filtro).param("situacao", "ESTORNADO"), proprietario))
                .andExpect(status().isOk()).andExpect(jsonPath("$.total").value(2))
                .andExpect(jsonPath("$.itens[0].revisao").value(2));
        enviar(dados, PDF).andExpect(status().isOk()).andExpect(jsonPath("$.id").value(id));
        enviar(confirmacao(UUID.randomUUID(), manobrista, diarias, 120, hoje), null).andExpect(status().isConflict());
        enviar(confirmacao(UUID.randomUUID(), manobrista, selecionada(diaria, 2), 80, hoje), null).andExpect(status().isOk());
        mvc.perform(comToken(get(API + "/historico").param("manobristaId", filtro), proprietario))
                .andExpect(status().isOk()).andExpect(jsonPath("$.total").value(2));
    }

    @Test
    void pagamentoMultiunidadeExigeAcessoATodosOsItens() throws Exception {
        long manobrista = criarManobrista("Teste auditoria por unidade");
        long a = criarUnidade();
        long b = criarUnidade();
        long primeira = reconhecer(criarFicha(hoje, a, manobrista, 40), a, manobrista, 40, 40);
        long segunda = reconhecer(criarFicha(hoje, b, manobrista, 60), b, manobrista, 60, 60);
        long gerenteId = jdbc.sql("SELECT id FROM usuario WHERE email = :email").param("email", "pedro@email.com")
                .query(Long.class).single();
        jdbc.sql("INSERT INTO usuario_unidade (usuario_id, unidade_id) VALUES (:usuario, :unidade)")
                .param("usuario", gerenteId).param("unidade", a).update();
        try {
            String gerente = token("pedro@email.com");
            mvc.perform(comToken(get(API + "/diarias").param("manobristaId", Long.toString(manobrista)), gerente))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.total").value(1));
            var dados = confirmacao(UUID.randomUUID(), manobrista,
                    selecionada(primeira, 0) + "," + selecionada(segunda, 0), 100, hoje);
            long id = corpo(enviar(dados, PDF).andExpect(status().isOk())).get("id").asLong();
            mvc.perform(comToken(get(API + "/historico").param("manobristaId", Long.toString(manobrista)), gerente))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.total").value(0));
            mvc.perform(comToken(get(API + "/historico/" + id), gerente)).andExpect(status().isForbidden());
            mvc.perform(comToken(get(API + "/historico/" + id + "/comprovante"), gerente))
                    .andExpect(status().isForbidden());
        } finally {
            jdbc.sql("DELETE FROM usuario_unidade WHERE usuario_id = :usuario AND unidade_id = :unidade")
                    .param("usuario", gerenteId).param("unidade", a).update();
        }
    }

    @Test
    void concorrenciaPermiteSomenteUmaQuitacao() throws Exception {
        long manobrista = criarManobrista("Teste concorrência");
        long unidade = criarUnidade();
        long diaria = reconhecer(criarFicha(hoje, unidade, manobrista, 75), unidade, manobrista, 75, 75);
        var barreira = new CountDownLatch(2);
        var fila = Executors.newFixedThreadPool(2);
        try {
            var primeira = fila.submit(() -> enviarEmParalelo(manobrista, diaria, barreira));
            var segunda = fila.submit(() -> enviarEmParalelo(manobrista, diaria, barreira));
            assertThat(new int[] { primeira.get(15, TimeUnit.SECONDS), segunda.get(15, TimeUnit.SECONDS) })
                    .containsExactlyInAnyOrder(200, 409);
        } finally {
            fila.shutdownNow();
        }
        mvc.perform(comToken(get(API + "/resumo").param("manobristaId", Long.toString(manobrista)), proprietario))
                .andExpect(status().isOk()).andExpect(jsonPath("$.pagamentos").value(1)).andExpect(jsonPath("$.pago").value(75));
    }

    @Test
    void pixValidaTiposMascaraProtegeEAuditaConsulta() throws Exception {
        long manobrista = criarManobrista("Teste Pix");
        String caminho = API + "/pix/" + manobrista;
        mvc.perform(get(API + "/resumo")).andExpect(status().isUnauthorized());
        mvc.perform(comToken(get(API + "/resumo"), operador)).andExpect(status().isForbidden());
        mvc.perform(comToken(post(API + "/conferencia/1"), operador)).andExpect(status().isForbidden());
        mvc.perform(comToken(post(API + "/historico/1/estorno"), operador)).andExpect(status().isForbidden());
        mvc.perform(comToken(get(API + "/historico/1/comprovante"), operador)).andExpect(status().isForbidden());
        mvc.perform(comToken(get(caminho), proprietario)).andExpect(status().isNotFound());
        mvc.perform(comToken(put(caminho), proprietario).content(pix("CPF", "111.111.111-11"))).andExpect(status().isBadRequest());
        mvc.perform(comToken(put(caminho), operador).content(pix("CPF", "529.982.247-25"))).andExpect(status().isForbidden());
        mvc.perform(comToken(post(caminho + "/revelar"), operador)).andExpect(status().isForbidden());
        for (String[] chave : new String[][] {
                {"CPF", "529.982.247-25", "52998224725"},
                {"CNPJ", "12.ABC.345/01DE-35", "12ABC34501DE35"},
                {"TELEFONE", "(11) 98888-0000", "+5511988880000"},
                {"ALEATORIA", "123e4567-e89b-42d3-a456-426614174000", "123e4567-e89b-42d3-a456-426614174000"},
                {"EMAIL", "Pix.Teste@Exemplo.com", "pix.teste@exemplo.com"},
        }) {
            mvc.perform(comToken(put(caminho), proprietario).content(pix(chave[0], chave[1])))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.chave").doesNotExist());
            mvc.perform(comToken(post(caminho + "/revelar"), proprietario))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.chave").value(chave[2]));
        }
        mvc.perform(comToken(put(caminho), proprietario).content(pix("EMAIL", "pix.teste@exemplo.com"))).andExpect(status().isOk());
        mvc.perform(comToken(get(caminho), proprietario)).andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.chaveMascarada").value("p•••@exemplo.com"));
        assertThat(jdbc.sql("SELECT chave_cifrada FROM manobrista_pix WHERE manobrista_id = :id")
                .param("id", manobrista).query(String.class).single()).doesNotContain("pix.teste@exemplo.com");
        assertThat(jdbc.sql("SELECT COUNT(*) FROM manobrista_pix_auditoria WHERE manobrista_id = :id")
                .param("id", manobrista).query(Integer.class).single()).isEqualTo(10);
        mvc.perform(comToken(get(API + "/historico").param("pagina", "-1"), proprietario)).andExpect(status().isBadRequest());
        mvc.perform(comToken(get(API + "/diarias").param("inicio", hoje.toString()).param("fim", hoje.minusDays(1).toString()), proprietario))
                .andExpect(status().isBadRequest());
    }

    @Test
    @org.springframework.transaction.annotation.Transactional
    void fichaAcumulaSomenteDiariasEmAbertoPorManobristaEUnidade() throws Exception {
        long pessoa = criarManobrista("Teste de diárias acumuladas");
        long unidade = criarUnidade();
        long outra = criarUnidade();
        LocalDate ontem = hoje.minusDays(1);
        jdbc.sql("UPDATE controle_diarias_inicio SET data_corte = :data WHERE id = 1").param("data", ontem).update();
        for (LocalDate data : new LocalDate[] { ontem, hoje }) {
            String pendente = ficha(data, unidade, pessoa, 80).replace("\"diaria\"", "\"pagaNaFicha\":false,\"diaria\"");
            mvc.perform(comToken(post("/api/fichas"), proprietario).content(pendente)).andExpect(status().isCreated());
        }
        String paga = ficha(hoje, outra, pessoa, 90)
                .replace("\"diaria\"", "\"pagaNaFicha\":true,\"formaPagamento\":\"PIX\",\"diaria\"");
        mvc.perform(comToken(post("/api/fichas"), proprietario).content(paga)).andExpect(status().isCreated());
        mvc.perform(comToken(get(API + "/resumo").param("manobristaId", Long.toString(pessoa)), proprietario))
                .andExpect(status().isOk()).andExpect(jsonPath("$.aPagar").value(160))
                .andExpect(jsonPath("$.pago").value(90)).andExpect(jsonPath("$.pendencias.length()").value(1))
                .andExpect(jsonPath("$.pendencias[0].diarias").value(2))
                .andExpect(jsonPath("$.pendencias[0].unidadeId").value(unidade))
                .andExpect(jsonPath("$.pendencias[0].saldo").value(160));
    }

    @Test
    void cadastroComPixSalvaAmbosOuRejeitaAmbos() throws Exception {
        String nome = "Cadastro Pix " + UUID.randomUUID();
        String cadastro = "{\"nome\":\"" + nome + "\",\"pix\":" + pix("EMAIL", "invalido") + "}";
        mvc.perform(comToken(post("/api/manobristas"), proprietario).content(cadastro)).andExpect(status().isBadRequest());
        assertThat(jdbc.sql("SELECT COUNT(*) FROM manobrista WHERE nome = :nome").param("nome", nome)
                .query(Long.class).single()).isZero();
        long id = corpo(mvc.perform(comToken(post("/api/manobristas"), proprietario)
                .content(cadastro.replace("invalido", "cadastro@example.org"))).andExpect(status().isCreated())
                .andExpect(jsonPath("$.pix").doesNotExist())).get("id").asLong();
        mvc.perform(comToken(post(API + "/pix/" + id + "/revelar"), proprietario)).andExpect(status().isOk())
                .andExpect(jsonPath("$.chave").value("cadastro@example.org"));
    }

    private int enviarEmParalelo(long manobrista, long diaria, CountDownLatch barreira) throws Exception {
        barreira.countDown();
        if (!barreira.await(5, TimeUnit.SECONDS)) throw new IllegalStateException("As duas requisições não iniciaram.");
        return enviar(confirmacao(UUID.randomUUID(), manobrista, selecionada(diaria, 0), 75, hoje), null)
                .andReturn().getResponse().getStatus();
    }

    private long criarUnidade() throws Exception {
        return corpo(mvc.perform(comToken(post("/api/unidades"), proprietario).content(
                "{\"nome\":\"Unidade teste " + UUID.randomUUID() + "\",\"endereco\":\"Rua de teste\"}"))
                .andExpect(status().isCreated())).get("id").asLong();
    }

    private long criarManobrista(String nome) throws Exception {
        return corpo(mvc.perform(comToken(post("/api/manobristas"), proprietario).content("{\"nome\":\"" + nome + "\"}"))
                .andExpect(status().isCreated())).get("id").asLong();
    }

    private long criarFicha(LocalDate data, long unidade, long manobrista, int custo) throws Exception {
        return corpo(mvc.perform(comToken(post("/api/fichas"), proprietario).content(ficha(data, unidade, manobrista, custo)))
                .andExpect(status().isCreated())).get("id").asLong();
    }

    private long reconhecer(long ficha, long unidade, long manobrista, int custo, int valor) throws Exception {
        return corpo(mvc.perform(comToken(post(API + "/conferencia/" + ficha), proprietario)
                .content(reconhecimento(manobrista, unidade, custo, valor, hoje))).andExpect(status().isOk())).get("id").asLong();
    }

    private static String ficha(LocalDate data, long unidade, long manobrista, int custo) {
        return """
                {"data":"%s","unidadeId":%d,"turno":"dia","fichaInicio":0,"fichaFim":1,"taxaMaquininha":2,
                 "manobristas":[{"manobristaId":%d,"diaria":%d}]}
                """.formatted(data, unidade, manobrista, custo);
    }

    private static String reconhecimento(long manobrista, long unidade, int custo, int valor, LocalDate data) {
        return """
                {"manobristaId":%d,"unidadeConferida":%d,"custoConferido":%d,"valor":%d,"dataConferida":"%s","turnoConferido":"DIA"}
                """.formatted(manobrista, unidade, custo, valor, data);
    }

    private static String selecionada(long id, int revisao) {
        return "{\"id\":%d,\"revisao\":%d}".formatted(id, revisao);
    }

    private static String confirmacao(UUID operacao, long manobrista, String diarias, int valor, LocalDate data) {
        return """
                {"operacao":"%s","manobristaId":%d,"diarias":[%s],"valor":%d,"data":"%s","forma":"PIX","efetuado":true}
                """.formatted(operacao, manobrista, diarias, valor, data);
    }

    private static String pix(String tipo, String chave) {
        return "{\"tipo\":\"%s\",\"chave\":\"%s\"}".formatted(tipo, chave);
    }

    private ResultActions enviar(String dados, byte[] pdf) throws Exception {
        var pedido = multipart(API).file(new MockMultipartFile("dados", "", "application/json", dados.getBytes(StandardCharsets.UTF_8)));
        if (pdf != null) pedido.file(new MockMultipartFile("comprovante", "teste.pdf", "application/pdf", pdf));
        return mvc.perform(pedido.header("Authorization", "Bearer " + proprietario));
    }

    private String token(String email) throws Exception {
        return corpo(mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"identificador\":\"" + email + "\",\"senha\":\"123456\"}"))
                .andExpect(status().isOk())).get("token").asText();
    }

    private static MockHttpServletRequestBuilder comToken(MockHttpServletRequestBuilder pedido, String token) {
        return pedido.header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON);
    }

    private JsonNode corpo(ResultActions result) throws Exception {
        return json.readTree(result.andReturn().getResponse().getContentAsByteArray());
    }
}
