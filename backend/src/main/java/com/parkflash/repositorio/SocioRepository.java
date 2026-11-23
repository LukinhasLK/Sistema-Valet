package com.parkflash.repositorio;

import com.parkflash.dominio.Socio;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SocioRepository extends JpaRepository<Socio, Long> {
}
