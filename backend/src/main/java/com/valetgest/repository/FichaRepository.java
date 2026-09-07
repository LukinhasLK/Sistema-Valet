package com.valetgest.repository;

import com.valetgest.entity.Ficha;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface FichaRepository extends JpaRepository<Ficha, Long> {

    /**
     * Busca fichas de uma unidade em um intervalo de datas.
     * Usado pelos relatórios mensais.
     */
    List<Ficha> findByUnidadeIdAndDataFichaBetweenOrderByDataFichaAsc(
            Long unidadeId, LocalDate inicio, LocalDate fim);

    /**
     * Busca fichas de TODAS as unidades em um intervalo (relatório do dono).
     */
    List<Ficha> findByDataFichaBetweenOrderByDataFichaAsc(
            LocalDate inicio, LocalDate fim);

    /**
     * Aqui usamos JPQL (linguagem de consulta do JPA) para
     * fazer uma query mais customizada quando precisamos.
     * Útil quando o nome do método ficaria gigante.
     */
    @Query("SELECT f FROM Ficha f WHERE f.unidade.id = :unidadeId AND f.dataFicha = :data")
    List<Ficha> buscarPorUnidadeEData(
            @Param("unidadeId") Long unidadeId,
            @Param("data") LocalDate data);
}
