package com.parkflash.web.dto;

/**
 * Uma pendência do usuário (algo que pede ação agora; some sozinha quando resolvida).
 *
 * @param id         identificador estável do tipo (ex.: "prontas"); o front o usa para lembrar o que já avisou
 * @param tipo       mesmo valor de {@code id} (um item por tipo); o texto é montado no front a partir de tipo + quantidade
 * @param nivel      URGENTE, ATENCAO ou INFO
 * @param quantidade quantas ocorrências (sempre maior que zero: tipo sem ocorrência não é devolvido)
 * @param rota       tela do sistema onde se resolve
 */
public record PendenciaDto(String id, String tipo, Nivel nivel, long quantidade, String rota) {

    public enum Nivel { URGENTE, ATENCAO, INFO }

    public static PendenciaDto de(String tipo, Nivel nivel, long quantidade, String rota) {
        return new PendenciaDto(tipo, tipo, nivel, quantidade, rota);
    }
}
