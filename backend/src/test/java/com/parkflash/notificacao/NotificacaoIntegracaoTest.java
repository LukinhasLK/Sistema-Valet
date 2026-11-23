package com.parkflash.notificacao;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.parkflash.repositorio.UsuarioRepository;
import com.parkflash.servico.PagamentoManobristaService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {
        "spring.datasource.url=${PARKFLASH_NOTIF_TEST_DB_URL:jdbc:h2:mem:parkflash-notif;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH}",
        "spring.datasource.username=${PARKFLASH_NOTIF_TEST_DB_USER:sa}",
        "spring.datasource.password=${PARKFLASH_NOTIF_TEST_DB_PASSWORD:}",
        "parkflash.notificacoes.processar=false",
        "parkflash.push.enviar=true"
})
@AutoConfigureMockMvc
@Transactional
class NotificacaoIntegracaoTest {
    private static final String API = "/api/notificacoes";
    private static final String DONO = "lucasrodrigues.10@icloud.com";
    private static final String GERENTE = "pedro@email.com";
    private static final String OPERADOR = "dario@email.com";
    private static final String ENDPOINT = "https://fcm.googleapis.com/fcm/send/ensaio-local";

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired FilaNotificacoes fila;
    @Autowired CaixaNotificacoes caixa;
    @Autowired EventosNotificacao eventos;
    @Autowired LembretesEventos lembretes;
    @Autowired UsuarioRepository usuarios;
    @Autowired JdbcClient jdbc;
    @MockitoBean TransportePush transporte;

    @Test
    void persisteOsEventosDeFichaEObrigacaoRespeitandoEscopoEPreferencia() throws Exception {
        vincular(2, 1L);
        String dono = token(DONO);
        String gerente = token(GERENTE);
        String operador = token(OPERADOR);
        mvc.perform(auth(get(API), operador)).andExpect(status().isForbidden());
        mvc.perform(auth(put(API + "/preferencias/FICHA_CRIADA"), gerente).content("{\"ativa\":false}"))
                .andExpect(status().isNoContent());

        long id = ficha(dono, 1, "dia", ",\"pagaNaFicha\":false");
        ficha(dono, 2, "dia", "");
        mvc.perform(auth(post("/api/fichas/" + id + "/transicao"), dono).content("{\"acao\":\"ENVIAR\"}"))
                .andExpect(status().isOk());
        for (int i = 0; i < 2; i++) {
            mvc.perform(auth(post(API + "/divergencias/" + id), gerente).content("{\"motivo\":\"Conferir caixa\"}"))
                    .andExpect(status().isNoContent());
        }
        eventos.registrar(CategoriaNotificacao.FICHA_CRIADA, id, 1);
        assertThat(fila.distribuir()).isEqualTo(5);
        assertThat(fila.distribuir()).isZero();

        mvc.perform(auth(get(API + "/pendentes"), dono)).andExpect(jsonPath("$.total").value(5));
        mvc.perform(auth(get(API + "?naoLidas=true"), gerente))
                .andExpect(jsonPath("$.length()").value(3))
                .andExpect(jsonPath("$[*].destinoId", everyItem(is((int) id))))
                .andExpect(jsonPath("$[*].categoria", containsInAnyOrder(
                        "FICHA_AGUARDANDO_FECHAMENTO", "PAGAMENTO_PENDENTE", "DIVERGENCIA_FINANCEIRA")));
        var caixaDono = caixa.listar(1, null, true);
        mvc.perform(auth(put(API + "/" + caixaDono.get(0).id() + "/leitura"), gerente))
                .andExpect(status().isNotFound());
        long alerta = caixa.listar(2, null, true).get(0).id();
        mvc.perform(auth(put(API + "/" + alerta + "/leitura"), gerente)).andExpect(status().isNoContent());
        mvc.perform(auth(get(API + "/pendentes"), gerente)).andExpect(jsonPath("$.total").value(2));
        mvc.perform(auth(put(API + "/leitura"), gerente)).andExpect(status().isNoContent());
        mvc.perform(auth(get(API + "?naoLidas=true"), gerente)).andExpect(jsonPath("$.length()").value(0));

        vincular(2, 2L);
        mvc.perform(auth(get(API), gerente)).andExpect(jsonPath("$.length()").value(0));
        verifyNoInteractions(transporte);
    }

    @Test
    void reconhecimentoJaPagoNaMesmaFichaSoGeraAlertaDeConfirmacao() throws Exception {
        String dono = token(DONO);
        ficha(dono, 1, "noite", ",\"pagaNaFicha\":true,\"formaPagamento\":\"PIX\"");
        fila.distribuir();
        mvc.perform(auth(get(API), dono)).andExpect(jsonPath("$[*].categoria", containsInAnyOrder(
                "FICHA_CRIADA", "PAGAMENTO_CONFIRMADO")));
    }

    @Test
    void testePushUsaSomenteODispositivoDaContaEPreservaACentral() throws Exception {
        String dono = token(DONO);
        String gerente = token(GERENTE);
        String operador = token(OPERADOR);
        var dispositivo = UUID.randomUUID();
        var outro = UUID.randomUUID();
        when(transporte.configurado()).thenReturn(true);
        when(transporte.chavePublica()).thenReturn("chave-teste");
        when(transporte.enviarTeste(ENDPOINT)).thenReturn(201, 410);
        inscrever(dono, dispositivo, ENDPOINT);
        inscrever(dono, outro, "https://fcm.googleapis.com/fcm/send/outro");
        String url = API + "/push/" + dispositivo + "/teste";
        mvc.perform(auth(post(url), operador)).andExpect(status().isForbidden());
        mvc.perform(auth(post(url), gerente)).andExpect(status().isConflict());
        mvc.perform(auth(post(url), dono)).andExpect(status().isOk())
                .andExpect(jsonPath("$.estado").value("ACEITA")).andExpect(jsonPath("$.codigo").value(201));
        mvc.perform(auth(post(API + "/push/" + outro + "/teste"), dono)).andExpect(status().isConflict());
        assertThat(caixa.pendentes(1)).isZero();
        jdbc.sql("UPDATE push_teste_usuario SET tentado_em = :anterior WHERE usuario_id = 1")
                .param("anterior", FilaNotificacoes.agora().minusMinutes(1)).update();
        mvc.perform(auth(post(url), dono)).andExpect(status().isOk())
                .andExpect(jsonPath("$.estado").value("EXPIRADA"));
        mvc.perform(auth(get(API + "/push?dispositivo=" + dispositivo), dono)).andExpect(jsonPath("$.inscrito").value(false));
        mvc.perform(auth(get(API + "/push?dispositivo=" + outro), dono)).andExpect(jsonPath("$.inscrito").value(true));
        verify(transporte, times(2)).enviarTeste(ENDPOINT);
    }

    @Test
    void inscrevePorContaEDispositivoERejeitaEnderecoNaoPermitido() throws Exception {
        String dono = token(DONO);
        String gerente = token(GERENTE);
        var dispositivo = UUID.randomUUID();
        when(transporte.configurado()).thenReturn(true);
        when(transporte.chavePublica()).thenReturn("chave-teste");
        mvc.perform(auth(put(API + "/push/" + dispositivo), dono)
                        .content("{\"endpoint\":\"https://example.test/notificacao\",\"chavePublica\":\"chave-teste\"}"))
                .andExpect(status().isBadRequest());
        inscrever(dono, dispositivo, ENDPOINT);
        inscrever(dono, dispositivo, ENDPOINT);
        mvc.perform(auth(get(API + "/push?dispositivo=" + dispositivo), dono)).andExpect(jsonPath("$.inscrito").value(true));
        mvc.perform(auth(get(API + "/push?dispositivo=" + dispositivo), gerente)).andExpect(jsonPath("$.inscrito").value(false));
        mvc.perform(auth(put(API + "/push/" + UUID.randomUUID()), gerente)
                        .content("{\"endpoint\":\"" + ENDPOINT + "\",\"chavePublica\":\"chave-teste\"}"))
                .andExpect(status().isConflict());
        mvc.perform(auth(delete(API + "/push/" + dispositivo), gerente)).andExpect(status().isNoContent());
        mvc.perform(auth(get(API + "/push?dispositivo=" + dispositivo), dono)).andExpect(jsonPath("$.inscrito").value(true));
    }

    @Test
    void falhasDoProvedorNaoImpedemOperacaoRetentaEEspiraInscricao() throws Exception {
        String dono = token(DONO);
        var dispositivo = UUID.randomUUID();
        when(transporte.configurado()).thenReturn(true);
        when(transporte.chavePublica()).thenReturn("chave-teste");
        when(transporte.enviar(ENDPOINT)).thenReturn(429, 410);
        inscrever(dono, dispositivo, ENDPOINT);

        ficha(dono, 1, "dia", "");
        verify(transporte, never()).enviar(anyString());
        fila.distribuir();
        var jobs = new ProcessadorNotificacoes(fila, transporte, lembretes, true);
        jobs.entregar();
        mvc.perform(auth(get(API + "/push/diagnostico"), dono))
                .andExpect(jsonPath("$[0].estado").value("PENDENTE"))
                .andExpect(jsonPath("$[0].codigo").value("HTTP_429"));
        jobs.entregar();
        verify(transporte, times(1)).enviar(ENDPOINT);
        jdbc.sql("UPDATE push_entrega SET tentar_em = CURRENT_TIMESTAMP").update();
        jobs.entregar();
        mvc.perform(auth(get(API + "/push/diagnostico"), dono))
                .andExpect(jsonPath("$[0].estado").value("EXPIRADA"))
                .andExpect(jsonPath("$[0].tentativas").value(2));
        mvc.perform(auth(get(API + "/push?dispositivo=" + dispositivo), dono))
                .andExpect(jsonPath("$.inscrito").value(false));
        assertThat(caixa.pendentes(1)).isEqualTo(1);
    }

    @Test
    void paraDepoisDeQuatroTentativasERespeitaPermissaoRevogadaAntesDoEnvio() throws Exception {
        when(transporte.configurado()).thenReturn(true);
        when(transporte.chavePublica()).thenReturn("chave-teste");
        when(transporte.enviar(ENDPOINT)).thenReturn(503);
        String gerente = token(GERENTE);
        vincular(2, 1L);
        inscrever(gerente, UUID.randomUUID(), ENDPOINT);
        eventos.registrar(CategoriaNotificacao.FICHA_CRIADA, 100, 1);
        fila.distribuir();
        var jobs = new ProcessadorNotificacoes(fila, transporte, lembretes, true);
        for (int i = 0; i < 5; i++) {
            jdbc.sql("UPDATE push_entrega SET tentar_em = CURRENT_TIMESTAMP").update();
            jobs.entregar();
        }
        verify(transporte, times(4)).enviar(ENDPOINT);
        assertThat(jdbc.sql("SELECT estado FROM push_entrega").query(String.class).single()).isEqualTo("FALHOU");

        eventos.registrar(CategoriaNotificacao.PAGAMENTO_CONFIRMADO, "100", 100, null, List.of(1L, 2L));
        fila.distribuir();
        assertThat(caixa.listar(2, null, false)).hasSize(1);

        eventos.registrar(CategoriaNotificacao.ESCALA_ALTERADA, 101, 1);
        fila.distribuir();
        vincular(2, 2L);
        jobs.entregar();
        assertThat(jdbc.sql("SELECT estado FROM push_entrega ORDER BY id DESC LIMIT 1").query(String.class).single()).isEqualTo("CANCELADA");
        verify(transporte, times(4)).enviar(ENDPOINT);
    }

    @Test
    void geraLembreteUnicoEAbreEventoEScalaComEscopo() throws Exception {
        String dono = token(DONO);
        String gerente = token(GERENTE);
        vincular(2, 2L);
        var agenda = LocalDateTime.now(PagamentoManobristaService.FUSO_NEGOCIO).plusHours(1).withNano(0);
        String evento = """
                {"unidadeId":1,"nome":"Evento sintético","contratante":"Cliente","local":"Local",
                 "inicio":"%s","fim":"%s","veiculosPrevistos":2,"capacidade":3,
                 "equipePrevista":1,"responsavel":"Gestão","situacao":"PLANEJADO"}
                """.formatted(agenda, agenda.plusHours(2));
        long id = criar(dono, "/api/eventos", evento);
        lembretes.registrarProximos(agenda.minusHours(1));
        lembretes.registrarProximos(agenda.minusHours(1));
        String escala = """
                {"unidadeId":1,"eventoId":%d,"inicio":"%s","fim":"%s","responsavel":"Gestão",
                 "situacao":"PLANEJADA","manobristaIds":[1]}
                """.formatted(id, agenda, agenda.plusHours(2));
        long escalaId = criar(dono, "/api/escalas", escala);
        for (int i = 0; i < 2; i++) {
            mvc.perform(auth(put("/api/escalas/" + escalaId), dono).content(escala.replace("PLANEJADA", "CONFIRMADA")))
                    .andExpect(status().isOk());
        }
        fila.distribuir();
        mvc.perform(auth(get(API), dono)).andExpect(jsonPath("$[*].categoria", containsInAnyOrder("EVENTO_PROXIMO", "ESCALA_ALTERADA")));
        mvc.perform(auth(get("/api/eventos/" + id), gerente)).andExpect(status().isForbidden());
        mvc.perform(auth(get("/api/escalas/" + escalaId), gerente)).andExpect(status().isForbidden());
    }

    private long ficha(String token, int unidade, String turno, String extra) throws Exception {
        var hoje = LocalDate.now(PagamentoManobristaService.FUSO_NEGOCIO);
        return criar(token, "/api/fichas", """
                {"data":"%s","unidadeId":%d,"turno":"%s","fichaInicio":0,"fichaFim":2,
                 "taxaMaquininha":2,"manobristas":[{"manobristaId":1,"diaria":50%s}]}
                """.formatted(hoje, unidade, turno, extra));
    }

    private long criar(String token, String uri, String corpo) throws Exception {
        return json.readTree(mvc.perform(auth(post(uri), token).content(corpo)).andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsByteArray()).get("id").asLong();
    }

    private void inscrever(String token, UUID dispositivo, String endpoint) throws Exception {
        mvc.perform(auth(put(API + "/push/" + dispositivo), token).content("{\"endpoint\":\"" + endpoint + "\",\"chavePublica\":\"chave-teste\"}"))
                .andExpect(status().isNoContent());
    }

    private String token(String email) throws Exception {
        var resposta = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"identificador\":\"" + email + "\",\"senha\":\"123456\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray();
        return json.readTree(resposta).get("token").asText();
    }

    private static MockHttpServletRequestBuilder auth(MockHttpServletRequestBuilder req, String token) {
        return req.header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON);
    }

    private void vincular(long usuario, Long... unidades) {
        usuarios.findById(usuario).orElseThrow().definirUnidades(Set.of(unidades));
        usuarios.flush();
    }
}
