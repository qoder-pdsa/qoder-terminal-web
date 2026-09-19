#!/usr/bin/env bash
# HTTPS for the Qoder Terminal gateway (run as root on qoder-terminal-app; not exposed through the ssh gate)
#
#   tls.sh issue    obtain/renew the Let's Encrypt certificate for qoder.live + www.qoder.live (HTTP-01 via /var/www/acme)
#   tls.sh enable   install the TLS server blocks from deploy/tls/ into /opt/qoder-terminal/tls and reload the gateway
#   tls.sh status   certificate expiry and enabled server blocks
#
# The domain must already resolve to this host. Renewal runs from /etc/cron.d/qoder-terminal-certbot (installed by `issue`).
set -euo pipefail
ROOT=${QT_ROOT:-/opt/qoder-terminal}
HERE=$(dirname "$(readlink -f "$0")")
DOMAIN=${QT_DOMAIN:-qoder.live}
EMAIL=${QT_ACME_EMAIL:-}
WEB=${QT_WEB_CONTAINER:-qoder-terminal-web-1}

reload() { docker exec "$WEB" nginx -t >/dev/null 2>&1 && docker exec "$WEB" nginx -s reload && echo "gateway reloaded"; }

case "${1:-}" in
  issue)
    install -d -m 755 /var/www/acme
    certbot certonly --webroot -w /var/www/acme -d "$DOMAIN" -d "www.$DOMAIN" \
      --non-interactive --agree-tos ${EMAIL:+--email "$EMAIL"} ${EMAIL:---register-unsafely-without-email} --keep-until-expiring
    printf '%s\n' "SHELL=/bin/bash" \
      "17 3 * * * root certbot renew --quiet --deploy-hook 'docker exec $WEB nginx -s reload'" > /etc/cron.d/qoder-terminal-certbot
    echo "certificate ready; next: tls.sh enable" ;;
  enable)
    [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ] || { echo "no certificate for $DOMAIN; run tls.sh issue first" >&2; exit 1; }
    install -d -m 755 "$ROOT/tls"
    install -m 644 "$HERE/tls/$DOMAIN.server.conf" "$HERE/tls/$DOMAIN.redirect.conf" "$ROOT/tls/"
    reload || { echo "nginx rejected the TLS config; disabling it again" >&2; rm -f "$ROOT/tls/"*.conf; reload; exit 1; } ;;
  status)
    certbot certificates 2>/dev/null | grep -E "Certificate Name|Domains|Expiry" || echo "no certificates"
    ls -l "$ROOT/tls" 2>/dev/null || echo "TLS not enabled" ;;
  *) sed -n '2,9p' "$0"; exit 2 ;;
esac
