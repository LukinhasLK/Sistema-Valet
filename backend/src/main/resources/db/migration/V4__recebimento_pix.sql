ALTER TABLE ficha ADD COLUMN valor_pix NUMERIC(12, 2) NOT NULL DEFAULT 0
    CHECK (valor_pix >= 0);
