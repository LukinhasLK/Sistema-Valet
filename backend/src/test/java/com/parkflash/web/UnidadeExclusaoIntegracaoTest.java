package com.parkflash.web;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
@TestPropertySource(properties = "spring.datasource.url=jdbc:h2:mem:parkflash-unidade-exclusao;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH")
class UnidadeExclusaoIntegracaoTest {

    private static final String PROPRIETARIO = "lucasrodrigues.10@icloud.com";
    private static final String GERENTE = "pedro@email.com";

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

    private long criarUnidade(String dono, String nome) throws Exception {
        String corpo = mvc.perform(com(post("/api/unidades"), dono)
                        .content("{\"nome\":\"" + nome + "\",\"endereco\":\"Rua X, 1\",\"telefone\":null}"))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return json.readTree(corpo).get("id").asLong();
    }

    private long contar(String tabela, String coluna, long id) {
        return jdbc.sql("SELECT COUNT(*) FROM " + tabela + " WHERE " + coluna + " = :id").param("id", id).query(Long.class).single();
    }

    @Test
    void excluiUnidadeVaziaERemoveConfiguracaoJunto() throws Exception {
        String dono = login(PROPRIETARIO);
        long id = criarUnidade(dono, "Unidade Temporária");
        jdbc.sql("INSERT INTO usuario_unidade (usuario_id, unidade_id) SELECT id, :u FROM usuario WHERE email = :e")
                .param("u", id).param("e", GERENTE).update();

        mvc.perform(com(delete("/api/unidades/" + id + "/definitivo"), dono)).andExpect(status().isNoContent());

        assertThat(contar("unidade", "id", id)).isZero();
        assertThat(contar("usuario_unidade", "unidade_id", id)).isZero();
        assertThat(contar("auditoria_administrativa", "recurso_id", id)).isPositive();
    }

    @Test
    void recusaComVinculosComMensagemEContagem() throws Exception {
        String dono = login(PROPRIETARIO);
        long id = criarUnidade(dono, "Unidade Com Despesa");
        jdbc.sql("INSERT INTO despesa (data, unidade_id, categoria, descricao, valor) VALUES (CURRENT_DATE, :u, 'OUTROS', 'Teste', 10)")
                .param("u", id).update();

        mvc.perform(com(delete("/api/unidades/" + id + "/definitivo"), dono))
                .andExpect(status().isConflict())
                .andExpect(content().string(org.hamcrest.Matchers.containsString("1 despesa.")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("desative a unidade")));
        assertThat(contar("unidade", "id", id)).isEqualTo(1);

        mvc.perform(com(delete("/api/unidades/1/definitivo"), dono))
                .andExpect(status().isConflict())
                .andExpect(content().string(org.hamcrest.Matchers.containsString("fichas")));
    }

    @Test
    void somenteProprietarioExclui() throws Exception {
        String dono = login(PROPRIETARIO);
        long id = criarUnidade(dono, "Unidade Protegida");
        mvc.perform(com(delete("/api/unidades/" + id + "/definitivo"), login(GERENTE))).andExpect(status().isForbidden());
        assertThat(contar("unidade", "id", id)).isEqualTo(1);
    }
}
