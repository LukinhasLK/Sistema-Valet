-- Nível "Sócio": o login fica ligado a um sócio e só consulta a própria sociedade.
ALTER TABLE usuario ADD COLUMN socio_id BIGINT REFERENCES socio (id);
CREATE UNIQUE INDEX uk_usuario_socio ON usuario (socio_id);
