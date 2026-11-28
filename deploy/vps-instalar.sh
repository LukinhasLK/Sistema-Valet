#!/usr/bin/env bash
# Roda na VPS, como root, a cada nova versão (depois do publicar.sh).
# Instala o jar e o site do pacote, guardando a versão anterior para voltar.
#   ./vps-instalar.sh            instala o pacote desta pasta
#   ./vps-instalar.sh voltar     volta para a versão anterior
set -euo pipefail
AQUI="$(cd "$(dirname "$0")" && pwd)"
[ "$(id -u)" = 0 ] || { echo "Rode como root."; exit 1; }
[ -f /etc/parkflash/parkflash.env ] || { echo "Rode antes o ./vps-preparar.sh"; exit 1; }

aguardar_api() {
    for _ in $(seq 1 60); do
        # 401 = API no ar pedindo login
        [ "$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8081/api/fichas)" = 401 ] && return 0
        sleep 2
    done
    echo "A API não respondeu. Veja: journalctl -u parkflash -n 80"; return 1
}

if [ "${1:-}" = voltar ]; then
    [ -f /opt/parkflash/parkflash-api.jar.anterior ] || { echo "Não há versão anterior."; exit 1; }
    mv /opt/parkflash/parkflash-api.jar.anterior /opt/parkflash/parkflash-api.jar
    rm -rf /var/www/parkflash && mv /var/www/parkflash.anterior /var/www/parkflash
    systemctl restart parkflash && aguardar_api && echo "Versão anterior restaurada."
    exit 0
fi

[ -f "$AQUI/parkflash-api.jar" ] && [ -d "$AQUI/site" ] || { echo "Pacote incompleto em $AQUI."; exit 1; }

echo "==> Instalando versão $(cat "$AQUI/VERSAO" 2>/dev/null || echo '?')"
[ -f /opt/parkflash/parkflash-api.jar ] && cp -p /opt/parkflash/parkflash-api.jar /opt/parkflash/parkflash-api.jar.anterior
install -o parkflash -g parkflash -m 640 "$AQUI/parkflash-api.jar" /opt/parkflash/parkflash-api.jar

rm -rf /var/www/parkflash.anterior
[ -d /var/www/parkflash ] && cp -a /var/www/parkflash /var/www/parkflash.anterior
rm -rf /var/www/parkflash.novo && cp -a "$AQUI/site" /var/www/parkflash.novo
chmod -R a+rX /var/www/parkflash.novo
rm -rf /var/www/parkflash && mv /var/www/parkflash.novo /var/www/parkflash

systemctl restart parkflash
aguardar_api
echo "Park Flash no ar (porta 8081). Para desfazer: ./vps-instalar.sh voltar"
