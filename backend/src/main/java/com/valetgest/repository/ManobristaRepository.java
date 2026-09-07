package com.valetgest.repository;

import com.valetgest.entity.Manobrista;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ManobristaRepository extends JpaRepository<Manobrista, Long> {

    List<Manobrista> findByAtivoTrue();
}
