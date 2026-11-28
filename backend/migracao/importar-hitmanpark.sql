-- =====================================================================
-- Importação Hitman Park (ValetGest)  →  Park Flash
-- =====================================================================
-- Copia unidades, manobristas, usuários, sócios e fichas (com lançamentos
-- e despesas) do banco antigo para o banco novo do Park Flash.
--
-- O banco ANTIGO é só lido (via postgres_fdw). Nada é alterado nele.
-- Tudo roda numa única transação: se qualquer conferência falhar,
-- nada é gravado no banco novo.
--
-- Pré-requisitos:
--   * Banco novo criado pelo Park Flash (Flyway V1..V17) SEM dados de
--     demonstração e SEM usuários (não defina ADMIN_EMAIL no 1º start).
--   * Rodar como superusuário do PostgreSQL (ex.: sudo -u postgres).
--
-- Uso (na VPS):
--   sudo -u postgres psql -d parkflash -v legado_db=NOME_DO_BANCO_ANTIGO \
--        -f importar-hitmanpark.sql
--
-- Parâmetros opcionais (padrões entre parênteses):
--   -v legado_host=...     (/var/run/postgresql — socket local)
--   -v legado_porta=...    (5432)
--   -v legado_usuario=...  (postgres)
-- =====================================================================

\set ON_ERROR_STOP on
\if :{?legado_db}
\else
  \echo 'ERRO: informe o banco antigo com -v legado_db=NOME'
  \quit 1
\endif
\if :{?legado_host}
\else
  \set legado_host /var/run/postgresql
\endif
\if :{?legado_porta}
\else
  \set legado_porta 5432
\endif
\if :{?legado_usuario}
\else
  \set legado_usuario postgres
\endif

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Acesso somente leitura ao banco antigo
-- ---------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS postgres_fdw;
DROP SCHEMA IF EXISTS legado CASCADE;
DROP SERVER IF EXISTS hitmanpark_legado CASCADE;
CREATE SERVER hitmanpark_legado FOREIGN DATA WRAPPER postgres_fdw
    OPTIONS (dbname :'legado_db', host :'legado_host', port :'legado_porta');
CREATE USER MAPPING FOR CURRENT_USER SERVER hitmanpark_legado OPTIONS (user :'legado_usuario');
CREATE SCHEMA legado;
IMPORT FOREIGN SCHEMA public
    LIMIT TO (unidades, manobristas, usuarios, socios, socio_unidades, fichas, lancamentos_manobrista, despesas)
    FROM SERVER hitmanpark_legado INTO legado;

-- Cópia local (uma leitura só de cada tabela antiga)
CREATE TEMP TABLE l_unidades    ON COMMIT DROP AS SELECT * FROM legado.unidades;
CREATE TEMP TABLE l_manobristas ON COMMIT DROP AS SELECT * FROM legado.manobristas;
CREATE TEMP TABLE l_usuarios    ON COMMIT DROP AS SELECT * FROM legado.usuarios;
CREATE TEMP TABLE l_socios      ON COMMIT DROP AS SELECT * FROM legado.socios;
CREATE TEMP TABLE l_socio_un    ON COMMIT DROP AS SELECT * FROM legado.socio_unidades;
CREATE TEMP TABLE l_fichas      ON COMMIT DROP AS SELECT * FROM legado.fichas;
CREATE TEMP TABLE l_lanc        ON COMMIT DROP AS SELECT * FROM legado.lancamentos_manobrista;
CREATE TEMP TABLE l_desp        ON COMMIT DROP AS SELECT * FROM legado.despesas;

-- ---------------------------------------------------------------------
-- 2. Conferências antes de gravar
-- ---------------------------------------------------------------------
DO $$
DECLARE n bigint;
BEGIN
    SELECT (SELECT count(*) FROM usuario) + (SELECT count(*) FROM unidade) + (SELECT count(*) FROM manobrista)
         + (SELECT count(*) FROM ficha) + (SELECT count(*) FROM socio) + (SELECT count(*) FROM despesa) INTO n;
    IF n > 0 THEN
        RAISE EXCEPTION 'O banco novo já tem dados (% registros). A importação só roda num Park Flash vazio.', n;
    END IF;

    SELECT count(*) INTO n FROM l_usuarios WHERE tipo = 'DONO' AND ativo;
    IF n = 0 THEN
        RAISE EXCEPTION 'O banco antigo não tem nenhum DONO ativo — ninguém conseguiria administrar o Park Flash.';
    END IF;

    -- O Park Flash aceita no máximo 2 fichas por dia/unidade (turnos DIA e NOITE).
    SELECT count(*) INTO n FROM (
        SELECT 1 FROM l_fichas GROUP BY data_ficha, unidade_id HAVING count(*) > 2) x;
    IF n > 0 THEN
        RAISE EXCEPTION 'Há % combinações de dia/unidade com 3 ou mais fichas. Veja a consulta no LEIAME antes de importar.', n;
    END IF;
END $$;

-- ---------------------------------------------------------------------
-- 3. Cadastros (os IDs antigos são preservados)
-- ---------------------------------------------------------------------
INSERT INTO unidade (id, nome, endereco, telefone, ativa)
SELECT id,
       CASE WHEN rn = 1 THEN left(btrim(nome), 100)
            ELSE left(btrim(nome), 85) || ' (unidade ' || id || ')' END,
       coalesce(endereco, ''), telefone, ativa
FROM (SELECT u.*, row_number() OVER (PARTITION BY lower(btrim(nome)) ORDER BY ativa DESC, id) AS rn
      FROM l_unidades u) x;

INSERT INTO manobrista (id, nome, telefone, cpf, ativo)
SELECT id, nome, telefone, cpf, ativo FROM l_manobristas;

INSERT INTO usuario (id, nome, email, nivel, senha_hash, ativo)
SELECT id, nome, email,
       CASE tipo WHEN 'DONO' THEN 'PROPRIETARIO' ELSE 'GERENTE' END,
       senha,   -- hash BCrypt: as senhas atuais continuam valendo
       ativo
FROM l_usuarios;

INSERT INTO usuario_unidade (usuario_id, unidade_id)
SELECT id, unidade_id FROM l_usuarios WHERE unidade_id IS NOT NULL;

-- Só sócios ativos (o sistema antigo já ignorava os inativos na divisão)
INSERT INTO socio (id, nome) SELECT id, nome FROM l_socios WHERE ativo;

INSERT INTO socio_participacao (socio_id, unidade_id, percentual)
SELECT su.socio_id, su.unidade_id, su.porcentagem
FROM l_socio_un su JOIN l_socios s ON s.id = su.socio_id AND s.ativo
WHERE su.porcentagem > 0;

-- ---------------------------------------------------------------------
-- 4. Fichas (fechadas, para não serem alteradas sem justificativa)
-- ---------------------------------------------------------------------
CREATE TEMP TABLE l_fichas_calc ON COMMIT DROP AS
SELECT f.*,
       row_number() OVER (PARTITION BY f.data_ficha, f.unidade_id ORDER BY f.id) AS rn,
       round(f.valor_inicial)::int AS ini,
       round(f.valor_final)::int   AS fim,
       round(coalesce(f.valor_dinheiro, 0) + coalesce(f.valor_em_cartao, 0), 2) AS bruto,
       round(coalesce(f.valor_em_cartao, 0) * coalesce(f.porcentagem_cartao, 0) / 100, 2) AS taxa,
       coalesce((SELECT sum(l.valor_pago) FROM l_lanc l WHERE l.ficha_id = f.id), 0) AS manobr,
       coalesce((SELECT sum(d.valor) FROM l_desp d WHERE d.ficha_id = f.id), 0) AS desp
FROM l_fichas f;

INSERT INTO ficha (id, data, unidade_id, turno,
                   ficha_inicio, ficha_fim, fichas_canceladas, total_carros,
                   valor_dinheiro, valor_cartao, valor_pix, taxa_maquininha,
                   total_bruto, total_liquido, controle_pagamentos,
                   situacao, responsavel_id, fechado_por, fechado_em, observacoes)
SELECT c.id, c.data_ficha, c.unidade_id,
       CASE c.rn WHEN 1 THEN 'DIA' ELSE 'NOITE' END,
       -- Início/fim viram numeração de tickets. Se a numeração não comporta
       -- a quantidade de carros informada, o fim é ajustado (o original vai na observação).
       c.ini,
       CASE WHEN c.fim - c.ini >= c.quantidade_manobras THEN c.fim ELSE c.ini + c.quantidade_manobras END,
       CASE WHEN c.fim - c.ini >= c.quantidade_manobras THEN c.fim - c.ini - c.quantidade_manobras ELSE 0 END,
       c.quantidade_manobras,
       coalesce(c.valor_dinheiro, 0), coalesce(c.valor_em_cartao, 0), 0, coalesce(c.porcentagem_cartao, 0),
       c.bruto, c.bruto - c.taxa - c.manobr - c.desp,
       false,                       -- fora do controle de pagamentos (histórico)
       'FECHADA',
       (SELECT u.id FROM l_usuarios u WHERE u.id = c.usuario_id),
       (SELECT min(id) FROM l_usuarios WHERE tipo = 'DONO' AND ativo),
       now(),
       left('[Importada do Hitman Park, ficha nº ' || c.id || '; início ' || c.valor_inicial
            || ', fim ' || c.valor_final || ']' || coalesce(' ' || nullif(btrim(c.observacoes), ''), ''), 500)
FROM l_fichas_calc c;

-- Mesmo manobrista 2x na ficha: o Park Flash não permite, então os valores são somados.
INSERT INTO ficha_manobrista (ficha_id, ordem, manobrista_id, diaria, modalidade_custo)
SELECT ficha_id, row_number() OVER (PARTITION BY ficha_id ORDER BY primeiro) - 1,
       manobrista_id, total, modalidade
FROM (SELECT ficha_id, manobrista_id, min(id) AS primeiro, sum(valor_pago) AS total,
             (array_agg(tipo_pagamento ORDER BY id))[1] AS modalidade
      FROM l_lanc GROUP BY ficha_id, manobrista_id) x;

INSERT INTO ficha_despesa (ficha_id, ordem, descricao, valor)
SELECT ficha_id, row_number() OVER (PARTITION BY ficha_id ORDER BY id) - 1, left(descricao, 200), valor
FROM l_desp;

-- ---------------------------------------------------------------------
-- 5. Próximos IDs continuam depois dos importados
-- ---------------------------------------------------------------------
SELECT setval(pg_get_serial_sequence('unidade', 'id'),    greatest((SELECT max(id) FROM unidade), 1));
SELECT setval(pg_get_serial_sequence('manobrista', 'id'), greatest((SELECT max(id) FROM manobrista), 1));
SELECT setval(pg_get_serial_sequence('usuario', 'id'),    greatest((SELECT max(id) FROM usuario), 1));
SELECT setval(pg_get_serial_sequence('socio', 'id'),      greatest((SELECT max(id) FROM socio), 1));
SELECT setval(pg_get_serial_sequence('ficha', 'id'),      greatest((SELECT max(id) FROM ficha), 1));

-- ---------------------------------------------------------------------
-- 6. Conciliação: o Park Flash tem de bater centavo a centavo com o antigo
-- ---------------------------------------------------------------------
CREATE TEMP TABLE conciliacao ON COMMIT DROP AS
WITH antigo AS (
    SELECT date_trunc('month', data_ficha)::date AS mes, unidade_id,
           count(*) AS fichas, sum(quantidade_manobras) AS carros, sum(bruto) AS bruto,
           sum(taxa) AS taxa, sum(manobr) AS manobristas, sum(desp) AS despesas,
           sum(bruto - taxa - manobr - desp) AS liquido
    FROM l_fichas_calc GROUP BY 1, 2),
novo AS (
    SELECT date_trunc('month', f.data)::date AS mes, f.unidade_id,
           count(*) AS fichas, sum(f.total_carros) AS carros, sum(f.total_bruto) AS bruto,
           sum(round(f.valor_cartao * f.taxa_maquininha / 100, 2)) AS taxa,
           sum(coalesce((SELECT sum(m.diaria) FROM ficha_manobrista m WHERE m.ficha_id = f.id), 0)) AS manobristas,
           sum(coalesce((SELECT sum(d.valor) FROM ficha_despesa d WHERE d.ficha_id = f.id), 0)) AS despesas,
           sum(f.total_liquido) AS liquido
    FROM ficha f GROUP BY 1, 2)
SELECT coalesce(a.mes, n.mes) AS mes, coalesce(a.unidade_id, n.unidade_id) AS unidade_id,
       a.fichas AS fichas_antigo, n.fichas AS fichas_novo,
       a.carros AS carros_antigo, n.carros AS carros_novo,
       a.bruto AS bruto_antigo, n.bruto AS bruto_novo,
       a.liquido AS liquido_antigo, n.liquido AS liquido_novo,
       (a.fichas IS NOT DISTINCT FROM n.fichas AND a.carros IS NOT DISTINCT FROM n.carros
        AND a.bruto IS NOT DISTINCT FROM n.bruto AND a.taxa IS NOT DISTINCT FROM n.taxa
        AND a.manobristas IS NOT DISTINCT FROM n.manobristas AND a.despesas IS NOT DISTINCT FROM n.despesas
        AND a.liquido IS NOT DISTINCT FROM n.liquido) AS confere
FROM antigo a FULL JOIN novo n ON n.mes = a.mes AND n.unidade_id = a.unidade_id;

\echo
\echo '=== Registros importados ==='
SELECT 'unidades' AS item, (SELECT count(*) FROM l_unidades) AS antigo, (SELECT count(*) FROM unidade) AS novo
UNION ALL SELECT 'manobristas', (SELECT count(*) FROM l_manobristas), (SELECT count(*) FROM manobrista)
UNION ALL SELECT 'usuarios', (SELECT count(*) FROM l_usuarios), (SELECT count(*) FROM usuario)
UNION ALL SELECT 'socios (ativos)', (SELECT count(*) FROM l_socios WHERE ativo), (SELECT count(*) FROM socio)
UNION ALL SELECT 'fichas', (SELECT count(*) FROM l_fichas), (SELECT count(*) FROM ficha)
UNION ALL SELECT 'lancamentos', (SELECT count(*) FROM l_lanc), (SELECT count(*) FROM ficha_manobrista)
UNION ALL SELECT 'despesas da ficha', (SELECT count(*) FROM l_desp), (SELECT count(*) FROM ficha_despesa);

\echo '=== Ajustes feitos (confira) ==='
SELECT 'fichas no mesmo dia/unidade → 2ª virou turno NOITE' AS ajuste, count(*) AS qtd FROM l_fichas_calc WHERE rn = 2
UNION ALL SELECT 'manobrista repetido na ficha → valores somados',
       count(*) FROM (SELECT 1 FROM l_lanc GROUP BY ficha_id, manobrista_id HAVING count(*) > 1) x
UNION ALL SELECT 'numeração de tickets menor que os carros → fim ajustado',
       count(*) FROM l_fichas_calc WHERE fim - ini < quantidade_manobras
UNION ALL SELECT 'início/fim com centavos → arredondados',
       count(*) FROM l_fichas WHERE valor_inicial <> round(valor_inicial) OR valor_final <> round(valor_final)
UNION ALL SELECT 'unidades com nome repetido → renomeadas',
       count(*) FROM unidade u JOIN l_unidades l ON l.id = u.id WHERE u.nome <> btrim(l.nome)
UNION ALL SELECT 'sócios inativos não importados', count(*) FROM l_socios WHERE NOT ativo
UNION ALL SELECT 'gerentes sem unidade (não verão fichas)',
       count(*) FROM l_usuarios WHERE tipo = 'GERENTE' AND unidade_id IS NULL;

\echo '=== Unidades cuja divisão de lucro NÃO soma 100% (a tela de Divisão não reparte até corrigir) ==='
SELECT u.id, u.nome, sum(p.percentual) AS soma
FROM socio_participacao p JOIN unidade u ON u.id = p.unidade_id
GROUP BY u.id, u.nome HAVING sum(p.percentual) <> 100 ORDER BY u.id;

\echo '=== Conciliação por mês e unidade ==='
SELECT * FROM conciliacao ORDER BY mes, unidade_id;

DO $$
DECLARE n bigint;
BEGIN
    SELECT count(*) INTO n FROM conciliacao WHERE NOT confere;
    IF n > 0 THEN
        RAISE EXCEPTION 'Conciliação falhou em % mês/unidade. Nada foi gravado.', n;
    END IF;
    RAISE NOTICE 'Conciliação OK: todos os meses e unidades batem com o sistema antigo.';
END $$;

-- ---------------------------------------------------------------------
-- 7. Remove o acesso ao banco antigo e grava
-- ---------------------------------------------------------------------
DROP SCHEMA legado CASCADE;
DROP SERVER hitmanpark_legado CASCADE;

COMMIT;
\echo 'Importação concluída.'
