-- 1) Tentativas de login por identificador (e-mail ou nome digitado, em minúsculas).
-- Vale também para identificador inexistente: o bloqueio não revela se a conta existe.
CREATE TABLE login_tentativa (
    identificador VARCHAR(150) PRIMARY KEY,
    falhas INTEGER NOT NULL,
    primeira_falha TIMESTAMP WITH TIME ZONE NOT NULL,
    bloqueado_ate TIMESTAMP WITH TIME ZONE
);

-- 2) O link de agenda guarda a versão da sessão de quem o gerou: trocar a senha ou
-- "sair de todos os aparelhos" derruba também o link.
ALTER TABLE agenda_link ADD COLUMN sessao_versao VARCHAR(36) NOT NULL DEFAULT '';
