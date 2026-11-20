#!/bin/sh
set -e

PORT="${PORT:-8000}"

# Bind Apache dynamically to the container platform's PORT (Render=10000, Koyeb=8000, Railway=$PORT)
sed -i "s/^Listen .*/Listen ${PORT}/" /etc/apache2/ports.conf
sed -i "s/<VirtualHost \*:.*>/<VirtualHost *:${PORT}>/" /etc/apache2/sites-available/000-default.conf

# Ensure upload & storage directories remain writable
mkdir -p /var/www/html/backend/public/uploads /var/www/html/backend/storage
chown -R www-data:www-data /var/www/html/backend/public/uploads /var/www/html/backend/storage

exec apache2-foreground
