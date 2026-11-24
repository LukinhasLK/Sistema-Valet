#!/usr/bin/env bash
# Roda no SEU MAC. Testa, compila e envia o pacote do Park Flash para a VPS.
# Não altera nada em produção: só copia arquivos para /root/parkflash-pacote na VPS.
#
#   ./deploy/publicar.sh                 (VPS padrão root@2.24.64.11, front React)
#   FRONT=angular ./deploy/publicar.sh   (publica a versão Angular)
#   VPS=root@outro-ip ./deploy/publicar.sh
set -euo pipefail

VPS="${VPS:-root@2.24.64.11}"
FRONT="${FRONT:-react}"
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
cd "$RAIZ"

echo "==> Testes e build do backend"
(cd backend && ./mvnw -q clean package)

echo "==> Testes e build do frontend ($FRONT)"
if [ "$FRONT" = angular ]; then
    npm ci --no-audit --no-fund
    npm run build
    SITE=dist/park-flash/browser
else
    (cd frontend-react && npm ci --no-audit --no-fund && npm test && npm run build)
    SITE=frontend-react/dist
fi

PACOTE="$(mktemp -d)"
trap 'rm -rf "$PACOTE"' EXIT
mkdir -p "$PACOTE/parkflash-pacote"
cp -R "$SITE"                                "$PACOTE/parkflash-pacote/site"
cp backend/target/parkflash-api-0.1.0.jar   "$PACOTE/parkflash-pacote/parkflash-api.jar"
cp backend/migracao/importar-hitmanpark.sql "$PACOTE/parkflash-pacote/"
cp deploy/*.sh deploy/*.conf deploy/*.service "$PACOTE/parkflash-pacote/"
echo "$(git rev-parse --short HEAD 2>/dev/null) $FRONT" > "$PACOTE/parkflash-pacote/VERSAO"
COPYFILE_DISABLE=1 tar --no-mac-metadata --no-xattrs -czf "$PACOTE/parkflash-pacote.tgz" -C "$PACOTE" parkflash-pacote

echo "==> Enviando para $VPS"
scp "$PACOTE/parkflash-pacote.tgz" "$VPS:/root/"
ssh "$VPS" 'rm -rf /root/parkflash-pacote && tar xzf /root/parkflash-pacote.tgz -C /root && chmod +x /root/parkflash-pacote/*.sh && cat /root/parkflash-pacote/VERSAO'

echo
echo "Pacote enviado. Na VPS, rode a próxima etapa do deploy/LEIAME.md."
