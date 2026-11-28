#!/usr/bin/env bash
# Roda na VPS, como root. O link de agenda (.ics) leva um token no endereço: este script faz o
# nginx parar de gravar esses endereços no access.log. Valida antes de recarregar e restaura a
# configuração original se algo falhar. Pode rodar de novo sem efeito colateral.
#   ./vps-agenda-sem-log.sh
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "Rode como root."; exit 1; }
CONF="${CONF:-/etc/nginx/sites-available/parkflash-producao}"
[ -f "$CONF" ] || { echo "Não achei $CONF."; exit 1; }
if grep -q 'agenda/.*ics' "$CONF"; then echo "Já aplicado."; exit 0; fi

COPIA="/root/backups/nginx-parkflash-producao-antes-agenda-$(date +%F-%H%M).conf"
cp -p "$CONF" "$COPIA"
python3 - "$CONF" <<'PY'
import sys
p = sys.argv[1]; s = open(p).read()
bloco = '''    # Link de agenda: o token vai no endereço, então não entra no log
    location ~ ^/api/agenda/[A-Za-z0-9_-]+\\.ics$ {
        access_log off;
        proxy_pass http://127.0.0.1:8081;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        include snippets/parkflash-seguranca.conf;
    }

'''
marca = "    # Só /api vai para o Spring Boot"
if marca not in s:
    sys.exit("Não achei o bloco /api/ na configuração.")
open(p, "w").write(s.replace(marca, bloco + marca, 1))
PY
if nginx -t; then
  systemctl reload nginx
  echo "nginx recarregado: links de agenda fora do log."
else
  cp -p "$COPIA" "$CONF"; nginx -t && systemctl reload nginx
  echo "Configuração inválida — a original foi restaurada."; exit 1
fi
