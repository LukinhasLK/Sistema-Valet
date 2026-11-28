package com.parkflash.repositorio;

import com.parkflash.dominio.Manobrista;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;

public interface ManobristaRepository extends JpaRepository<Manobrista, Long> {

    long countByIdIn(Collection<Long> ids);

    long countByIdInAndAtivoTrue(Collection<Long> ids);
}
