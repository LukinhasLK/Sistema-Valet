#!/usr/bin/env bash
# Roda na VPS, como root. Desfaz a última virada: o hitmanpark.com volta a
# servir o sistema antigo exatamente como estava. O banco antigo nunca foi alterado.
# Lançamentos feitos no Park Flash depois da virada ficam só no banco 'parkflash'.
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "Rode como root."; exit 1; }
REG=/root/backups/virada-ultima.txt
[ -f "$REG" ] || { echo "Não há registro de virada em $REG."; exit 1; }
ORIGINAL=$(sed -n 1p "$REG"); DESATIVADO=$(sed -n 3p "$REG")
[ -e "$DESATIVADO" ] || { echo "Não achei $DESATIVADO."; exit 1; }

rm -f /etc/nginx/sites-enabled/parkflash-producao
mv "$DESATIVADO" "$ORIGINAL"
nginx -t
systemctl reload nginx
echo "Sistema antigo restaurado em $ORIGINAL."
echo "Se o backend antigo foi parado, religue-o como ele roda normalmente."
