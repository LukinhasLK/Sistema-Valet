#!/usr/bin/env bash
# Roda na VPS, como root, UMA vez. Prepara o Park Flash AO LADO do sistema antigo:
#   - Java 17+, usuário 'parkflash', pastas, banco 'parkflash' próprio
#   - segredos gerados aqui mesmo (ninguém precisa vê-los)
#   - serviço systemd na porta 8081
#   - site de homologação em http://srv1637921.hstgr.cloud
# Não toca no hitmanpark.com, no backend antigo nem no banco antigo.
set -euo pipefail

HOMOLOGACAO="${HOMOLOGACAO:-srv1637921.hstgr.cloud}"
PORTA=8081
AQUI="$(cd "$(dirname "$0")" && pwd)"

[ "$(id -u)" = 0 ] || { echo "Rode como root."; exit 1; }
for cmd in nginx psql; do command -v $cmd >/dev/null || { echo "Falta '$cmd' na VPS."; exit 1; }; done
systemctl is-active --quiet postgresql || { echo "PostgreSQL não está rodando."; exit 1; }
if ss -ltn | grep -q ":$PORTA "; then
    systemctl is-active --quiet parkflash || { echo "A porta $PORTA já está em uso por outro programa."; exit 1; }
fi

echo "==> Java"
JAVA_MAIOR=$(java -version 2>&1 | sed -nE 's/.*version "([0-9]+).*/\1/p' | head -1 || true)
if [ -z "${JAVA_MAIOR}" ] || [ "${JAVA_MAIOR}" -lt 17 ]; then
    apt-get update -q && apt-get install -y -q openjdk-17-jre-headless
fi
java -version 2>&1 | head -1

echo "==> Usuário e pastas"
id parkflash >/dev/null 2>&1 || useradd --system --home /opt/parkflash --shell /usr/sbin/nologin parkflash
install -d -o parkflash -g parkflash -m 750 /opt/parkflash
install -d -m 755 /var/www/parkflash
install -d -o root -g parkflash -m 750 /etc/parkflash
install -d -m 700 /root/backups

echo "==> Banco de dados 'parkflash'"
ENV=/etc/parkflash/parkflash.env
if [ ! -f "$ENV" ]; then
    gera() { openssl rand -base64 64 | tr -d '\n/+=' | cut -c1-"$1"; }
    SENHA_DB=$(gera 32)
    sudo -u postgres psql -v ON_ERROR_STOP=1 -q -c "CREATE ROLE parkflash LOGIN PASSWORD '$SENHA_DB'" \
        || sudo -u postgres psql -v ON_ERROR_STOP=1 -q -c "ALTER ROLE parkflash LOGIN PASSWORD '$SENHA_DB'"
    umask 027
    cat > "$ENV" <<EOF
# Gerado por vps-preparar.sh em $(date '+%F %T'). NÃO apague nem troque PIX_SEGREDO:
# sem ele as chaves Pix salvas ficam ilegíveis.
SPRING_PROFILES_ACTIVE=postgres
PORT=$PORTA
# Só o nginx (mesma máquina) acessa a API; nada exposto direto na internet
SERVER_ADDRESS=127.0.0.1
DB_URL=jdbc:postgresql://localhost:5432/parkflash
DB_USUARIO=parkflash
DB_SENHA=$SENHA_DB
JWT_SEGREDO=$(gera 64)
PIX_SEGREDO=$(gera 64)
JWT_EXPIRACAO=8h
CORS_ORIGENS=https://hitmanpark.com,https://www.hitmanpark.com,https://$HOMOLOGACAO
SERVER_FORWARDHEADERSSTRATEGY=framework
PUSH_ENVIAR=false
EOF
    chown root:parkflash "$ENV"; chmod 640 "$ENV"
    echo "   segredos gerados em $ENV"
else
    echo "   $ENV já existe — mantido (segredos preservados)"
fi
sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='parkflash'" | grep -q 1 \
    || sudo -u postgres createdb -O parkflash parkflash

echo "==> Serviço systemd"
install -m 644 "$AQUI/parkflash.service" /etc/systemd/system/parkflash.service
systemctl daemon-reload
systemctl enable parkflash >/dev/null

echo "==> Site de homologação ($HOMOLOGACAO)"
sed "s/__DOMINIO__/$HOMOLOGACAO/" "$AQUI/nginx-parkflash.conf" > /etc/nginx/sites-available/parkflash-homologacao
ln -sf /etc/nginx/sites-available/parkflash-homologacao /etc/nginx/sites-enabled/parkflash-homologacao
nginx -t && systemctl reload nginx

echo
echo "Pronto. Próximo passo: ./vps-instalar.sh"
echo "HTTPS da homologação (uma vez):  certbot --nginx -d $HOMOLOGACAO"
