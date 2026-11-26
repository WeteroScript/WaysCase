FROM node:20-bookworm-slim
ENV NODE_ENV=production PORT=3000 DATA_DIR=/data
WORKDIR /app
COPY package.json package-lock.json ./
COPY server.mjs ./server.mjs
COPY lib ./lib
COPY public ./public
RUN mkdir -p /data && chown -R node:node /data
VOLUME ["/data"]
USER node
EXPOSE 3000
CMD ["node", "/app/server.mjs"]
