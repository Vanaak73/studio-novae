# Aperçu Studio Novae sur Render : site statique servi par nginx, protégé par mot de passe (voir docker/).
FROM nginx:alpine

RUN apk add --no-cache openssl

# Render fournit le port d'écoute dans la variable PORT (substituée dans le modèle au démarrage)
ENV PORT=10000
COPY docker/default.conf.template /etc/nginx/templates/default.conf.template
COPY docker/preview-auth.sh /docker-entrypoint.d/40-preview-auth.sh
RUN chmod +x /docker-entrypoint.d/40-preview-auth.sh

COPY index.html style.css /usr/share/nginx/html/
COPY assets/ /usr/share/nginx/html/assets/

EXPOSE 10000
