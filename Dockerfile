# Build the Vite frontend. The TypeScript config is loaded by Vite,
# never executed directly by Node.
FROM node:20-alpine AS frontend-build
WORKDIR /app/web
COPY web/package*.json ./
RUN npm install --no-audit --no-fund
COPY web/ ./
RUN npm run build

# Runtime: FastAPI serves both the API and the compiled frontend.
FROM python:3.11-slim AS runtime
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    WEB_DIST_DIR=/app/web/dist
WORKDIR /app/bot

RUN apt-get update \
    && apt-get install -y --no-install-recommends supervisor \
    && rm -rf /var/lib/apt/lists/*

COPY bot/requirements.txt /app/bot/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY bot/ /app/bot/
COPY --from=frontend-build /app/web/dist /app/web/dist
COPY docker/supervisord.conf /etc/supervisor/conf.d/wayscase.conf

EXPOSE 8000
STOPSIGNAL SIGTERM

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD python -c "from urllib.request import urlopen; urlopen('http://127.0.0.1:8000/api/health', timeout=3).read()" || exit 1

CMD ["/usr/bin/supervisord", "-n", "-c", "/etc/supervisor/supervisord.conf"]
