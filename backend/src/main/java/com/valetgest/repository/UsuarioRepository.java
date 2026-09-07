package com.valetgest.repository;

import com.valetgest.entity.Usuario;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UsuarioRepository extends JpaRepository<Usuario, Long> {

    /**
     * Buscar por email - usado no login.
     * Optional<> evita NullPointerException - boa prática Java moderna.
     */
    Optional<Usuario> findByEmail(String email);

    boolean existsByEmail(String email);

    java.util.List<Usuario> findAllByAtivoTrue();
}
