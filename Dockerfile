# Aperçu Studio Novae sur Render : site statique servi par nginx (voir docker/).
FROM nginx:alpine

# Render fournit le port d'écoute dans la variable PORT (substituée dans le modèle au démarrage)
ENV PORT=10000
COPY docker/default.conf.template /etc/nginx/templates/default.conf.template

COPY v4/ /usr/share/nginx/html/
COPY assets/ /usr/share/nginx/html/assets/

EXPOSE 10000
