-- Demonstração: login do sócio Francisco (senha 123456, a mesma dos outros usuários de teste).
INSERT INTO usuario (id, nome, email, nivel, senha_hash, socio_id) VALUES
    (4, 'Francisco', 'francisco@email.com', 'SOCIO', '$2a$10$rTt/LcZRrWD5qQGdJy72Pul8IQJSqUSt7yQfMZJOZYjF8PG76rlra', 1);
ALTER TABLE usuario ALTER COLUMN id RESTART WITH 5;
