# ==============================================================================
# Stage 1: Build optimized React + Vite PWA static bundle
# ==============================================================================
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ==============================================================================
# Stage 2: Production PHP 8.3 + Apache server (Render, Koyeb, Railway compatible)
# ==============================================================================
FROM php:8.3-apache

# Install MySQL PDO extension & CA certificates (required for TiDB Cloud TLS)
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && docker-php-ext-install -j"$(nproc)" pdo pdo_mysql \
    && a2enmod rewrite headers deflate \
    && rm -rf /var/lib/apt/lists/*

# PHP production tuning for fast uploads & JSON responses
RUN { \
      echo "upload_max_filesize=20M"; \
      echo "post_max_size=25M"; \
      echo "memory_limit=256M"; \
      echo "max_execution_time=180"; \
      echo "expose_php=Off"; \
    } > /usr/local/etc/php/conf.d/kampango.ini

WORKDIR /var/www/html

# Copy backend + built frontend bundle
COPY backend/ /var/www/html/backend/
COPY --from=frontend-builder /app/frontend/dist /var/www/html/frontend/dist

# Ensure writable runtime directories & strip any local dev .env/stamp files
RUN rm -f /var/www/html/backend/.env /var/www/html/backend/storage/schema_stamp.json \
    && mkdir -p /var/www/html/backend/public/uploads /var/www/html/backend/storage \
    && chown -R www-data:www-data /var/www/html/backend/public/uploads /var/www/html/backend/storage \
    && chmod -R 775 /var/www/html/backend/public/uploads /var/www/html/backend/storage

# Apache virtual host pointing to backend/public (single-origin PWA + /api + /uploads)
COPY docker/apache-vhost.conf /etc/apache2/sites-available/000-default.conf
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN sed -i 's/\r$//' /usr/local/bin/entrypoint.sh && chmod +x /usr/local/bin/entrypoint.sh

ENV PORT=8000
EXPOSE 8000

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
