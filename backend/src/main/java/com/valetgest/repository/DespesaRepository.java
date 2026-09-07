package com.valetgest.repository;

import com.valetgest.entity.Despesa;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface DespesaRepository extends JpaRepository<Despesa, Long> {

    @Query("SELECT d FROM Despesa d JOIN FETCH d.ficha f JOIN FETCH f.unidade ORDER BY f.dataFicha DESC")
    List<Despesa> findAllComFicha();
}
