package com.parkflash.web;

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

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.util.Base64;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.hamcrest.Matchers.startsWith;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
@TestPropertySource(properties = "spring.datasource.url=jdbc:h2:mem:parkflash-assinatura;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH")
class AssinaturaFichaIntegracaoTest {

    /** Ficha de demonstração da unidade 1, ainda em edição. */
    private static final String FICHA = "/api/fichas/2";

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

    private static String pngDataUrl() throws Exception {
        var imagem = new BufferedImage(40, 12, BufferedImage.TYPE_INT_ARGB);
        imagem.getGraphics().drawLine(2, 6, 38, 4);
        var saida = new ByteArrayOutputStream();
        ImageIO.write(imagem, "png", saida);
        return "data:image/png;base64," + Base64.getEncoder().encodeToString(saida.toByteArray());
    }

    @Test
    void fechamentoGuardaAAssinaturaDeQuemFechou() throws Exception {
        String dono = login("lucasrodrigues.10@icloud.com");
        mvc.perform(com(get(FICHA + "/assinatura"), dono)).andExpect(status().isNotFound());

        mvc.perform(com(post(FICHA + "/transicao"), dono).content("{\"acao\":\"ENVIAR\"}")).andExpect(status().isOk());
        mvc.perform(com(post(FICHA + "/transicao"), dono)
                        .content("{\"acao\":\"FECHAR\",\"assinatura\":\"" + pngDataUrl() + "\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.situacao").value("FECHADA"));

        mvc.perform(com(get(FICHA + "/assinatura"), dono)).andExpect(status().isOk())
                .andExpect(jsonPath("$.imagem", startsWith("data:image/png;base64,iVBOR")))
                .andExpect(jsonPath("$.autor").value("Lucas"))
                .andExpect(jsonPath("$.assinadoEm").exists());
    }

    @Test
    void reabrirDescartaAAssinaturaAnterior() throws Exception {
        String dono = login("lucasrodrigues.10@icloud.com");
        mvc.perform(com(post(FICHA + "/transicao"), dono).content("{\"acao\":\"ENVIAR\"}")).andExpect(status().isOk());
        mvc.perform(com(post(FICHA + "/transicao"), dono)
                .content("{\"acao\":\"FECHAR\",\"assinatura\":\"" + pngDataUrl() + "\"}")).andExpect(status().isOk());
        mvc.perform(com(post(FICHA + "/transicao"), dono).content("{\"acao\":\"REABRIR\",\"justificativa\":\"Correção\"}"))
                .andExpect(status().isOk());
        mvc.perform(com(get(FICHA + "/assinatura"), dono)).andExpect(status().isNotFound());
        mvc.perform(com(post(FICHA + "/transicao"), dono).content("{\"acao\":\"ENVIAR\"}")).andExpect(status().isOk());
        mvc.perform(com(post(FICHA + "/transicao"), dono).content("{\"acao\":\"FECHAR\"}")).andExpect(status().isOk());
        mvc.perform(com(get(FICHA + "/assinatura"), dono)).andExpect(status().isNotFound());
    }

    @Test
    void recusaAssinaturaQueNaoEPngOuForaDoFechamento() throws Exception {
        String dono = login("lucasrodrigues.10@icloud.com");
        mvc.perform(com(post(FICHA + "/transicao"), dono)
                        .content("{\"acao\":\"ENVIAR\",\"assinatura\":\"" + pngDataUrl() + "\"}"))
                .andExpect(status().isBadRequest());
        mvc.perform(com(post(FICHA + "/transicao"), dono).content("{\"acao\":\"ENVIAR\"}")).andExpect(status().isOk());
        mvc.perform(com(post(FICHA + "/transicao"), dono)
                        .content("{\"acao\":\"FECHAR\",\"assinatura\":\"data:image/png;base64,PGh0bWw+\"}"))
                .andExpect(status().isBadRequest());
        mvc.perform(com(post(FICHA + "/transicao"), dono)
                        .content("{\"acao\":\"FECHAR\",\"assinatura\":\"data:image/svg+xml;base64,PHN2Zz4=\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void socioNaoVeAssinatura() throws Exception {
        mvc.perform(com(get(FICHA + "/assinatura"), login("francisco@email.com"))).andExpect(status().isForbidden());
    }
}
