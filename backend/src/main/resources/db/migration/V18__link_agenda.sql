-- Link de assinatura da agenda (Google Calendar, iPhone, Outlook). Um por usuário.
-- Só o hash SHA-256 do token é guardado: o link completo aparece uma vez, ao ser gerado.
CREATE TABLE agenda_link (
    usuario_id BIGINT PRIMARY KEY REFERENCES usuario (id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    criado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
