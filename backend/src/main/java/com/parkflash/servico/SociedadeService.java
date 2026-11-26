package com.parkflash.servico;

import com.parkflash.dominio.NivelAcesso;
import com.parkflash.erro.NaoEncontradoException;
import com.parkflash.erro.RegraInvalidaException;
import com.parkflash.repositorio.UsuarioRepository;
import com.parkflash.seguranca.AcessoUnidades;
import com.parkflash.seguranca.UsuarioLogado;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/**
 * "Minha sociedade": em quais unidades o sócio tem participação e quanto é a parte dele no
 * resultado de cada uma, pela mesma regra da Divisão de Lucro (percentual vigente no mês).
 * O sócio só vê a si mesmo; o proprietário escolhe qualquer sócio.
 */
@Service
public class SociedadeService {

    /** Leitura interna do resultado das unidades: o filtro de quem pode ver é feito aqui. */
    private static final AcessoUnidades TODAS = new AcessoUnidades(true, Set.of());

    private final JdbcClient jdbc;
    private final RateioService rateios;
    private final RelatorioService relatorios;
    private final UsuarioRepository usuarios;

    public SociedadeService(JdbcClient jdbc, RateioService rateios, RelatorioService relatorios, UsuarioRepository usuarios) {
        this.jdbc = jdbc;
        this.rateios = rateios;
        this.relatorios = relatorios;
        this.usuarios = usuarios;
    }

    /**
     * @param valor parte do sócio; null quando o rateio da unidade não soma 100% (não dá para dividir)
     */
    public record UnidadeSocio(long unidadeId, String nome, BigDecimal percentual, BigDecimal resultado,
                               BigDecimal valor, int fichas, int fichasAbertas) {}

    /** @param valor parte do sócio no mês; null para meses que ainda não começaram */
    public record MesSocio(int mes, BigDecimal valor) {}

    /** @param fichasAbertas fichas do mês (nas unidades do sócio) que ainda não foram fechadas e por isso não entram */
    public record Sociedade(long socioId, String nome, int mes, int ano, boolean mesEmAndamento, BigDecimal totalMes,
                            boolean rateioIncompleto, List<UnidadeSocio> unidades, List<MesSocio> meses, int fichasAbertas) {}

    @Transactional(readOnly = true)
    public Sociedade consultar(UsuarioLogado ator, Long socioPedido, int mes, int ano) {
        if (mes < 1 || mes > 12) throw new RegraInvalidaException("Mês deve estar entre 1 e 12.");
        if (ano < 2000 || ano > 2100) throw new RegraInvalidaException("Ano inválido.");
        long socioId = socioPermitido(ator, socioPedido);
        String nome = jdbc.sql("SELECT nome FROM socio WHERE id = :id").param("id", socioId).query(String.class)
                .optional().orElseThrow(() -> new NaoEncontradoException("Sócio não encontrado."));

        var unidades = jdbc.sql("SELECT id, nome FROM unidade ORDER BY nome")
                .query((rs, i) -> new UnidadeNome(rs.getLong("id"), rs.getString("nome"))).list();

        List<UnidadeSocio> doMes = partes(socioId, unidades, mes, ano);
        BigDecimal total = somar(doMes);
        boolean incompleto = doMes.stream().anyMatch(u -> u.valor() == null);

        YearMonth atual = YearMonth.now(PagamentoManobristaService.FUSO_NEGOCIO);
        List<MesSocio> meses = new ArrayList<>();
        for (int m = 1; m <= 12; m++) {
            YearMonth competencia = YearMonth.of(ano, m);
            if (competencia.isAfter(atual)) {
                meses.add(new MesSocio(m, null));
            } else {
                meses.add(new MesSocio(m, m == mes ? total : somar(partes(socioId, unidades, m, ano))));
            }
        }
        int abertas = doMes.stream().mapToInt(UnidadeSocio::fichasAbertas).sum();
        return new Sociedade(socioId, nome, mes, ano, YearMonth.of(ano, mes).equals(atual), total, incompleto, doMes, meses, abertas);
    }

    private record UnidadeNome(long id, String nome) {}

    private List<UnidadeSocio> partes(long socioId, List<UnidadeNome> unidades, int mes, int ano) {
        LocalDate inicio = LocalDate.of(ano, mes, 1);
        List<UnidadeSocio> resultado = new ArrayList<>();
        for (var unidade : unidades) {
            var cotas = rateios.cotas(unidade.id(), inicio);
            var minha = cotas.stream().filter(c -> c.socioId() == socioId).findFirst();
            if (minha.isEmpty()) continue;
            var paraDivisao = relatorios.resumoParaDivisao(mes, ano, unidade.id(), TODAS);
            var resumo = paraDivisao.resumo();
            BigDecimal valor = rateios.repartir(resumo.resultado(), cotas).stream()
                    .filter(p -> p.socioId() == socioId).map(p -> p.valor()).findFirst().orElse(null);
            resultado.add(new UnidadeSocio(unidade.id(), unidade.nome(), minha.get().percentual(), resumo.resultado(),
                    valor, resumo.quantidadeFichas(), paraDivisao.fichasAbertas()));
        }
        return resultado;
    }

    private static BigDecimal somar(List<UnidadeSocio> unidades) {
        return unidades.stream().map(UnidadeSocio::valor).filter(v -> v != null).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private long socioPermitido(UsuarioLogado ator, Long socioPedido) {
        if (ator.nivel() == NivelAcesso.PROPRIETARIO) {
            if (socioPedido == null) throw new RegraInvalidaException("Escolha o sócio.");
            return socioPedido;
        }
        if (ator.nivel() == NivelAcesso.SOCIO) {
            Long proprio = usuarios.findById(ator.id()).map(u -> u.getSocioId()).orElse(null);
            if (proprio == null) throw new AccessDeniedException("Este login não está ligado a um sócio.");
            if (socioPedido != null && !socioPedido.equals(proprio)) {
                throw new AccessDeniedException("Você só pode ver a sua própria sociedade.");
            }
            return proprio;
        }
        throw new AccessDeniedException("Seu nível de acesso não permite esta operação.");
    }
}
