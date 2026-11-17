FROM node:20-bookworm-slim
ENV NODE_ENV=production PORT=3000
WORKDIR /app
COPY server.mjs ./server.mjs
COPY public ./public
EXPOSE 3000
CMD ["node", "/app/server.mjs"]
