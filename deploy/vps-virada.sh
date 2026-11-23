#!/usr/bin/env bash
# Roda na VPS, como root, no dia da troca (de preferência fora do horário de uso).
# 1. Guarda a configuração atual do nginx do hitmanpark.com
# 2. Aponta o hitmanpark.com para o Park Flash (mesmos certificados HTTPS)
#    → a partir daqui o backend antigo não recebe mais lançamentos
# 3. Reimporta os dados do banco antigo, já congelado, com conciliação
# Para desfazer: ./vps-voltar.sh
#   ./vps-virada.sh NOME_DO_BANCO_ANTIGO
set -euo pipefail
AQUI="$(cd "$(dirname "$0")" && pwd)"
ANTIGO="${1:?Informe o nome do banco antigo.}"
DOMINIO="${DOMINIO:-hitmanpark.com}"
[ "$(id -u)" = 0 ] || { echo "Rode como root."; exit 1; }
[ -f /opt/parkflash/parkflash-api.jar ] || { echo "Instale antes: ./vps-instalar.sh"; exit 1; }

# --- 1. Achar a configuração atual -------------------------------------------
ARQS=$(grep -lE "server_name[^;]*[[:space:]]$DOMINIO([[:space:];]|$)" /etc/nginx/sites-enabled/* 2>/dev/null | grep -v parkflash || true)
QTD=$(printf '%s\n' "$ARQS" | grep -c . || true)
[ "$QTD" = 1 ] || { echo "Esperava 1 arquivo do nginx com '$DOMINIO', achei $QTD: ${ARQS:-nenhum}"; exit 1; }
ATUAL="$ARQS"
echo "==> Configuração atual: $ATUAL"

SSL=$(grep -hE '^[[:space:]]*(ssl_certificate|ssl_certificate_key|ssl_dhparam|include[[:space:]]+[^[:space:]]*letsencrypt[^[:space:]]*)[[:space:]]' "$ATUAL" \
      | sed -E 's/^[[:space:]]*//; s/[[:space:]]*#.*$//' | sort -u)
echo "$SSL" | grep -q '^ssl_certificate ' && echo "$SSL" | grep -q '^ssl_certificate_key ' \
    || { echo "Não achei ssl_certificate/ssl_certificate_key em $ATUAL. Nada foi alterado."; exit 1; }

DATA=$(date +%F-%H%M)
install -d -m 700 /root/backups
cp -L "$ATUAL" "/root/backups/nginx-$DOMINIO-$DATA.conf"
printf '%s\n%s\n' "$ATUAL" "/root/backups/nginx-$DOMINIO-$DATA.conf" > /root/backups/virada-ultima.txt
echo "   cópia em /root/backups/nginx-$DOMINIO-$DATA.conf"

# --- 2. Nova configuração ----------------------------------------------------
NOVO=/etc/nginx/sites-available/parkflash-producao
{
    echo "# Gerado por vps-virada.sh em $(date '+%F %T'). Original: /root/backups/nginx-$DOMINIO-$DATA.conf"
    echo "server {"
    echo "    listen 80;"
    echo "    listen [::]:80;"
    echo "    server_name $DOMINIO www.$DOMINIO;"
    echo "    return 301 https://\$host\$request_uri;"
    echo "}"
    echo "server {"
    echo "    listen 443 ssl;"
    echo "    listen [::]:443 ssl;"
    echo "    server_name $DOMINIO www.$DOMINIO;"
    echo "$SSL" | sed 's/^/    /'
    awk '/root \/var\/www\/parkflash;/{p=1} p' "$AQUI/nginx-parkflash.conf" | sed '$d'
    echo "}"
} > "$NOVO"

DESATIVADO="/root/backups/sites-enabled-$(basename "$ATUAL")-$DATA"
mv "$ATUAL" "$DESATIVADO"
ln -sf "$NOVO" /etc/nginx/sites-enabled/parkflash-producao
echo "$DESATIVADO" >> /root/backups/virada-ultima.txt
if ! nginx -t; then
    echo "Configuração nova inválida — restaurando a antiga."
    rm -f /etc/nginx/sites-enabled/parkflash-producao
    mv "$DESATIVADO" "$ATUAL"
    nginx -t && systemctl reload nginx
    exit 1
fi

# --- 3. Troca e reimportação ------------------------------------------------
systemctl stop parkflash
systemctl reload nginx
echo "==> $DOMINIO agora aponta para o Park Flash. Reimportando os dados congelados..."
CONFIRMAR=sim "$AQUI/vps-importar.sh" "$ANTIGO"

CODIGO=$(curl -s -o /dev/null -w '%{http_code}' "https://$DOMINIO/api/fichas" || true)
echo
echo "Teste externo https://$DOMINIO/api/fichas → $CODIGO (esperado 401)"
echo "Virada concluída. Para voltar ao sistema antigo: ./vps-voltar.sh"
