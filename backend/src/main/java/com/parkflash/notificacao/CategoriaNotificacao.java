package com.parkflash.notificacao;

public enum CategoriaNotificacao {
    FICHA_CRIADA("Ficha registrada", "FICHA"),
    FICHA_AGUARDANDO_FECHAMENTO("Ficha aguardando fechamento", "FICHA"),
    PAGAMENTO_PENDENTE("Diária reconhecida aguardando pagamento", "FICHA"),
    PAGAMENTO_CONFIRMADO("Pagamento confirmado", "PAGAMENTO"),
    DIVERGENCIA_FINANCEIRA("Divergência financeira sinalizada", "FICHA"),
    EVENTO_PROXIMO("Evento programado nas próximas 24 horas", "EVENTO"),
    ESCALA_ALTERADA("Escala alterada", "ESCALA");

    private final String titulo;
    private final String destino;

    CategoriaNotificacao(String titulo, String destino) {
        this.titulo = titulo;
        this.destino = destino;
    }

    public String titulo() { return titulo; }
    public String destino() { return destino; }
}
