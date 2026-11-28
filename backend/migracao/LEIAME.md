# Importação Hitman Park → Park Flash

`importar-hitmanpark.sql` copia os dados do banco antigo (Hitman Park / ValetGest) para um banco **novo e vazio** do Park Flash. O banco antigo só é lido e continua intacto. Assim, dá para voltar ao sistema antigo a qualquer momento.

## O que é importado

| Hitman Park | Park Flash | Observação |
|---|---|---|
| `unidades` | `unidade` | Mesmos IDs. Endereço vazio vira `''`. Nome repetido ganha `(unidade N)`. |
| `manobristas` | `manobrista` | Mesmos IDs, CPF, telefone e situação ativo/inativo. |
| `usuarios` | `usuario` + `usuario_unidade` | DONO vira PROPRIETARIO e GERENTE continua GERENTE. **As senhas atuais continuam valendo** (as duas versões usam BCrypt). |
| `socios` + `socio_unidades` | `socio` + `socio_participacao` | Só os sócios ativos, como o sistema antigo já fazia na divisão. |
| `fichas` | `ficha` | Entram como **FECHADA**, fora do controle de pagamentos. A 2ª ficha do mesmo dia e unidade vira turno NOITE. Início e fim originais ficam guardados na observação. |
| `lancamentos_manobrista` | `ficha_manobrista` | `valor_pago` vira `diaria`, e `tipo_pagamento` vira modalidade. O mesmo manobrista duas vezes na ficha tem os valores somados. |
| `despesas` | `ficha_despesa` | Sem mudança. |

As diárias antigas **não** viram dívida em "Pagamentos de manobristas". O controle de pagamentos começa na data em que o banco novo foi criado.

## Garantias

- Roda numa única transação. Se algo falhar, nada é gravado.
- Recusa rodar se o banco novo já tiver dados.
- No fim, faz uma **conciliação por mês e unidade** (fichas, carros, bruto, taxa, manobristas, despesas e líquido). Se qualquer centavo não bater, desfaz tudo.

Teste feito em 23/11/2026 com o código antigo real (commit `e3cc5ce`) e dados com casos difíceis: os 15 relatórios mensais do Park Flash ficaram **idênticos** aos do sistema antigo. Login com senha antiga, permissão de gerente, divisão de lucro e cadastro de novos registros também funcionaram.

## Passo a passo na VPS

> Antes: **renove a VPS** e confira o espaço em disco (`df -h`).

```bash
# 0. Descobrir o nome do banco antigo
sudo -u postgres psql -lqt | cut -d'|' -f1

# 1. Backup do banco antigo (guarde também uma cópia fora do servidor)
sudo -u postgres pg_dump -Fc BANCO_ANTIGO > ~/backup-hitmanpark-$(date +%F).dump

# 2. (Opcional) Fichas que o Park Flash não aceita: 3 ou mais no mesmo dia e unidade
sudo -u postgres psql -d BANCO_ANTIGO -c "
  SELECT data_ficha, unidade_id, count(*) FROM fichas
  GROUP BY 1,2 HAVING count(*) > 2 ORDER BY 1"

# 3. Criar o banco novo (usuário e senha próprios)
sudo -u postgres psql -c "CREATE USER parkflash WITH PASSWORD 'TROQUE_ESTA_SENHA'"
sudo -u postgres psql -c "CREATE DATABASE parkflash OWNER parkflash"

# 4. Subir o Park Flash UMA vez para criar as tabelas, SEM ADMIN_EMAIL/ADMIN_SENHA
#    (perfil postgres = só migrações, sem dados de demonstração). Pare quando aparecer "Started".
SPRING_PROFILES_ACTIVE=postgres DB_URL=jdbc:postgresql://localhost:5432/parkflash \
DB_USUARIO=parkflash DB_SENHA='TROQUE_ESTA_SENHA' JWT_SEGREDO='...' PIX_SEGREDO='...' \
PUSH_ENVIAR=false java -jar parkflash-api-0.1.0.jar

# 5. Importar
#    (as tabelas já pertencem ao usuário parkflash, criadas no passo 4; o script só insere dados)
sudo -u postgres psql -d parkflash -v legado_db=BANCO_ANTIGO -f importar-hitmanpark.sql
```

Leia o relatório que o script mostra no fim:
- **Ajustes feitos:** quantas fichas viraram turno NOITE, quantos lançamentos foram somados, etc.
- **Unidades cuja divisão não soma 100%:** a tela de Divisão de Lucro do Park Flash só reparte quando a soma é 100%. Ajuste em Sócios.
- **Conciliação:** a coluna `confere` precisa estar toda `t`.

Se aparecer `ERROR`, nada foi gravado. Corrija e rode de novo.

## Voltar atrás

O banco antigo não é alterado. Para voltar, aponte o nginx de novo para o sistema antigo e religue o backend antigo. Para refazer a importação, apague e recrie o banco `parkflash` (`DROP DATABASE parkflash`) e repita os passos 3 a 5.
