# Настройка Docker Compose

## Обзор

Проект настроен для запуска через Docker Compose со следующими компонентами:

- **Backend** (FastAPI) - порт 8000
- **React Frontend** - порт 8080
- **Legacy Frontend** (Nginx) - порт 3000
- **MCP Word Server** - порт 9000
- **База данных SQLite** - постоянное хранилище в volume

## Быстрый старт

### 1. Настройка переменных окружения

Создайте файл `.env` в корне проекта:

```bash
cp .env.example .env
```

Отредактируйте `.env` и укажите:
- `OPENAI_API_KEY` - ваш ключ OpenAI API
- `JWT_SECRET_KEY` - случайная строка для JWT (обязательно измените для продакшена)

### 2. Запуск всех сервисов

```bash
docker-compose up -d
```

### 3. Просмотр логов

```bash
# Все сервисы
docker-compose logs -f

# Конкретный сервис
docker-compose logs -f backend
docker-compose logs -f react-frontend
```

### 4. Остановка сервисов

```bash
docker-compose down
```

### 5. Остановка с удалением volumes (⚠️ удалит все данные)

```bash
docker-compose down -v
```

## Структура Volumes

Все данные хранятся в именованных volumes для постоянного хранения:

- `data-database` - база данных SQLite (`/data/database/app.db`)
- `data-uploads` - загруженные файлы (`/data/uploads/`)
- `data-outputs` - обработанные файлы (`/data/outputs/`)
- `data-backups` - резервные копии (`/data/backups/`)
- `data-logs` - логи приложения (`/data/logs/`)

## Просмотр volumes

```bash
# Список всех volumes
docker volume ls

# Информация о конкретном volume
docker volume inspect document-change-agent_data-database

# Просмотр содержимого (через временный контейнер)
docker run --rm -v document-change-agent_data-database:/data alpine ls -la /data
```

## Доступ к сервисам

После запуска сервисы будут доступны:

- **React Frontend**: http://localhost:8080
- **Legacy Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs
- **MCP Server**: http://localhost:9000

## Первый вход

1. Откройте http://localhost:8080/login2
2. Войдите с учетными данными администратора:
   - Логин: `admin` или `admin@example.com`
   - Пароль: `admin123`

## Пересборка образов

Если изменили код или зависимости:

```bash
# Пересборка всех образов
docker-compose build

# Пересборка конкретного сервиса
docker-compose build backend

# Пересборка и перезапуск
docker-compose up -d --build
```

## Разработка

Для разработки можно использовать `docker-compose.override.yml`:

```bash
cp docker-compose.override.yml.example docker-compose.override.yml
```

Это позволит:
- Монтировать код для hot-reload
- Использовать dev-режим для React

## Резервное копирование базы данных

```bash
# Создание бэкапа
docker run --rm \
  -v document-change-agent_data-database:/data \
  -v $(pwd)/backups:/backup \
  alpine tar czf /backup/db-backup-$(date +%Y%m%d-%H%M%S).tar.gz -C /data .

# Восстановление из бэкапа
docker run --rm \
  -v document-change-agent_data-database:/data \
  -v $(pwd)/backups:/backup \
  alpine sh -c "cd /data && rm -f * && tar xzf /backup/db-backup-YYYYMMDD-HHMMSS.tar.gz"
```

## Устранение проблем

### Очистка всех данных

```bash
# Остановка и удаление контейнеров, сетей и volumes
docker-compose down -v

# Удаление всех volumes проекта
docker volume rm document-change-agent_data-database \
  document-change-agent_data-uploads \
  document-change-agent_data-outputs \
  document-change-agent_data-backups \
  document-change-agent_data-logs
```

### Просмотр логов конкретного сервиса

```bash
docker-compose logs -f backend
docker-compose logs -f react-frontend
```

### Проверка состояния сервисов

```bash
docker-compose ps
```

### Перезапуск сервиса

```bash
docker-compose restart backend
```

### Выполнение команд в контейнере

```bash
# Backend
docker-compose exec backend bash

# React Frontend
docker-compose exec react-frontend sh
```

## Production

Для продакшена рекомендуется:

1. Изменить `JWT_SECRET_KEY` на случайную строку
2. Использовать внешнюю БД (PostgreSQL) вместо SQLite
3. Настроить HTTPS через reverse proxy (nginx/traefik)
4. Настроить мониторинг и логирование
5. Использовать secrets для чувствительных данных
6. Настроить backup стратегию

