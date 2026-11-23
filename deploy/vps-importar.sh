#!/usr/bin/env bash
# Roda na VPS, como root. Faz backup do banco antigo, recria o banco do
# Park Flash VAZIO e importa os dados do Hitman Park (com conciliação).
#   ./vps-importar.sh NOME_DO_BANCO_ANTIGO
# ATENÇÃO: apaga o que houver no banco 'parkflash' (use na homologação e na virada).
# O banco antigo só é lido.
set -euo pipefail
AQUI="$(cd "$(dirname "$0")" && pwd)"
ANTIGO="${1:?Informe o nome do banco antigo. Liste com: sudo -u postgres psql -lqt | cut -d\"|\" -f1}"
[ "$(id -u)" = 0 ] || { echo "Rode como root."; exit 1; }
sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='$ANTIGO'" | grep -q 1 \
    || { echo "Banco '$ANTIGO' não existe."; exit 1; }
grep -q '^ADMIN_EMAIL=' /etc/parkflash/parkflash.env && { echo "Remova ADMIN_EMAIL do parkflash.env: os usuários vêm do sistema antigo."; exit 1; }

if [ "${CONFIRMAR:-}" != sim ]; then
    read -r -p "Isto APAGA o banco 'parkflash' e importa de '$ANTIGO'. Digite IMPORTAR para seguir: " ok
    [ "$ok" = IMPORTAR ] || { echo "Cancelado."; exit 1; }
fi

DATA=$(date +%F-%H%M)
echo "==> Backup do banco antigo → /root/backups/$ANTIGO-$DATA.dump"
sudo -u postgres pg_dump -Fc "$ANTIGO" > "/root/backups/$ANTIGO-$DATA.dump"
if sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='parkflash'" | grep -q 1; then
    echo "==> Backup do Park Flash atual → /root/backups/parkflash-$DATA.dump"
    sudo -u postgres pg_dump -Fc parkflash > "/root/backups/parkflash-$DATA.dump"
fi

echo "==> Recriando o banco 'parkflash' vazio"
systemctl stop parkflash || true
sudo -u postgres dropdb --if-exists parkflash
sudo -u postgres createdb -O parkflash parkflash

echo "==> Criando as tabelas (Flyway, sem dados de demonstração)"
systemctl start parkflash
for _ in $(seq 1 60); do
    [ "$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8081/api/fichas)" = 401 ] && break
    sleep 2
done
[ "$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8081/api/fichas)" = 401 ] \
    || { echo "A API não subiu. Veja: journalctl -u parkflash -n 80"; exit 1; }

echo "==> Importando"
# Pela entrada padrão: o usuário postgres não lê arquivos em /root
sudo -u postgres psql -d parkflash -v legado_db="$ANTIGO" -f - < "$AQUI/importar-hitmanpark.sql" \
    2>&1 | tee "/root/backups/importacao-$DATA.txt"

systemctl restart parkflash
echo
echo "Importação concluída. Relatório salvo em /root/backups/importacao-$DATA.txt"
