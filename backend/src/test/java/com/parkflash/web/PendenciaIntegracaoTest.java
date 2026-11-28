package com.parkflash.web;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.parkflash.repositorio.UsuarioRepository;
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

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
@TestPropertySource(properties = "spring.datasource.url=jdbc:h2:mem:parkflash-pendencias;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH")
class PendenciaIntegracaoTest {

    private static final String PROPRIETARIO = "lucasrodrigues.10@icloud.com";
    private static final String GERENTE = "pedro@email.com";
    private static final String OPERADOR = "dario@email.com";
    private static final String SOCIO = "francisco@email.com";

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;
    @Autowired private JdbcClient jdbc;
    @Autowired private UsuarioRepository usuarios;

    private String login(String email) throws Exception {
        String corpo = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"identificador\":\"" + email + "\",\"senha\":\"123456\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return json.readTree(corpo).get("token").asText();
    }

    private JsonNode ler(String url, String token) throws Exception {
        MockHttpServletRequestBuilder req = get(url).header("Authorization", "Bearer " + token);
        return json.readTree(mvc.perform(req).andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    }

    private static long qtd(JsonNode lista, String tipo) {
        for (JsonNode p : lista) if (p.get("tipo").asText().equals(tipo)) return p.get("quantidade").asLong();
        return 0;
    }

    private static LocalDate hoje() {
        return LocalDate.now(ZoneId.of("America/Sao_Paulo"));
    }

    private void ficha(long unidade, String turno, String situacao) {
        jdbc.sql("""
                INSERT INTO ficha (data, unidade_id, turno, ficha_inicio, ficha_fim, fichas_canceladas, total_carros,
                    valor_dinheiro, valor_cartao, taxa_maquininha, total_bruto, total_liquido, situacao)
                VALUES (:data, :unidade, :turno, 1, 2, 0, 1, 10, 0, 0, 10, 10, :situacao)
                """).param("data", hoje()).param("unidade", unidade).param("turno", turno).param("situacao", situacao).update();
    }

    private long fichaEm(LocalDate data, long unidade, String turno, String situacao) {
        jdbc.sql("""
                INSERT INTO ficha (data, unidade_id, turno, ficha_inicio, ficha_fim, fichas_canceladas, total_carros,
                    valor_dinheiro, valor_cartao, taxa_maquininha, total_bruto, total_liquido, situacao)
                VALUES (:data, :unidade, :turno, 1, 2, 0, 1, 10, 0, 0, 10, 10, :situacao)
                """).param("data", data).param("unidade", unidade).param("turno", turno).param("situacao", situacao).update();
        return jdbc.sql("SELECT MAX(id) FROM ficha").query(Long.class).single();
    }

    private void enviadaEm(long ficha, long unidade, java.time.OffsetDateTime quando) {
        jdbc.sql("""
                INSERT INTO ficha_historico (ficha_id, ator_id, unidade_id, acao, registrado_em)
                VALUES (:ficha, 1, :unidade, 'ENVIAR', :quando)
                """).param("ficha", ficha).param("unidade", unidade).param("quando", quando).update();
    }

    private static JsonNode item(JsonNode lista, String tipo) {
        for (JsonNode p : lista) if (p.get("tipo").asText().equals(tipo)) return p;
        return null;
    }

    private void evento(long unidade, String nome, LocalDate dia, String situacao) {
        jdbc.sql("""
                INSERT INTO evento (unidade_id, nome, contratante, local, inicio, fim, veiculos_previstos, capacidade,
                    equipe_prevista, responsavel, situacao)
                VALUES (:unidade, :nome, 'Cliente', 'Local', :inicio, :fim, 10, 10, 2, 'Pedro', :situacao)
                """).param("unidade", unidade).param("nome", nome).param("inicio", dia.atTime(18, 0))
                .param("fim", dia.atTime(23, 0)).param("situacao", situacao).update();
    }

    @Test
    void semLoginE401EOperadorNaoVeNadaDeGestao() throws Exception {
        mvc.perform(get("/api/pendencias")).andExpect(status().isUnauthorized());
        ficha(1, "zp1", "PRONTA");
        assertThat(ler("/api/pendencias", login(OPERADOR))).isEmpty();
    }

    @Test
    void contagensBatemComAsTelasEOProprietarioVeTudo() throws Exception {
        String dono = login(PROPRIETARIO);
        JsonNode antes = ler("/api/pendencias", dono);
        ficha(1, "zp1", "PRONTA");
        ficha(2, "zp2", "PRONTA");
        ficha(2, "zp3", "EM_EDICAO");
        ficha(1, "zp4", "FECHADA");
        ficha(1, "zp5", "CANCELADA");
        evento(1, "Hoje", hoje(), "CONFIRMADO");
        evento(2, "Amanha", hoje().plusDays(1), "PLANEJADO");
        evento(2, "Depois", hoje().plusDays(2), "CONFIRMADO");
        evento(1, "Cancelado", hoje(), "CANCELADO");

        JsonNode depois = ler("/api/pendencias", dono);
        assertThat(qtd(depois, "prontas") - qtd(antes, "prontas")).isEqualTo(2);
        assertThat(qtd(depois, "fichasAbertasMes") - qtd(antes, "fichasAbertasMes")).isEqualTo(1); // só EM_EDICAO (as PRONTA já contam em "prontas")
        assertThat(qtd(depois, "eventosHojeAmanha") - qtd(antes, "eventosHojeAmanha")).isEqualTo(2);

        // mesmas regras das telas de pagamento
        assertThat(qtd(depois, "diariasAConferir")).isEqualTo(
                ler("/api/pagamentos-manobristas/conferencia", dono).get("total").asLong());
        JsonNode resumo = ler("/api/pagamentos-manobristas/resumo", dono);
        assertThat(qtd(depois, "manobristasAPagar")).isEqualTo(resumo.get("manobristasPendentes").asLong());

        for (JsonNode p : depois) {
            assertThat(p.get("quantidade").asLong()).isPositive();
            assertThat(p.get("id").asText()).isEqualTo(p.get("tipo").asText());
            assertThat(p.get("rota").asText()).startsWith("/app/");
        }
        // urgentes primeiro
        boolean viuNaoUrgente = false;
        for (JsonNode p : depois) {
            boolean urgente = p.get("nivel").asText().equals("URGENTE");
            assertThat(viuNaoUrgente && urgente).isFalse();
            viuNaoUrgente |= !urgente;
        }
    }

    @Test
    void unidadeSemRateioSoParaOProprietarioEQuandoHaResultado() throws Exception {
        String dono = login(PROPRIETARIO);
        long antes = qtd(ler("/api/pendencias", dono), "unidadesSemRateio");
        // unidade 3 não tem participação nos dados de demonstração: uma ficha fechada gera resultado sem rateio
        jdbc.sql("DELETE FROM despesa WHERE unidade_id = 3").update();
        ficha(3, "zr1", "FECHADA");
        JsonNode depois = ler("/api/pendencias", dono);
        assertThat(qtd(depois, "unidadesSemRateio") - antes).isEqualTo(1);
        for (JsonNode p : depois) if (p.get("tipo").asText().equals("unidadesSemRateio")) {
            assertThat(p.get("nivel").asText()).isEqualTo("URGENTE");
            assertThat(p.get("rota").asText()).isEqualTo("/app/socios");
        }
        assertThat(qtd(ler("/api/pendencias", login(GERENTE)), "unidadesSemRateio")).isZero();
    }

    @Test
    void gerenteVeSoAsUnidadesDeleESemItensDeProprietario() throws Exception {
        usuarios.findById(2L).orElseThrow().definirUnidades(Set.of(1L));
        usuarios.flush();
        String gerente = login(GERENTE);
        JsonNode antes = ler("/api/pendencias", gerente);
        ficha(1, "zg1", "PRONTA");
        ficha(2, "zg2", "PRONTA");
        evento(2, "Outra unidade", hoje(), "CONFIRMADO");
        evento(1, "Minha unidade", hoje(), "CONFIRMADO");
        JsonNode depois = ler("/api/pendencias", gerente);
        assertThat(qtd(depois, "prontas") - qtd(antes, "prontas")).isEqualTo(1);
        assertThat(qtd(depois, "eventosHojeAmanha") - qtd(antes, "eventosHojeAmanha")).isEqualTo(1);
        for (JsonNode p : depois) {
            assertThat(p.get("tipo").asText()).isNotIn("fichasAbertasMes", "unidadesSemRateio");
        }
    }

    @Test
    void socioVeSoFichasAbertasDasUnidadesOndeParticipa() throws Exception {
        String socio = login(SOCIO);
        JsonNode antes = ler("/api/pendencias", socio);
        ficha(1, "zs1", "EM_EDICAO");   // Francisco participa
        ficha(2, "zs2", "PRONTA");      // Francisco participa
        ficha(3, "zs3", "EM_EDICAO");   // não participa
        JsonNode depois = ler("/api/pendencias", socio);
        assertThat(qtd(depois, "fichasAbertasMes") - qtd(antes, "fichasAbertasMes")).isEqualTo(2);
        for (JsonNode p : depois) {
            assertThat(p.get("tipo").asText()).isEqualTo("fichasAbertasMes");
            assertThat(p.get("nivel").asText()).isEqualTo("INFO");
            assertThat(p.get("rota").asText()).isEqualTo("/app/sociedade");
        }
    }

    @Test
    void prontasAtrasadasContaSoQuemEsperaMaisDe24hEIdentificaAMaisAntiga() throws Exception {
        String dono = login(PROPRIETARIO);
        JsonNode antes = ler("/api/pendencias", dono);
        long base = qtd(antes, "prontasAtrasadas");
        var agora = java.time.OffsetDateTime.now();
        long recente = fichaEm(hoje(), 1, "za1", "PRONTA");           // enviada há 2 h: não conta
        enviadaEm(recente, 1, agora.minusHours(2));
        long velha = fichaEm(hoje().minusDays(5), 1, "za2", "PRONTA"); // enviada há 3 dias
        enviadaEm(velha, 1, agora.minusDays(3));
        long maisVelha = fichaEm(hoje().minusDays(9), 2, "za3", "PRONTA"); // enviada há 6 dias
        enviadaEm(maisVelha, 2, agora.minusDays(6));
        long semHistorico = fichaEm(hoje().minusDays(4), 2, "za4", "PRONTA"); // sem histórico: vale a data (anterior a ontem)
        long ontemSemHistorico = fichaEm(hoje().minusDays(1), 2, "za5", "PRONTA"); // sem histórico, de ontem: não conta
        long fechada = fichaEm(hoje().minusDays(8), 1, "za6", "FECHADA"); // não é PRONTA
        enviadaEm(fechada, 1, agora.minusDays(7));

        JsonNode depois = ler("/api/pendencias", dono);
        assertThat(qtd(depois, "prontasAtrasadas") - base).isEqualTo(3);
        JsonNode i = item(depois, "prontasAtrasadas");
        assertThat(i.get("nivel").asText()).isEqualTo("ATENCAO");
        assertThat(i.get("rota").asText()).isEqualTo("/app/fichas?situacao=PRONTA&mes=0&ordem=antigas");
        if (base == 0) { // sem outra ficha mais velha nos dados de demonstração
            assertThat(i.get("maisAntigaId").asLong()).isEqualTo(maisVelha);
            assertThat(i.get("maisAntigaData").asText()).isEqualTo(hoje().minusDays(9).toString());
            assertThat(i.get("maisAntigaUnidade").asText()).isNotBlank();
        }
        assertThat(semHistorico).isNotEqualTo(ontemSemHistorico);
        // os demais tipos não trazem os campos extras
        JsonNode prontas = item(depois, "prontas");
        assertThat(prontas.has("maisAntigaId")).isFalse();
    }

    @Test
    void prontasAtrasadasRespeitaAsUnidadesDoGerenteEOperadorNaoVe() throws Exception {
        usuarios.findById(2L).orElseThrow().definirUnidades(Set.of(1L));
        usuarios.flush();
        String gerente = login(GERENTE);
        long antes = qtd(ler("/api/pendencias", gerente), "prontasAtrasadas");
        var agora = java.time.OffsetDateTime.now();
        enviadaEm(fichaEm(hoje().minusDays(7), 2, "zb1", "PRONTA"), 2, agora.minusDays(5)); // outra unidade
        assertThat(qtd(ler("/api/pendencias", gerente), "prontasAtrasadas") - antes).isZero();
        enviadaEm(fichaEm(hoje().minusDays(7), 1, "zb2", "PRONTA"), 1, agora.minusDays(5));
        assertThat(qtd(ler("/api/pendencias", gerente), "prontasAtrasadas") - antes).isEqualTo(1);
        assertThat(ler("/api/pendencias", login(OPERADOR))).isEmpty();
    }
}
