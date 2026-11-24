package com.parkflash.web;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
@TestPropertySource(properties = "spring.datasource.url=jdbc:h2:mem:parkflash-sociedade;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH")
class SociedadeIntegracaoTest {

    private static final String PROPRIETARIO = "lucasrodrigues.10@icloud.com";
    private static final String GERENTE = "pedro@email.com";
    /** Login de demonstração do sócio Francisco (sócio 1: 40% da unidade 1 e 50% da unidade 2). */
    private static final String SOCIO = "francisco@email.com";

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;

    private String login(String email) throws Exception {
        String corpo = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"identificador\":\"" + email + "\",\"senha\":\"123456\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return json.readTree(corpo).get("token").asText();
    }

    private static MockHttpServletRequestBuilder com(MockHttpServletRequestBuilder req, String token) {
        return req.header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON);
    }

    private JsonNode ler(MockHttpServletRequestBuilder req) throws Exception {
        return json.readTree(mvc.perform(req).andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    }

    @Test
    void socioVeSoAsUnidadesDeleEAParteBateComADivisaoDeLucro() throws Exception {
        JsonNode s = ler(com(get("/api/sociedade?mes=6&ano=2026"), login(SOCIO)));
        assertThat(s.get("socioId").asLong()).isEqualTo(1);
        assertThat(s.get("nome").asText()).isEqualTo("Francisco");
        assertThat(s.get("unidades")).hasSize(2);
        assertThat(s.get("meses")).hasSize(12);

        String dono = login(PROPRIETARIO);
        BigDecimal soma = BigDecimal.ZERO;
        for (JsonNode unidade : s.get("unidades")) {
            JsonNode divisao = ler(com(get("/api/relatorios/divisao-lucro?mes=6&ano=2026&unidadeId=" + unidade.get("unidadeId").asLong()), dono));
            JsonNode parte = null;
            for (JsonNode p : divisao.get("partes")) if (p.get("socioId").asLong() == 1) parte = p;
            assertThat(parte).as("parte do sócio na unidade %s", unidade.get("nome").asText()).isNotNull();
            assertThat(unidade.get("valor").decimalValue()).isEqualByComparingTo(parte.get("valor").decimalValue());
            assertThat(unidade.get("resultado").decimalValue()).isEqualByComparingTo(divisao.get("resultado").decimalValue());
            soma = soma.add(unidade.get("valor").decimalValue());
        }
        assertThat(s.get("totalMes").decimalValue()).isEqualByComparingTo(soma);
        assertThat(s.get("meses").get(5).get("valor").decimalValue()).isEqualByComparingTo(soma);
    }

    @Test
    void socioNaoAcessaAOperacaoNemOsOutrosSocios() throws Exception {
        String socio = login(SOCIO);
        for (String rota : new String[]{"/api/fichas", "/api/unidades", "/api/manobristas", "/api/socios",
                "/api/despesas", "/api/relatorios/resumo?ano=2026", "/api/eventos", "/api/usuarios"}) {
            mvc.perform(com(get(rota), socio)).andExpect(status().isForbidden());
        }
        mvc.perform(com(post("/api/fichas"), socio).content("{}")).andExpect(status().isForbidden());
        mvc.perform(com(post("/api/agenda/link"), socio)).andExpect(status().isForbidden());
        mvc.perform(com(get("/api/sociedade?mes=6&ano=2026&socioId=3"), socio)).andExpect(status().isForbidden());
        // o próprio perfil e a troca de senha continuam liberados
        mvc.perform(com(get("/api/auth/me"), socio)).andExpect(status().isOk())
                .andExpect(jsonPath("$.nivel").value("Sócio")).andExpect(jsonPath("$.socioId").value(1));
    }

    @Test
    void proprietarioVeQualquerSocioEGerenteNao() throws Exception {
        String dono = login(PROPRIETARIO);
        JsonNode s = ler(com(get("/api/sociedade?mes=6&ano=2026&socioId=2"), dono));
        assertThat(s.get("nome").asText()).isEqualTo("Lucas");
        assertThat(s.get("unidades")).hasSize(1);
        mvc.perform(com(get("/api/sociedade?mes=6&ano=2026"), dono)).andExpect(status().isBadRequest());
        mvc.perform(com(get("/api/sociedade?mes=6&ano=2026&socioId=1"), login(GERENTE))).andExpect(status().isForbidden());
    }

    @Test
    void cadastroDoLoginDeSocio() throws Exception {
        String dono = login(PROPRIETARIO);
        String base = """
                {"nome":"Henrique","email":"%s","nivel":"Sócio","senha":"123456","unidadeIds":[1]%s}""";
        mvc.perform(com(post("/api/usuarios"), dono).content(base.formatted("henrique@email.com", "")))
                .andExpect(status().isBadRequest());
        mvc.perform(com(post("/api/usuarios"), dono).content(base.formatted("henrique@email.com", ",\"socioId\":3")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.socioId").value(3))
                .andExpect(jsonPath("$.unidadeIds").isEmpty());
        mvc.perform(com(post("/api/usuarios"), dono).content(base.formatted("outro@email.com", ",\"socioId\":3")))
                .andExpect(status().isConflict());

        JsonNode s = ler(com(get("/api/sociedade?mes=6&ano=2026"), login("henrique@email.com")));
        assertThat(s.get("socioId").asLong()).isEqualTo(3);

        // desativar o login libera o sócio para um login novo
        JsonNode lista = json.readTree(mvc.perform(com(get("/api/usuarios"), dono)).andReturn().getResponse().getContentAsString());
        long henrique = 0;
        for (JsonNode u : lista) if (u.get("email").asText().equals("henrique@email.com")) henrique = u.get("id").asLong();
        mvc.perform(com(delete("/api/usuarios/" + henrique), dono)).andExpect(status().isNoContent());
        mvc.perform(com(post("/api/usuarios"), dono).content(base.formatted("henrique2@email.com", ",\"socioId\":3")))
                .andExpect(status().isCreated());
    }

    @Test
    void mesesFuturosFicamVazios() throws Exception {
        JsonNode s = ler(com(get("/api/sociedade?mes=1&ano=2099"), login(SOCIO)));
        assertThat(s.get("meses").get(11).get("valor").isNull()).isTrue();
    }
}
