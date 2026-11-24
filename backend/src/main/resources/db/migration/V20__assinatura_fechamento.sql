-- Assinatura desenhada na tela ao fechar a ficha (registro interno de quem conferiu).
-- Uma por ficha: um novo fechamento, depois de reaberta, substitui a anterior.
CREATE TABLE ficha_assinatura (
    ficha_id BIGINT PRIMARY KEY REFERENCES ficha (id),
    imagem BYTEA NOT NULL,
    assinado_por BIGINT NOT NULL REFERENCES usuario (id),
    assinado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
