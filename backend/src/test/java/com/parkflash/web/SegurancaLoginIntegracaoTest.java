package com.parkflash.web;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Pacote 2 da revisão: bloqueio de login, senha mínima, "sair de todos" e link de agenda ligado à sessão. */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
@TestPropertySource(properties = "spring.datasource.url=jdbc:h2:mem:parkflash-seguranca-login;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH")
class SegurancaLoginIntegracaoTest {

    private static final String GERENTE = "pedro@email.com";

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;

    private ResultActions tentar(String identificador, String senha) throws Exception {
        return mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"identificador\":\"" + identificador + "\",\"senha\":\"" + senha + "\"}"));
    }

    private String login(String email) throws Exception {
        return json.readTree(tentar(email, "123456").andExpect(status().isOk()).andReturn().getResponse()
                .getContentAsString()).get("token").asText();
    }

    private static MockHttpServletRequestBuilder com(MockHttpServletRequestBuilder req, String token) {
        return req.header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON);
    }

    @Test
    void cincoSenhasErradasBloqueiamAContaPorUmTempo() throws Exception {
        for (int i = 0; i < 5; i++) tentar(GERENTE, "errada").andExpect(status().isUnauthorized());
        // bloqueada: nem a senha certa entra
        tentar(GERENTE, "123456").andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.mensagem", containsString("Tente de novo")));
        // outra conta segue normal
        login("lucasrodrigues.10@icloud.com");
    }

    @Test
    void contaInexistenteTambemBloqueiaSemRevelarQueNaoExiste() throws Exception {
        for (int i = 0; i < 5; i++) {
            tentar("ninguem@exemplo.test", "x").andExpect(status().isUnauthorized())
                    .andExpect(jsonPath("$.mensagem").value("E-mail/usuário ou senha incorretos."));
        }
        tentar("ninguem@exemplo.test", "x").andExpect(status().isTooManyRequests());
    }

    @Test
    void acertarASenhaZeraAsFalhas() throws Exception {
        for (int i = 0; i < 4; i++) tentar(GERENTE, "errada").andExpect(status().isUnauthorized());
        login(GERENTE);
        for (int i = 0; i < 4; i++) tentar(GERENTE, "errada").andExpect(status().isUnauthorized());
        login(GERENTE);
    }

    @Test
    void senhaNovaPrecisaDeDezCaracteres() throws Exception {
        String token = login(GERENTE);
        mvc.perform(com(put("/api/auth/senha"), token).content("{\"senhaAtual\":\"123456\",\"novaSenha\":\"curta123\"}"))
                .andExpect(status().isBadRequest());
        mvc.perform(com(put("/api/auth/senha"), token).content("{\"senhaAtual\":\"123456\",\"novaSenha\":\"" + "a".repeat(73) + "\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void sairDeTodosDerrubaOsLoginsEOLinkDaAgenda() throws Exception {
        String aparelho1 = login(GERENTE);
        String aparelho2 = login(GERENTE);
        String link = json.readTree(mvc.perform(com(post("/api/agenda/link"), aparelho1)).andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString()).get("token").asText();
        mvc.perform(get("/api/agenda/" + link + ".ics")).andExpect(status().isOk());

        mvc.perform(com(post("/api/auth/sair-de-todos"), aparelho1)).andExpect(status().isNoContent());

        mvc.perform(com(get("/api/auth/me"), aparelho1)).andExpect(status().isUnauthorized());
        mvc.perform(com(get("/api/auth/me"), aparelho2)).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/agenda/" + link + ".ics")).andExpect(status().isNotFound());
    }

    @Test
    void trocarASenhaDerrubaOLinkDaAgenda() throws Exception {
        String token = login(GERENTE);
        String link = json.readTree(mvc.perform(com(post("/api/agenda/link"), token)).andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString()).get("token").asText();
        mvc.perform(com(put("/api/auth/senha"), token).content("{\"senhaAtual\":\"123456\",\"novaSenha\":\"uma-senha-nova-longa\"}"))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/agenda/" + link + ".ics")).andExpect(status().isNotFound());
    }

    @Test
    void entradaGrandeDemaisERecusada() throws Exception {
        tentar("a".repeat(151), "x").andExpect(status().isBadRequest());
        tentar(GERENTE, "a".repeat(73)).andExpect(status().isBadRequest());
    }
}
