# Deploy do Park Flash na VPS (hitmanpark.com)

VPS Hostinger KVM 2 · `srv1637921.hstgr.cloud` · IP `2.24.64.11` · Ubuntu + nginx.
Hoje o hitmanpark.com serve o sistema antigo (Hitman Park/ValetGest).

## Como funciona

O Park Flash sobe **ao lado** do sistema antigo, sem desligá-lo:

| | Sistema antigo | Park Flash |
|---|---|---|
| API | como já está (porta 8080, provavelmente) | serviço `parkflash`, porta **8081** |
| Site | como já está | `/var/www/parkflash` |
| Banco | o atual, **nunca alterado** | banco novo `parkflash` |
| Endereço | hitmanpark.com | homologação: `https://srv1637921.hstgr.cloud` → depois hitmanpark.com |

Senhas e segredos (`JWT_SEGREDO`, `PIX_SEGREDO`, senha do banco) são gerados **dentro da VPS**, em `/etc/parkflash/parkflash.env`. Nunca troque o `PIX_SEGREDO`: sem ele, as chaves Pix salvas ficam ilegíveis.

Backups automáticos ficam em `/root/backups/` (banco antigo antes de cada importação, configuração do nginx antes da virada).

## Antes de começar

- **Renove a VPS** (vence em 30/11/2026).
- O banco antigo precisa ser PostgreSQL nesta VPS. Os scripts conferem isso e param se não for.

## Passo a passo

**1. No Mac**, na pasta do projeto: testa, compila e envia o pacote.
```bash
./deploy/publicar.sh
```

**2. Na VPS** (`ssh root@2.24.64.11`), uma vez só:
```bash
cd /root/parkflash-pacote
./vps-preparar.sh                              # Java, usuário, banco novo, serviço, site de homologação
certbot --nginx -d srv1637921.hstgr.cloud      # HTTPS da homologação
./vps-instalar.sh                              # coloca o Park Flash no ar na homologação
sudo -u postgres psql -lqt | cut -d'|' -f1     # descobre o nome do banco antigo
./vps-importar.sh NOME_DO_BANCO_ANTIGO         # importa uma cópia dos dados atuais
```
Leia o relatório que aparece no fim: a coluna `confere` precisa estar toda `t`.

**3. Homologar** em `https://srv1637921.hstgr.cloud`, entrando com o seu login e senha de hoje. Confira:
- [ ] fichas e totais dos últimos meses iguais aos do sistema antigo
- [ ] relatórios, PDF e Excel
- [ ] divisão de lucro (ajuste em Sócios as unidades que não somam 100%)
- [ ] um gerente vê só a unidade dele
- [ ] lançar uma ficha nova e cadastrar a chave Pix de um manobrista
- [ ] no celular

Pode repetir o `./vps-importar.sh` quantas vezes quiser. Ele recomeça do zero.

**4. Virada** (à noite, sem ninguém lançando fichas):
```bash
cd /root/parkflash-pacote
./vps-virada.sh NOME_DO_BANCO_ANTIGO
```
O script:
1. Guarda a configuração atual do nginx.
2. Aponta o hitmanpark.com para o Park Flash, com os mesmos certificados HTTPS. A partir daqui, o sistema antigo não recebe mais lançamentos.
3. Reimporta os dados, com tudo o que foi lançado até agora.

**Se algo der errado:**
```bash
./vps-voltar.sh            # hitmanpark.com volta para o sistema antigo, como estava
```

## Atualizações futuras

```bash
./deploy/publicar.sh                                  # no Mac
cd /root/parkflash-pacote && ./vps-instalar.sh        # na VPS
./vps-instalar.sh voltar                              # se a versão nova der problema
```

## Segurança e backup (uma vez, depois da virada)

```bash
scp deploy/vps-endurecer.sh root@2.24.64.11:/root/ && ssh root@2.24.64.11 /root/vps-endurecer.sh
```
Agenda o backup diário do banco (03:00, 14 dias em `/root/backups/diario`), limita o login a 10 tentativas/min por IP, põe cabeçalhos de segurança no nginx e liga o fail2ban no SSH. Pode rodar de novo sem efeito colateral.

## Comandos úteis na VPS

```bash
systemctl status parkflash
journalctl -u parkflash -f            # log da API
ls -lh /root/backups/
```
