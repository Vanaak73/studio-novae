# Studio Novae : site servi par Node (voir server.js). Render fournit le port dans PORT.
FROM node:22-alpine
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=10000

COPY package.json server.js ./
COPY v4/ ./v4/
COPY assets/ ./assets/

USER node
EXPOSE 10000
CMD ["node", "server.js"]
