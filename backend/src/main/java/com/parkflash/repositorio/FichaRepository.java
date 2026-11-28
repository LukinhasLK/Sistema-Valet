package com.parkflash.repositorio;

import com.parkflash.dominio.Ficha;
import com.parkflash.dominio.Turno;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface FichaRepository extends JpaRepository<Ficha, Long> {

    @Query(value = "SELECT id FROM ficha WHERE id = :id FOR UPDATE", nativeQuery = true)
    Optional<Long> bloquearId(long id);

    List<Ficha> findAllByOrderByDataDescIdDesc();

    List<Ficha> findByUnidadeIdInOrderByDataDescIdDesc(Collection<Long> ids);

    List<Ficha> findByUnidadeIdInAndDataBetweenOrderByDataDescIdDesc(Collection<Long> ids, LocalDate inicio, LocalDate fim);

    List<Ficha> findByDataBetweenOrderByDataDescIdDesc(LocalDate inicio, LocalDate fim);

    boolean existsByDataAndUnidadeIdAndTurno(LocalDate data, Long unidadeId, Turno turno);

    boolean existsByDataAndUnidadeIdAndTurnoAndIdNot(LocalDate data, Long unidadeId, Turno turno, Long id);

    boolean existsByUnidadeId(Long unidadeId);

    @Query("select count(f) > 0 from Ficha f join f.manobristas m where m.manobristaId = :manobristaId")
    boolean usaManobrista(Long manobristaId);
}
