# Studio Novae : site généré et servi par Node (voir server.js et src/). Render fournit le port dans la variable PORT.
FROM node:22-alpine
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=10000

COPY package.json server.js ./
COPY src/ ./src/
COPY public_html/ ./public_html/

USER node
EXPOSE 10000
CMD ["node", "server.js"]
