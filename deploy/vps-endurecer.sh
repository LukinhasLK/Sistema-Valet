#!/usr/bin/env bash
# Roda na VPS, como root. Endurece a produção sem mexer no SSH nem nos dados:
#   1. Backup diário do banco parkflash (03:00, guarda 14 dias em /root/backups/diario)
#   2. Limite de tentativas no login (10/min por IP) e cabeçalhos de segurança no nginx
#   3. fail2ban para o SSH (5 erros em 10 min = 1 h bloqueado)
# O nginx é validado antes de recarregar; se a configuração nova for inválida, a original volta.
# Pode ser rodado de novo sem efeito colateral.
#   ./vps-endurecer.sh
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "Rode como root."; exit 1; }
CONF="${CONF:-/etc/nginx/sites-available/parkflash-producao}"
[ -f "$CONF" ] || { echo "Não achei $CONF (a virada já foi feita?)."; exit 1; }

# ---------- 1. Backup diário ----------
cat > /usr/local/bin/parkflash-backup.sh <<'S'
#!/usr/bin/env bash
# Backup diário do banco parkflash. Mantém 14 dias em /root/backups/diario.
set -euo pipefail
DEST=/root/backups/diario
install -d -m 700 "$DEST"
ARQ="$DEST/parkflash-$(date +%F-%H%M).dump"
sudo -u postgres pg_dump -Fc parkflash > "$ARQ.parcial"
mv "$ARQ.parcial" "$ARQ"
chmod 600 "$ARQ"
find "$DEST" -name 'parkflash-*.dump' -mtime +14 -delete
logger -t parkflash-backup "ok $(basename "$ARQ") $(du -h "$ARQ" | cut -f1)"
S
chmod 750 /usr/local/bin/parkflash-backup.sh
echo '0 3 * * * root /usr/local/bin/parkflash-backup.sh' > /etc/cron.d/parkflash-backup
chmod 644 /etc/cron.d/parkflash-backup
/usr/local/bin/parkflash-backup.sh
ls -lh /root/backups/diario

# ---------- 2. nginx: limite de login + cabeçalhos ----------
cp -p "$CONF" "/root/backups/nginx-parkflash-producao-antes-endurecimento-$(date +%F-%H%M).conf"
ULTIMA=$(ls -t /root/backups/nginx-parkflash-producao-antes-endurecimento-*.conf | head -1)
cat > /etc/nginx/conf.d/parkflash-limites.conf <<'S'
# Limite de tentativas de login: 10 por minuto por IP (rajada de 5)
limit_req_zone $binary_remote_addr zone=parkflash_login:10m rate=10r/m;
limit_req_status 429;
S
install -d /etc/nginx/snippets
cat > /etc/nginx/snippets/parkflash-seguranca.conf <<'S'
add_header Strict-Transport-Security "max-age=31536000" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
S
python3 - "$CONF" <<'PY'
import sys, re
p = sys.argv[1]; s = open(p).read()
inc = "include snippets/parkflash-seguranca.conf;"
if inc in s:
    sys.exit(0)
login = '''    location = /api/auth/login {
        limit_req zone=parkflash_login burst=5 nodelay;
        proxy_pass http://127.0.0.1:8081;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
        ''' + inc + '''
    }

'''
s = s.replace("    # Só /api vai para o Spring Boot", login + "    # Só /api vai para o Spring Boot", 1)
# add_header dentro de um location zera a herança do servidor: repete o include nesses blocos
s = s.replace("    client_max_body_size 3m;", "    " + inc + "\n    client_max_body_size 3m;", 1)
s = re.sub(r'(location [^\n]*\{ )(add_header Cache-Control "no-cache";)', r'\1' + inc + r' \2', s)
s = s.replace('        add_header Cache-Control "public, immutable";', '        add_header Cache-Control "public, immutable";\n        ' + inc)
open(p, "w").write(s)
PY
if nginx -t; then
    systemctl reload nginx
    echo "nginx recarregado."
else
    cp -p "$ULTIMA" "$CONF"; rm -f /etc/nginx/conf.d/parkflash-limites.conf
    nginx -t && systemctl reload nginx
    echo "Configuração inválida — a original foi restaurada."; exit 1
fi

# ---------- 3. fail2ban (SSH) ----------
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq fail2ban >/dev/null
cat > /etc/fail2ban/jail.d/parkflash.local <<'S'
[sshd]
enabled = true
maxretry = 5
findtime = 10m
bantime = 1h
S
systemctl enable --now fail2ban >/dev/null 2>&1
systemctl restart fail2ban
sleep 2
fail2ban-client status sshd | head -5
echo
echo "Pronto. Para desfazer o nginx: cp $ULTIMA $CONF && rm /etc/nginx/conf.d/parkflash-limites.conf && systemctl reload nginx"
