package com.parkflash.seguranca;

import com.parkflash.dominio.NivelAcesso;
import org.springframework.security.access.AccessDeniedException;

import java.util.Set;

public record AcessoUnidades(boolean todas, Set<Long> unidades) {

    public static AcessoUnidades de(UsuarioLogado ator) {
        return new AcessoUnidades(ator.nivel() == NivelAcesso.PROPRIETARIO, ator.unidadeIds());
    }

    public void exigir(Long unidadeId) {
        if (!todas && !unidades.contains(unidadeId)) {
            throw new AccessDeniedException("Unidade fora do escopo do usuário.");
        }
    }
}
