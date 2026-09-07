package com.valetgest.enums;

/**
 * Como cada manobrista é pago em cada ficha.
 * O tipo é definido por ficha porque pode variar por unidade/dia.
 */
public enum TipoPagamentoManobrista {
    VALOR_FIXO_POR_MANOBRA,  // exemplo: R$ 5 por carro manobrado
    PORCENTAGEM,             // exemplo: 30% do total da ficha
    DIARIA_FIXA              // exemplo: R$ 100 por dia trabalhado
}
