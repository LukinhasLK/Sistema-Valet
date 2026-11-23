CREATE TABLE push_teste_usuario (
    usuario_id BIGINT PRIMARY KEY REFERENCES usuario(id) ON DELETE CASCADE,
    tentado_em TIMESTAMP WITH TIME ZONE NOT NULL
);
