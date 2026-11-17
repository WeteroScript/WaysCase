FROM node:20-bookworm-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PORT=3000
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-venv supervisor ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY server.mjs ./server.mjs
COPY public ./public
COPY bot ./bot
COPY docker/supervisord.conf /etc/supervisor/conf.d/wayscase.conf
RUN python3 -m venv /opt/wayscase-venv && /opt/wayscase-venv/bin/pip install --no-cache-dir -r /app/bot/requirements.txt
EXPOSE 3000
CMD ["/usr/bin/supervisord","-n","-c","/etc/supervisor/supervisord.conf"]
