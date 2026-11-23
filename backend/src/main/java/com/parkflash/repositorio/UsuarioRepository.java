package com.parkflash.repositorio;

import com.parkflash.dominio.Usuario;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface UsuarioRepository extends JpaRepository<Usuario, Long> {
    @Query(value = "SELECT id FROM usuario WHERE id = :id FOR UPDATE", nativeQuery = true)
    Optional<Long> bloquear(@Param("id") Long id);


    Optional<Usuario> findByEmailIgnoreCase(String email);

    Optional<Usuario> findFirstByNomeIgnoreCase(String nome);

    boolean existsByEmailIgnoreCase(String email);

    boolean existsByEmailIgnoreCaseAndIdNot(String email, Long id);
}
