package com.parkflash.web;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.parkflash.repositorio.UsuarioRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
@TestPropertySource(properties = "spring.datasource.url=jdbc:h2:mem:parkflash-calendario;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH")
class CalendarioIntegracaoTest {

    private static final String PROPRIETARIO = "lucasrodrigues.10@icloud.com";
    private static final String GERENTE = "pedro@email.com";
    private static final String OPERADOR = "dario@email.com";

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;
    @Autowired private UsuarioRepository usuarios;

    private String login(String email) throws Exception {
        String corpo = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"identificador\":\"" + email + "\",\"senha\":\"123456\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return json.readTree(corpo).get("token").asText();
    }

    private static MockHttpServletRequestBuilder com(MockHttpServletRequestBuilder req, String token) {
        return req.header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON);
    }

    private String gerarLink(String sessao) throws Exception {
        String corpo = mvc.perform(com(post("/api/agenda/link"), sessao))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return json.readTree(corpo).get("token").asText();
    }

    private String ics(String token) throws Exception {
        return mvc.perform(get("/api/agenda/" + token + ".ics"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith("text/calendar"))
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
    }

    private void criarEvento(String sessao, long unidade, String nome, String situacao) throws Exception {
        LocalDate dia = LocalDate.now().plusDays(5);
        mvc.perform(com(post("/api/eventos"), sessao).content("""
                {"unidadeId":%d,"nome":"%s","contratante":"Buffet Alfa, Ltda","local":"Rua A; 10",
                 "inicio":"%sT18:00:00","fim":"%sT23:30:00","veiculosPrevistos":120,"capacidade":150,
                 "equipePrevista":6,"responsavel":"Pedro","valorContratado":3000,"despesasPrevistas":400,
                 "situacao":"%s","observacoes":"Entrada pelo portão 2\\nLevar cones"}
                """.formatted(unidade, nome, dia, dia, situacao))).andExpect(status().isCreated());
    }

    @Test
    void geraLinkQueOGoogleConsegueLerSemLogin() throws Exception {
        String sessao = login(PROPRIETARIO);
        criarEvento(sessao, 1, "Casamento Silva", "CONFIRMADO");

        String token = gerarLink(sessao);
        assertThat(token).hasSizeGreaterThanOrEqualTo(40);

        String cal = ics(token);
        assertThat(cal).startsWith("BEGIN:VCALENDAR\r\n").endsWith("END:VCALENDAR\r\n")
                .contains("X-WR-CALNAME:Park Flash")
                .contains("SUMMARY:Evento: Casamento Silva")
                .contains("STATUS:CONFIRMED")
                // vírgula, ponto e vírgula e quebra de linha escapados (RFC 5545)
                .contains("LOCATION:Rua A\\; 10")
                .contains("Buffet Alfa\\, Ltda");
        // 18:00 em São Paulo = 21:00 UTC
        assertThat(cal).containsPattern("DTSTART:\\d{8}T210000Z");
        // nenhuma linha passa de 75 bytes
        for (String linha : cal.split("\r\n")) {
            assertThat(linha.getBytes(StandardCharsets.UTF_8).length).isLessThanOrEqualTo(75);
        }

        mvc.perform(com(get("/api/agenda/link"), sessao)).andExpect(status().isOk())
                .andExpect(jsonPath("$.ativo").value(true));
    }

    @Test
    void canceladoNaoApareceEPlanejadoFicaProvisorio() throws Exception {
        String sessao = login(PROPRIETARIO);
        criarEvento(sessao, 1, "Festa Planejada", "PLANEJADO");
        criarEvento(sessao, 1, "Festa Cancelada", "CANCELADO");

        String cal = ics(gerarLink(sessao));
        assertThat(cal).contains("SUMMARY:Evento: Festa Planejada").contains("STATUS:TENTATIVE")
                .doesNotContain("Festa Cancelada");
    }

    @Test
    void gerenteSoVeAsUnidadesDele() throws Exception {
        var gerente = usuarios.findById(2L).orElseThrow();
        gerente.definirUnidades(Set.of(1L));
        usuarios.flush();

        String dono = login(PROPRIETARIO);
        criarEvento(dono, 1, "Evento Optum", "CONFIRMADO");
        criarEvento(dono, 2, "Evento Manifesto", "CONFIRMADO");

        String cal = ics(gerarLink(login(GERENTE)));
        assertThat(cal).contains("Evento Optum").doesNotContain("Evento Manifesto");
    }

    @Test
    void novoLinkOuRevogacaoDerrubaOAnterior() throws Exception {
        String sessao = login(PROPRIETARIO);
        String primeiro = gerarLink(sessao);
        String segundo = gerarLink(sessao);

        mvc.perform(get("/api/agenda/" + primeiro + ".ics")).andExpect(status().isNotFound());
        ics(segundo);

        mvc.perform(com(delete("/api/agenda/link"), sessao)).andExpect(status().isNoContent());
        mvc.perform(get("/api/agenda/" + segundo + ".ics")).andExpect(status().isNotFound());
        mvc.perform(com(get("/api/agenda/link"), sessao)).andExpect(jsonPath("$.ativo").value(false));
    }

    @Test
    void linkParaDeFuncionarSeOUsuarioPerdeAcesso() throws Exception {
        String token = gerarLink(login(GERENTE));
        var gerente = usuarios.findById(2L).orElseThrow();
        gerente.desativar();
        usuarios.flush();

        mvc.perform(get("/api/agenda/" + token + ".ics")).andExpect(status().isNotFound());
    }

    @Test
    void operadorESemLoginNaoGeramLink() throws Exception {
        mvc.perform(com(post("/api/agenda/link"), login(OPERADOR))).andExpect(status().isForbidden());
        mvc.perform(post("/api/agenda/link")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/agenda/" + "x".repeat(43) + ".ics")).andExpect(status().isNotFound());
    }
}
