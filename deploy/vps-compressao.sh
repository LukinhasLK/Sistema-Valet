#!/usr/bin/env bash
# Roda na VPS, como root. Liga a compressão gzip para JS, CSS, SVG e JSON (hoje só o HTML é
# comprimido: a primeira visita cai de ~590 KB para ~170 KB) e inclui .webp/.woff2 no cache de
# mídia. Valida antes de recarregar e desfaz tudo se algo falhar. Pode rodar de novo sem efeito.
#   ./vps-compressao.sh
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "Rode como root."; exit 1; }
CONF="${CONF:-/etc/nginx/sites-available/parkflash-producao}"
COMP=/etc/nginx/conf.d/parkflash-compressao.conf
[ -f "$CONF" ] || { echo "Não achei $CONF."; exit 1; }

COPIA="/root/backups/nginx-parkflash-producao-antes-compressao-$(date +%F-%H%M).conf"
cp -p "$CONF" "$COPIA"
CRIOU_COMP=0

desfazer() {
  cp -p "$COPIA" "$CONF"
  [ "$CRIOU_COMP" = 1 ] && rm -f "$COMP"
  nginx -t && systemctl reload nginx
}

# 1. Compressão (nível http). O nginx.conf padrão do Debian/Ubuntu já tem "gzip on" e deixa os
#    tipos comentados; aqui entram só os tipos e ajustes. Se algum já estiver ativo no nginx.conf,
#    o nginx -t acusa duplicado e tudo é desfeito.
if [ ! -f "$COMP" ]; then
  cat > "$COMP" <<'NGX'
# Park Flash: comprime os arquivos de texto além do HTML.
gzip_vary on;
gzip_proxied any;
gzip_comp_level 5;
gzip_min_length 1024;
gzip_types text/css application/javascript text/javascript image/svg+xml application/json application/manifest+json;
NGX
  CRIOU_COMP=1
fi

# 2. Cache de mídia: inclui webp e mantém 7 dias (os arquivos de /midia não têm hash no nome).
python3 - "$CONF" <<'PY'
import sys
p = sys.argv[1]; s = open(p).read()
velho = r"location ~* \.(?:png|jpg|svg|ico|mp4|woff2?)$"
novo = r"location ~* \.(?:png|jpg|webp|svg|ico|mp4|woff2?)$"
if novo not in s and velho in s:
    open(p, "w").write(s.replace(velho, novo, 1))
PY

if nginx -t; then
  systemctl reload nginx
  echo "nginx recarregado: compressão ligada."
  echo "Confira:  curl -sI -H 'Accept-Encoding: gzip' https://hitmanpark.com/assets/<arquivo>.js | grep -i content-encoding"
else
  desfazer
  echo "Configuração inválida — tudo foi desfeito."; exit 1
fi
