ALTER TABLE ficha_manobrista
    ADD COLUMN modalidade_custo VARCHAR(32) DEFAULT 'DIARIA_FIXA' NOT NULL;

ALTER TABLE ficha_manobrista
    ADD CONSTRAINT ck_ficha_manobrista_modalidade
    CHECK (modalidade_custo IN ('DIARIA_FIXA', 'VALOR_FIXO_POR_MANOBRA', 'PORCENTAGEM'));
