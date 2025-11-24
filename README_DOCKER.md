# Docker Compose Setup

## Быстрый старт

1. **Создайте файл `.env`**:
```bash
cp .env.example .env
```

2. **Заполните переменные окружения** в `.env`:
```env
OPENAI_API_KEY=your-openai-api-key-here
JWT_SECRET_KEY=your-secret-key-change-in-production
```

3. **Запустите все сервисы**:
```bash
docker-compose up -d
```

4. **Откройте приложение**:
   - React Frontend: http://localhost:8080
   - Legacy Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - API Docs: http://localhost:8000/docs

## Первый вход

- **URL**: http://localhost:8080/login2
- **Логин**: `admin` или `admin@example.com`
- **Пароль**: `admin123`

## Структура Volumes

Все данные хранятся в именованных volumes:

- `data-database` - база данных SQLite
- `data-uploads` - загруженные файлы
- `data-outputs` - обработанные файлы
- `data-backups` - резервные копии
- `data-logs` - логи

## Полезные команды

```bash
# Просмотр логов
docker-compose logs -f

# Остановка
docker-compose down

# Пересборка
docker-compose build

# Перезапуск
docker-compose restart
```

Подробнее см. [DOCKER_SETUP.md](./DOCKER_SETUP.md)

