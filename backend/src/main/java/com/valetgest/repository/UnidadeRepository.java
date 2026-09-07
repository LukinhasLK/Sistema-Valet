package com.valetgest.repository;

import com.valetgest.entity.Unidade;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * Spring Data JPA cria automaticamente os métodos básicos:
 * findAll, findById, save, delete, etc.
 *
 * Você só declara métodos extras seguindo a convenção de nomes do Spring.
 */
@Repository
public interface UnidadeRepository extends JpaRepository<Unidade, Long> {

    /**
     * Lista só as unidades ativas.
     * O Spring monta o SQL automaticamente pelo nome do método!
     */
    List<Unidade> findByAtivaTrue();
}
