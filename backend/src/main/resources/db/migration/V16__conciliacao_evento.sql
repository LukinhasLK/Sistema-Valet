CREATE TABLE evento_ficha (
    ficha_id BIGINT PRIMARY KEY REFERENCES ficha(id),
    evento_id BIGINT NOT NULL REFERENCES evento(id)
);
CREATE INDEX idx_evento_ficha_evento ON evento_ficha (evento_id);

CREATE TABLE evento_despesa (
    despesa_id BIGINT PRIMARY KEY REFERENCES despesa(id),
    evento_id BIGINT NOT NULL REFERENCES evento(id)
);
CREATE INDEX idx_evento_despesa_evento ON evento_despesa (evento_id);
