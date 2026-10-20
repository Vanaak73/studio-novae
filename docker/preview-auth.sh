#!/bin/sh
# Sans mot de passe, le service REFUSE de démarrer (l'aperçu ne doit jamais être public).
set -e

if [ -z "$PREVIEW_PASSWORD" ] || [ "${#PREVIEW_PASSWORD}" -lt 12 ]; then
    echo "ERREUR : la variable PREVIEW_PASSWORD (12 caracteres minimum) est obligatoire. Demarrage refuse : l'apercu ne doit pas etre public." >&2
    exit 1
fi

printf '%s:%s\n' "${PREVIEW_USER:-apercu}" "$(openssl passwd -apr1 "$PREVIEW_PASSWORD")" > /etc/nginx/preview.htpasswd
chmod 644 /etc/nginx/preview.htpasswd
