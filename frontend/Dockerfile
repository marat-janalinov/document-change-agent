FROM nginx:alpine

# Копирование статических файлов
COPY index.html /usr/share/nginx/html/
COPY static/ /usr/share/nginx/html/static/

# Копирование конфигурации nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
