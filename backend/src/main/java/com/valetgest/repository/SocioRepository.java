package com.valetgest.repository;

import com.valetgest.entity.Socio;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface SocioRepository extends JpaRepository<Socio, Long> {

    List<Socio> findByAtivoTrue();

    @Query("SELECT DISTINCT s FROM Socio s JOIN s.participacoes p WHERE s.ativo = true AND p.unidade.id = :unidadeId")
    List<Socio> findByUnidadeId(@Param("unidadeId") Long unidadeId);
}
