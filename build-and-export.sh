#!/bin/bash
# build-and-export.sh - Сборка и экспорт Docker образов для передачи на сервер

set -e

echo "🔨 Сборка Docker образов..."

# Сборка всех образов
docker compose build

echo "📦 Сохранение образов..."

# Создать директорию
mkdir -p docker-images
cd docker-images

# Удалить старые файлы
rm -f *.tar *.tar.gz

echo "Сохранение образов проекта..."

# Сохранить образы проекта
if docker images | grep -q "document-change-agent-backend"; then
    echo "  - backend..."
    docker save document-change-agent-backend:latest -o backend.tar
fi

if docker images | grep -q "document-change-agent-react-frontend"; then
    echo "  - react-frontend..."
    docker save document-change-agent-react-frontend:latest -o react-frontend.tar
fi

if docker images | grep -q "document-change-agent-mcp-server"; then
    echo "  - mcp-server..."
    docker save document-change-agent-mcp-server:latest -o mcp-server.tar
fi

if docker images | grep -q "document-change-agent-frontend"; then
    echo "  - frontend..."
    docker save document-change-agent-frontend:latest -o frontend.tar
fi

echo "Сохранение базовых образов..."

# Сохранить базовые образы
if docker images | grep -q "postgres:16-alpine"; then
    echo "  - postgres:16-alpine..."
    docker save postgres:16-alpine -o postgres-16-alpine.tar
fi

if docker images | grep -q "nginx:alpine"; then
    echo "  - nginx:alpine..."
    docker save nginx:alpine -o nginx-alpine.tar
fi

echo "📚 Создание архива..."

# Создать архив
tar -czf docker-images.tar.gz *.tar

# Показать размеры
echo ""
echo "✅ Готово!"
echo "📊 Размеры файлов:"
ls -lh *.tar | awk '{print "  " $9 ": " $5}'
echo ""
echo "📦 Архив: $(pwd)/docker-images.tar.gz"
echo "   Размер: $(du -h docker-images.tar.gz | cut -f1)"
echo ""
echo "📤 Передайте на сервер:"
echo "   scp docker-images.tar.gz user@server:/tmp/"
echo ""
echo "📋 На сервере выполните:"
echo "   cd /tmp"
echo "   tar -xzf docker-images.tar.gz"
echo "   for file in *.tar; do docker load -i \$file; done"
echo "   cd ~/document-change-agent"
echo "   docker compose up -d"

