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
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
@TestPropertySource(properties = "spring.datasource.url=jdbc:h2:mem:parkflash-divisao-todas;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH")
class DivisaoTodasIntegracaoTest {

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;

    private String login(String email) throws Exception {
        String corpo = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"identificador\":\"" + email + "\",\"senha\":\"123456\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return json.readTree(corpo).get("token").asText();
    }

    private JsonNode divisao(String token, String unidade) throws Exception {
        String corpo = mvc.perform(get("/api/relatorios/divisao-lucro?mes=6&ano=2026" + unidade)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return json.readTree(corpo);
    }

    @Test
    void todasAsUnidadesSomaAParteDeCadaSocio() throws Exception {
        String dono = login("lucasrodrigues.10@icloud.com");
        Map<Long, BigDecimal> esperado = new HashMap<>();
        BigDecimal resultados = BigDecimal.ZERO;
        for (int unidade = 1; unidade <= 3; unidade++) {
            JsonNode d = divisao(dono, "&unidadeId=" + unidade);
            resultados = resultados.add(d.get("resultado").decimalValue());
            for (JsonNode p : d.get("partes")) esperado.merge(p.get("socioId").asLong(), p.get("valor").decimalValue(), BigDecimal::add);
        }

        JsonNode todas = divisao(dono, "");
        assertThat(todas.get("unidadeId").isNull()).isTrue();
        assertThat(todas.get("resultado").decimalValue()).isEqualByComparingTo(resultados);
        assertThat(todas.get("partes")).hasSize(esperado.size());
        BigDecimal percentuais = BigDecimal.ZERO;
        for (JsonNode p : todas.get("partes")) {
            assertThat(p.get("valor").decimalValue()).as("sócio %s", p.get("nome").asText())
                    .isEqualByComparingTo(esperado.get(p.get("socioId").asLong()));
            percentuais = percentuais.add(p.get("percentual").decimalValue());
        }
        assertThat(percentuais.doubleValue()).isBetween(99.9, 100.1);
        assertThat(todas.get("unidadesSemRateio").isArray()).isTrue();
    }

    @Test
    void gerenteNaoVeDivisao() throws Exception {
        mvc.perform(get("/api/relatorios/divisao-lucro?mes=6&ano=2026").header("Authorization", "Bearer " + login("pedro@email.com")))
                .andExpect(status().isForbidden());
    }
}
