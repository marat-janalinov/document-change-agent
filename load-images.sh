#!/bin/bash
# load-images.sh - Загрузка Docker образов на сервере

set -e

ARCHIVE_PATH="${1:-/tmp/docker-images.tar.gz}"

if [ ! -f "$ARCHIVE_PATH" ]; then
    echo "❌ Файл $ARCHIVE_PATH не найден!"
    echo ""
    echo "Использование: $0 [путь_к_архиву]"
    echo "Пример: $0 /tmp/docker-images.tar.gz"
    exit 1
fi

echo "📥 Распаковка архива $ARCHIVE_PATH..."

# Создать временную директорию
TEMP_DIR=$(mktemp -d)
cd "$TEMP_DIR"

# Распаковать архив
tar -xzf "$ARCHIVE_PATH"

echo "📦 Загрузка образов в Docker..."
echo ""

# Загрузить все образы
for file in *.tar; do
    if [ -f "$file" ]; then
        echo "  Загрузка $file..."
        docker load -i "$file"
    fi
done

# Очистить временную директорию
cd /
rm -rf "$TEMP_DIR"

echo ""
echo "✅ Образы загружены!"
echo ""
echo "📋 Список загруженных образов:"
docker images | grep -E "document-change-agent|postgres|nginx" | head -10
echo ""
echo "🚀 Теперь можно запустить:"
echo "   cd ~/document-change-agent"
echo "   docker compose up -d"

