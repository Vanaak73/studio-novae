# Studio Novae : site construit puis servi par Node (voir build.js et server.js).
# Render fournit le port dans la variable PORT.
FROM node:22-alpine
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=10000

COPY package.json server.js build.js ./
COPY v4/ ./v4/
COPY assets/ ./assets/
RUN npm run build

USER node
EXPOSE 10000
CMD ["node", "server.js"]
