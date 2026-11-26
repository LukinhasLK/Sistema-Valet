package com.parkflash.web;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.parkflash.servico.PagamentoManobristaService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Pacote 1 da revisão: diária sem teto, diária do operador, anulação, ficha cancelada e divisão só com fichas fechadas. */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
@TestPropertySource(properties = "spring.datasource.url=jdbc:h2:mem:parkflash-correcoes;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH")
class CorrecoesDinheiroIntegracaoTest {

    private static final String API = "/api/pagamentos-manobristas";
    private final LocalDate hoje = LocalDate.now(PagamentoManobristaService.FUSO_NEGOCIO);

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;
    @Autowired private JdbcClient jdbc;

    private String login(String email) throws Exception {
        String corpo = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"identificador\":\"" + email + "\",\"senha\":\"123456\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return json.readTree(corpo).get("token").asText();
    }

    private static MockHttpServletRequestBuilder com(MockHttpServletRequestBuilder req, String token) {
        return req.header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON);
    }

    private JsonNode corpo(ResultActions r) throws Exception {
        return json.readTree(r.andReturn().getResponse().getContentAsString());
    }

    private long criar(String rota, String corpo, String token) throws Exception {
        return corpo(mvc.perform(com(post(rota), token).content(corpo)).andExpect(status().isCreated())).get("id").asLong();
    }

    private static String ficha(LocalDate data, long unidade, long manobrista, String diaria, String extra) {
        return """
                {"data":"%s","unidadeId":%d,"turno":"noite","fichaInicio":0,"fichaFim":10,"taxaMaquininha":2,
                 "valorDinheiro":500,"manobristas":[{"manobristaId":%d,%s"diaria":%s}]}
                """.formatted(data, unidade, manobrista, extra, diaria);
    }

    private long novaUnidade(String dono) throws Exception {
        return criar("/api/unidades", "{\"nome\":\"Unidade " + UUID.randomUUID() + "\",\"endereco\":\"Rua\"}", dono);
    }

    private long novoManobrista(String dono) throws Exception {
        return criar("/api/manobristas", "{\"nome\":\"Manobrista " + UUID.randomUUID() + "\"}", dono);
    }

    private long diariasDaFicha(long ficha) {
        return jdbc.sql("SELECT COUNT(*) FROM diaria_a_pagar WHERE ficha_id = :id").param("id", ficha).query(Long.class).single();
    }

    @Test
    void diariaAcimaDoTetoERecusada() throws Exception {
        String dono = login("lucasrodrigues.10@icloud.com");
        long unidade = novaUnidade(dono);
        long pessoa = novoManobrista(dono);
        mvc.perform(com(post("/api/fichas"), dono).content(ficha(hoje, unidade, pessoa, "4999999.99", "")))
                .andExpect(status().isBadRequest());
        mvc.perform(com(post("/api/fichas"), dono).content(ficha(hoje, unidade, pessoa, "10000.01", "")))
                .andExpect(status().isBadRequest());
        mvc.perform(com(post("/api/fichas"), dono).content(ficha(hoje, unidade, pessoa, "10000.00", "")))
                .andExpect(status().isCreated());
    }

    @Test
    void operadorNaoCriaDividaEAGestaoReconheceDepois() throws Exception {
        String dono = login("lucasrodrigues.10@icloud.com");
        long unidade = novaUnidade(dono);
        long pessoa = novoManobrista(dono);
        jdbc.sql("INSERT INTO usuario_unidade (usuario_id, unidade_id) VALUES (3, :u)").param("u", unidade).update();
        String operador = login("dario@email.com");

        long ficha = criar("/api/fichas", ficha(hoje, unidade, pessoa, "120", "\"pagaNaFicha\":false,"), operador);
        assertThat(diariasDaFicha(ficha)).as("o operador não cria dívida").isZero();

        // a diária aparece na conferência da gestão, que reconhece com o valor certo
        mvc.perform(com(get(API + "/conferencia").param("manobristaId", Long.toString(pessoa)), dono))
                .andExpect(status().isOk()).andExpect(jsonPath("$.itens[0].fichaId").value(ficha));
        assertThat(diariasDaFicha(ficha)).isZero();
    }

    @Test
    void gestaoAnulaDiariaErradaEAFichaVoltaASerCorrigivel() throws Exception {
        String dono = login("lucasrodrigues.10@icloud.com");
        long unidade = novaUnidade(dono);
        long pessoa = novoManobrista(dono);
        long ficha = criar("/api/fichas", ficha(hoje, unidade, pessoa, "900", "\"pagaNaFicha\":false,"), dono);
        long diaria = jdbc.sql("SELECT id FROM diaria_a_pagar WHERE ficha_id = :id").param("id", ficha).query(Long.class).single();

        // antes de anular, a ficha não pode ser cancelada
        mvc.perform(com(delete("/api/fichas/" + ficha), dono)).andExpect(status().isConflict());

        mvc.perform(com(post(API + "/diarias/" + diaria + "/anulacao"), dono).content("{\"motivo\":\"\"}"))
                .andExpect(status().isBadRequest());
        mvc.perform(com(post(API + "/diarias/" + diaria + "/anulacao"), login("dario@email.com")).content("{\"motivo\":\"x\"}"))
                .andExpect(status().isForbidden());
        mvc.perform(com(post(API + "/diarias/" + diaria + "/anulacao"), dono).content("{\"motivo\":\"Valor digitado errado\"}"))
                .andExpect(status().isNoContent());

        assertThat(diariasDaFicha(ficha)).isZero();
        assertThat(jdbc.sql("SELECT motivo FROM diaria_anulacao WHERE diaria_id = :id").param("id", diaria)
                .query(String.class).single()).isEqualTo("Valor digitado errado");
        mvc.perform(com(delete("/api/fichas/" + ficha), dono)).andExpect(status().isNoContent());
    }

    @Test
    void diariaJaPagaNaoPodeSerAnulada() throws Exception {
        String dono = login("lucasrodrigues.10@icloud.com");
        long unidade = novaUnidade(dono);
        long pessoa = novoManobrista(dono);
        long ficha = criar("/api/fichas", ficha(hoje, unidade, pessoa, "80", "\"pagaNaFicha\":true,\"formaPagamento\":\"PIX\","), dono);
        long diaria = jdbc.sql("SELECT id FROM diaria_a_pagar WHERE ficha_id = :id").param("id", ficha).query(Long.class).single();
        mvc.perform(com(post(API + "/diarias/" + diaria + "/anulacao"), dono).content("{\"motivo\":\"teste\"}"))
                .andExpect(status().isConflict());
        assertThat(diariasDaFicha(ficha)).isOne();
    }

    @Test
    void fichaCanceladaLiberaOTurno() throws Exception {
        String dono = login("lucasrodrigues.10@icloud.com");
        long unidade = novaUnidade(dono);
        long pessoa = novoManobrista(dono);
        long primeira = criar("/api/fichas", ficha(hoje, unidade, pessoa, "0", ""), dono);
        mvc.perform(com(post("/api/fichas"), dono).content(ficha(hoje, unidade, pessoa, "0", ""))).andExpect(status().isConflict());

        mvc.perform(com(delete("/api/fichas/" + primeira), dono)).andExpect(status().isNoContent());
        long segunda = criar("/api/fichas", ficha(hoje, unidade, pessoa, "0", ""), dono);
        assertThat(segunda).isNotEqualTo(primeira);

        // continua proibido ter duas fichas válidas no mesmo turno
        mvc.perform(com(post("/api/fichas"), dono).content(ficha(hoje, unidade, pessoa, "0", ""))).andExpect(status().isConflict());
        // e cancelar mais de uma vez o mesmo turno também funciona
        mvc.perform(com(delete("/api/fichas/" + segunda), dono)).andExpect(status().isNoContent());
        criar("/api/fichas", ficha(hoje, unidade, pessoa, "0", ""), dono);
    }

    @Test
    void divisaoContaSoFichasFechadasEAvisaAsAbertas() throws Exception {
        String dono = login("lucasrodrigues.10@icloud.com");
        long unidade = novaUnidade(dono);
        long pessoa = novoManobrista(dono);
        LocalDate dia1 = LocalDate.of(2031, 3, 10);
        long fechada = criar("/api/fichas", ficha(dia1, unidade, pessoa, "0", ""), dono);
        criar("/api/fichas", ficha(dia1.plusDays(1), unidade, pessoa, "0", ""), dono);
        for (String acao : new String[]{"ENVIAR", "FECHAR"}) {
            mvc.perform(com(post("/api/fichas/" + fechada + "/transicao"), dono).content("{\"acao\":\"" + acao + "\"}"))
                    .andExpect(status().isOk());
        }
        JsonNode umaFicha = corpo(mvc.perform(com(get("/api/fichas/" + fechada), dono)).andExpect(status().isOk()));

        JsonNode divisao = corpo(mvc.perform(com(get("/api/relatorios/divisao-lucro?mes=3&ano=2031&unidadeId=" + unidade), dono))
                .andExpect(status().isOk()));
        assertThat(divisao.get("quantidadeFichas").asInt()).isEqualTo(1);
        assertThat(divisao.get("fichasAbertas").asInt()).isEqualTo(1);
        assertThat(divisao.get("lucroFichas").decimalValue()).isEqualByComparingTo(umaFicha.get("totalLiquido").decimalValue());

        // o resumo do relatório continua mostrando o mês inteiro
        mvc.perform(com(get("/api/relatorios/resumo?mes=3&ano=2031&unidadeId=" + unidade), dono))
                .andExpect(status().isOk()).andExpect(jsonPath("$.quantidadeFichas").value(2));
    }
}
