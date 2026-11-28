package com.parkflash.servico;

import com.parkflash.erro.NaoEncontradoException;
import com.parkflash.erro.RegraInvalidaException;
import com.parkflash.repositorio.UnidadeRepository;
import com.parkflash.web.dto.DivisaoLucro;
import com.parkflash.web.dto.RateioUnidadeDto;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class RateioService {
    private static final BigDecimal CEM = new BigDecimal("100");
    private final JdbcClient jdbc;
    private final UnidadeRepository unidades;

    public RateioService(JdbcClient jdbc, UnidadeRepository unidades) {
        this.jdbc = jdbc;
        this.unidades = unidades;
    }

    @Transactional
    public void configurar(long unidadeId, RateioUnidadeDto pedido, long atorId) {
        LocalDate inicio = pedido.vigenteDesde();
        LocalDate mesCorrente = YearMonth.now(PagamentoManobristaService.FUSO_NEGOCIO).atDay(1);
        if (inicio.getDayOfMonth() != 1 || inicio.isBefore(mesCorrente)) {
            throw new RegraInvalidaException("Escolha o primeiro dia do mês atual ou de um mês futuro.");
        }
        var ids = pedido.partes().stream().map(RateioUnidadeDto.Parte::socioId).distinct().toList();
        if (ids.size() != pedido.partes().size()) {
            throw new RegraInvalidaException("Cada sócio deve aparecer uma única vez.");
        }
        if (!totalValido(pedido.partes(), RateioUnidadeDto.Parte::percentual)) {
            throw new RegraInvalidaException("O total de participações deve ser exatamente 100%.");
        }
        if (!unidades.existsById(unidadeId)) throw new NaoEncontradoException("Unidade não encontrada.");

        Map<Long, String> nomes = jdbc.sql("SELECT id, nome FROM socio WHERE id IN (:ids)").param("ids", ids)
                .query((rs, i) -> Map.entry(rs.getLong("id"), rs.getString("nome"))).list()
                .stream().collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));
        if (nomes.size() != ids.size()) throw new RegraInvalidaException("Há um sócio que não existe.");

        var chave = new GeneratedKeyHolder();
        jdbc.sql("INSERT INTO rateio_unidade (unidade_id, vigente_desde, criado_por) VALUES (:unidade, :inicio, :ator)")
                .param("unidade", unidadeId).param("inicio", inicio).param("ator", atorId).update(chave, "id");
        long rateioId = Objects.requireNonNull(chave.getKey()).longValue();
        for (var parte : pedido.partes()) {
            jdbc.sql("""
                    INSERT INTO rateio_unidade_socio (rateio_id, socio_id, nome, percentual)
                    VALUES (:rateio, :socio, :nome, :percentual)
                    """).param("rateio", rateioId).param("socio", parte.socioId()).param("nome", nomes.get(parte.socioId()))
                    .param("percentual", parte.percentual()).update();
        }
    }

    public List<RateioUnidadeDto.Revisao> historico(long unidadeId) {
        return jdbc.sql("""
                SELECT r.id, r.vigente_desde, u.nome AS autor, r.criado_em FROM rateio_unidade r
                JOIN usuario u ON u.id = r.criado_por WHERE r.unidade_id = :unidade ORDER BY r.vigente_desde DESC
                """).param("unidade", unidadeId).query(RateioUnidadeDto.Revisao.class).list();
    }

    public List<Cota> cotas(long unidadeId, LocalDate data) {
        var revisao = jdbc.sql("""
                SELECT id FROM rateio_unidade WHERE unidade_id = :unidade AND vigente_desde <= :data
                ORDER BY vigente_desde DESC LIMIT 1
                """).param("unidade", unidadeId).param("data", data).query(Long.class).optional();
        if (revisao.isPresent()) {
            return jdbc.sql("""
                    SELECT socio_id, nome, percentual FROM rateio_unidade_socio WHERE rateio_id = :rateio ORDER BY socio_id
                    """).param("rateio", revisao.get()).query(Cota.class).list();
        }
        return jdbc.sql("""
                SELECT p.socio_id, s.nome, p.percentual FROM socio_participacao p JOIN socio s ON s.id = p.socio_id
                WHERE p.unidade_id = :unidade AND p.percentual > 0 ORDER BY p.socio_id
                """).param("unidade", unidadeId).query(Cota.class).list();
    }

    public List<DivisaoLucro.Parte> repartir(BigDecimal resultado, List<Cota> cotas) {
        if (!totalValido(cotas, Cota::percentual)) return List.of();
        BigDecimal total = resultado.abs();
        var bases = cotas.stream().map(cota -> {
            BigDecimal exato = total.multiply(cota.percentual()).movePointLeft(2);
            BigDecimal valor = exato.setScale(2, RoundingMode.DOWN);
            return new Parcela(cota, valor, exato.subtract(valor));
        }).sorted(Comparator.comparing(Parcela::fracao).reversed().thenComparing(p -> p.cota().socioId())).toList();
        BigDecimal soma = bases.stream().map(Parcela::valor).reduce(BigDecimal.ZERO, BigDecimal::add);
        int centavos = total.subtract(soma).movePointRight(2).intValueExact();
        return java.util.stream.IntStream.range(0, bases.size()).mapToObj(i -> {
            var base = bases.get(i);
            BigDecimal valor = i < centavos ? base.valor().add(new BigDecimal("0.01")) : base.valor();
            return new DivisaoLucro.Parte(base.cota().socioId(), base.cota().nome(), base.cota().percentual(),
                    resultado.signum() < 0 ? valor.negate() : valor);
        }).sorted(Comparator.comparing(DivisaoLucro.Parte::socioId)).toList();
    }

    private static <T> boolean totalValido(List<T> cotas, Function<T, BigDecimal> percentual) {
        return cotas.stream().map(percentual).reduce(BigDecimal.ZERO, BigDecimal::add).compareTo(CEM) == 0;
    }

    public record Cota(long socioId, String nome, BigDecimal percentual) {}
    private record Parcela(Cota cota, BigDecimal valor, BigDecimal fracao) {}
}
