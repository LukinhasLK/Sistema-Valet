package com.parkflash.web.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.LocalDate;

/**
 * Uma pendência do usuário (algo que pede ação agora; some sozinha quando resolvida).
 *
 * @param id         identificador estável do tipo (ex.: "prontas"); o front o usa para lembrar o que já avisou
 * @param tipo       mesmo valor de {@code id} (um item por tipo); o texto é montado no front a partir de tipo + quantidade
 * @param nivel      URGENTE, ATENCAO ou INFO
 * @param quantidade quantas ocorrências (sempre maior que zero: tipo sem ocorrência não é devolvido)
 * @param rota       tela do sistema onde se resolve
 * @param maisAntigaData    só em "prontasAtrasadas": data da ficha PRONTA que espera há mais tempo (ausente nos demais tipos)
 * @param maisAntigaUnidade só em "prontasAtrasadas": nome da unidade dessa ficha
 * @param maisAntigaId      só em "prontasAtrasadas": id dessa ficha
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record PendenciaDto(String id, String tipo, Nivel nivel, long quantidade, String rota,
                           LocalDate maisAntigaData, String maisAntigaUnidade, Long maisAntigaId) {

    public enum Nivel { URGENTE, ATENCAO, INFO }

    public static PendenciaDto de(String tipo, Nivel nivel, long quantidade, String rota) {
        return new PendenciaDto(tipo, tipo, nivel, quantidade, rota, null, null, null);
    }

    /** Fichas PRONTA esperando conferência há mais de 24 h, com a mais antiga identificada. */
    public static PendenciaDto prontasAtrasadas(long quantidade, String rota, LocalDate data, String unidade, long fichaId) {
        return new PendenciaDto("prontasAtrasadas", "prontasAtrasadas", Nivel.ATENCAO, quantidade, rota, data, unidade, fichaId);
    }
}
