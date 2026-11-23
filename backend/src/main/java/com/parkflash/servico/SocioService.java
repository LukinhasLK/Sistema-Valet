package com.parkflash.servico;

import com.parkflash.dominio.Socio;
import com.parkflash.erro.ConflitoException;
import com.parkflash.erro.NaoEncontradoException;
import com.parkflash.erro.RegraInvalidaException;
import com.parkflash.repositorio.SocioRepository;
import com.parkflash.web.dto.SocioDto;
import com.parkflash.web.dto.PercentualUnidadeDto;
import org.springframework.data.domain.Sort;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.math.BigDecimal;
import java.util.HashSet;
import java.util.stream.Collectors;
import java.util.List;

@Service
public class SocioService {

    private final SocioRepository socios;
    private final JdbcClient jdbc;

    public SocioService(SocioRepository socios, JdbcClient jdbc) {
        this.socios = socios;
        this.jdbc = jdbc;
    }

    @Transactional(readOnly = true)
    public List<SocioDto> listar() {
        var participacoes = jdbc.sql("""
                WITH vigentes AS (
                    SELECT unidade_id, MAX(vigente_desde) AS desde
                    FROM rateio_unidade WHERE vigente_desde <= :hoje GROUP BY unidade_id
                )
                SELECT p.socio_id, p.unidade_id, p.percentual FROM socio_participacao p
                WHERE NOT EXISTS (SELECT 1 FROM vigentes v WHERE v.unidade_id = p.unidade_id)
                UNION ALL
                SELECT p.socio_id, r.unidade_id, p.percentual FROM rateio_unidade_socio p
                JOIN rateio_unidade r ON r.id = p.rateio_id JOIN vigentes v
                ON v.unidade_id = r.unidade_id AND v.desde = r.vigente_desde
                """).param("hoje", LocalDate.now(PagamentoManobristaService.FUSO_NEGOCIO))
                .query(Participacao.class).list().stream().collect(Collectors.groupingBy(Participacao::socioId,
                        Collectors.mapping(p -> new PercentualUnidadeDto(p.unidadeId(), p.percentual()), Collectors.toList())));
        return socios.findAll(Sort.by("id")).stream()
                .map(s -> new SocioDto(s.getId(), s.getNome(), participacoes.getOrDefault(s.getId(), List.of())))
                .toList();
    }

    @Transactional
    public SocioDto criar(SocioDto dto) {
        Socio socio = new Socio();
        if (dto.percentuais() != null && !dto.percentuais().isEmpty()) throw configurarRateio();
        socio.setNome(dto.nome().trim());
        return SocioDto.de(socios.save(socio));
    }

    @Transactional
    public SocioDto atualizar(Long id, SocioDto dto) {
        Socio socio = buscar(id);
        if (dto.percentuais() != null) {
            var atuais = new HashSet<>(SocioDto.de(socio).percentuais());
            if (!atuais.equals(new HashSet<>(dto.percentuais()))) throw configurarRateio();
        }
        socio.setNome(dto.nome().trim());
        return SocioDto.de(socio);
    }

    @Transactional
    public void excluir(Long id) {
        Socio socio = buscar(id);
        boolean possuiRateio = jdbc.sql("SELECT EXISTS (SELECT 1 FROM rateio_unidade_socio WHERE socio_id = :id)")
                .param("id", id).query(Boolean.class).single();
        if (possuiRateio || !socio.getPercentuais().isEmpty()) {
            throw new ConflitoException("O sócio possui participações e faz parte do histórico.");
        }
        socios.delete(socio);
    }

    private Socio buscar(Long id) {
        return socios.findById(id).orElseThrow(() -> new NaoEncontradoException("Sócio não encontrado."));
    }

    private record Participacao(long socioId, long unidadeId, BigDecimal percentual) {}

    private static RegraInvalidaException configurarRateio() {
        return new RegraInvalidaException("Edite a distribuição completa na seção Rateio por unidade.");
    }
}
