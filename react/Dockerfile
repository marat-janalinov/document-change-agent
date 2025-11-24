# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Копирование package files
COPY package*.json ./
COPY bun.lockb* ./

    # Установка зависимостей
    RUN npm install

# Копирование исходного кода
COPY . .

# Сборка приложения
RUN npm run build

# Production stage
FROM nginx:alpine

# Копирование собранного приложения
COPY --from=builder /app/dist /usr/share/nginx/html

# Копирование конфигурации nginx для SPA
RUN echo 'server { \
    listen 80; \
    server_name localhost; \
    root /usr/share/nginx/html; \
    index index.html; \
    \
    # Отключение ETag для всех запросов \
    etag off; \
    \
    # Отключение кэширования для index.html \
    location = /index.html { \
        add_header Cache-Control "no-cache, no-store, must-revalidate, max-age=0"; \
        add_header Pragma "no-cache"; \
        add_header Expires "0"; \
        add_header Last-Modified ""; \
        add_header ETag ""; \
        try_files $uri =404; \
    } \
    \
    # Кэширование статических ресурсов \
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ { \
        expires 1y; \
        add_header Cache-Control "public, immutable"; \
    } \
    \
    # Обработка всех маршрутов SPA \
    location / { \
        try_files $uri $uri/ /index.html; \
        add_header Cache-Control "no-cache, no-store, must-revalidate, max-age=0"; \
        add_header Pragma "no-cache"; \
        add_header Expires "0"; \
        add_header Last-Modified ""; \
        add_header ETag ""; \
    } \
    \
    # Проксирование API запросов \
    location /api { \
        proxy_pass http://backend:8000; \
        proxy_http_version 1.1; \
        proxy_set_header Upgrade $http_upgrade; \
        proxy_set_header Connection "upgrade"; \
        proxy_set_header Host $host; \
        proxy_set_header X-Real-IP $remote_addr; \
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; \
        proxy_set_header X-Forwarded-Proto $scheme; \
        proxy_cache_bypass $http_upgrade; \
        proxy_connect_timeout 600s; \
        proxy_send_timeout 600s; \
        proxy_read_timeout 600s; \
        proxy_buffering off; \
        send_timeout 600s; \
        client_max_body_size 100M; \
    } \
    \
    # Проксирование WebSocket \
    location /ws { \
        proxy_pass http://backend:8000; \
        proxy_http_version 1.1; \
        proxy_set_header Upgrade $http_upgrade; \
        proxy_set_header Connection "upgrade"; \
        proxy_set_header Host $host; \
        proxy_set_header X-Real-IP $remote_addr; \
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; \
        proxy_set_header X-Forwarded-Proto $scheme; \
        proxy_cache_bypass $http_upgrade; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

