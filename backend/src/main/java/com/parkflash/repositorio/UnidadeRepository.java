package com.parkflash.repositorio;

import com.parkflash.dominio.Unidade;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import jakarta.persistence.LockModeType;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface UnidadeRepository extends JpaRepository<Unidade, Long> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select e from Unidade e where e.id = :id")
    Optional<Unidade> buscarParaAlteracao(@Param("id") Long id);


    List<Unidade> findByIdInOrderById(Collection<Long> ids);

    long countByIdIn(Collection<Long> ids);

    boolean existsByNomeIgnoreCaseAndIdNot(String nome, Long id);

    boolean existsByNomeIgnoreCase(String nome);

    boolean existsByIdAndAtivaTrue(Long id);
}
