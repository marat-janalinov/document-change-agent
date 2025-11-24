#!/bin/bash

# Цвета для вывода
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║    Document Change Agent - Quick Start Script         ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

# Проверка Docker
echo -e "${YELLOW}[1/5]${NC} Проверка Docker..."
if ! command -v docker &> /dev/null; then
    echo -e "${RED}✗ Docker не установлен${NC}"
    echo "Установите Docker: https://docs.docker.com/get-docker/"
    exit 1
fi
echo -e "${GREEN}✓ Docker установлен${NC}"

# Проверка Docker Compose
echo -e "${YELLOW}[2/5]${NC} Проверка Docker Compose..."
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}✗ Docker Compose не установлен${NC}"
    echo "Установите Docker Compose: https://docs.docker.com/compose/install/"
    exit 1
fi
echo -e "${GREEN}✓ Docker Compose установлен${NC}"

# Проверка .env файла
echo -e "${YELLOW}[3/5]${NC} Проверка конфигурации..."
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠ Файл .env не найден${NC}"
    echo "Создание .env из .env.example..."
    cp .env.example .env
    echo ""
    echo -e "${RED}ВАЖНО: Отредактируйте .env и добавьте ваш OPENAI_API_KEY${NC}"
    echo ""
    read -p "Нажмите Enter после редактирования .env файла..."
fi

# Проверка API ключа
if ! grep -qE '^OPENAI_API_KEY=sk-' .env; then
    echo -e "${RED}✗ OPENAI_API_KEY не установлен или имеет неверный формат в .env${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Конфигурация готова${NC}"

# Создание директорий
echo -e "${YELLOW}[4/5]${NC} Создание директорий..."
mkdir -p data/{uploads,outputs,backups,logs}
chmod -R 777 data/
echo -e "${GREEN}✓ Директории созданы${NC}"

# Запуск сервисов
echo -e "${YELLOW}[5/5]${NC} Запуск сервисов..."
echo ""
echo "Это может занять несколько минут при первом запуске..."
echo ""

docker-compose up --build -d

# Проверка статуса
echo ""
echo -e "${YELLOW}Проверка статуса сервисов...${NC}"
sleep 5

if docker-compose ps | grep -q "Up"; then
    echo -e "${GREEN}✓ Сервисы запущены успешно!${NC}"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${GREEN}🎉 Document Change Agent готов к использованию!${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo -e "🌐 Веб-интерфейс: ${GREEN}http://localhost:3000${NC}"
    echo -e "📡 API Backend:   ${GREEN}http://localhost:8000${NC}"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "📋 Полезные команды:"
    echo ""
    echo "  Просмотр логов:     docker-compose logs -f"
    echo "  Остановка:          docker-compose down"
    echo "  Перезапуск:         docker-compose restart"
    echo ""
    echo "📖 Подробнее: см. QUICKSTART.md"
    echo ""
else
    echo -e "${RED}✗ Ошибка запуска сервисов${NC}"
    echo "Проверьте логи: docker-compose logs"
    exit 1
fi
