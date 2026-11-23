package com.parkflash.repositorio;

import com.parkflash.dominio.Despesa;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface DespesaRepository extends JpaRepository<Despesa, Long> {

    List<Despesa> findAllByOrderByDataDescIdDesc();

    List<Despesa> findByUnidadeIdInOrderByDataDescIdDesc(Collection<Long> ids);

    List<Despesa> findByCanceladaFalseAndUnidadeIdInAndDataBetweenOrderByDataDescIdDesc(Collection<Long> ids, LocalDate inicio, LocalDate fim);

    List<Despesa> findByCanceladaFalseAndDataBetweenOrderByDataDescIdDesc(LocalDate inicio, LocalDate fim);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select d from Despesa d where d.id = :id")
    Optional<Despesa> buscarParaAlteracao(Long id);

    boolean existsByUnidadeId(Long unidadeId);
}
