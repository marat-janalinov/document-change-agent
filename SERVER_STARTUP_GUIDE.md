# 🚀 Полная инструкция по запуску проекта на сервере Ubuntu

**Дата:** 2025-11-24  
**Версия:** 1.0

---

## 📋 Предварительные требования

- Ubuntu Server 20.04+ (рекомендуется 22.04 LTS)
- Docker 20.10+
- Docker Compose 2.0+
- Git
- Доступ к серверу по SSH

---

## 🔧 Пошаговая инструкция

### Шаг 1: Подключение к серверу

```bash
ssh user@your-server-ip
```

---

### Шаг 2: Установка Docker и Docker Compose (если не установлены)

```bash
# Обновление системы
sudo apt update && sudo apt upgrade -y

# Установка Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Добавить пользователя в группу docker
sudo usermod -aG docker $USER
newgrp docker

# Установка Docker Compose
sudo apt install docker-compose-plugin -y

# Проверка установки
docker --version
docker compose version
```

---

### Шаг 3: Клонирование проекта

```bash
# Перейти в домашнюю директорию
cd ~

# Клонировать репозиторий
git clone https://github.com/marat-janalinov/document-change-agent.git
cd document-change-agent
```

---

### Шаг 4: Настройка окружения

```bash
# Создать файл .env (если его нет)
cp .env.example .env 2>/dev/null || nano .env

# Отредактировать .env файл
nano .env
```

**Минимальные настройки в .env:**
```env
# OpenAI API Key
OPENAI_API_KEY=sk-proj-...

# Database
POSTGRES_DB=document_agent
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your-secure-password
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
DATABASE_URL=postgresql://postgres:your-secure-password@postgres:5432/document_agent

# JWT
JWT_SECRET_KEY=your-secret-key-change-in-production

# Data directories
DATA_DIR=/data

# Model
OPENAI_MODEL=gpt-4o

# MCP Server
MCP_SERVER_HOST=mcp-server
MCP_SERVER_PORT=8000
```

---

### Шаг 5: Подготовка директорий

```bash
# Создать директории для данных
mkdir -p ./data/{uploads,outputs,backups,logs,prompts}

# Установить права
chmod -R 755 ./data/
```

---

### Шаг 6: Подготовка mcp-server (клонирование репозитория)

```bash
# Перейти в директорию mcp-server
cd mcp-server

# Клонировать репозиторий Office-Word-MCP-Server
git clone https://github.com/GongRzhe/Office-Word-MCP-Server.git Office-Word-MCP-Server

# Проверить, что клонировалось
ls -la Office-Word-MCP-Server/ | head -10

# Вернуться в корень проекта
cd ..
```

---

### Шаг 7: Запуск проекта

#### Вариант A: Запуск с автоматической сборкой (если образы еще не собраны)

```bash
# Остановить все контейнеры (если запущены)
docker compose down

# Собрать и запустить все сервисы
docker compose up --build -d

# Проверить статус
docker compose ps
```

#### Вариант B: Запуск без сборки (если образы уже собраны)

```bash
# Просто запустить
docker compose up -d

# Проверить статус
docker compose ps
```

---

### Шаг 8: Проверка работы

```bash
# Проверить логи всех сервисов
docker compose logs --tail 50

# Проверить конкретный сервис
docker compose logs backend --tail 50
docker compose logs react-frontend --tail 50
docker compose logs mcp-server --tail 50

# Проверить health check
curl http://localhost:8000/health

# Проверить доступность frontend
curl http://localhost:8080
```

---

### Шаг 9: Проверка портов

```bash
# Проверить, какие порты слушают
sudo netstat -tlnp | grep -E "8000|8080|9000|5432"

# Или через ss
sudo ss -tlnp | grep -E "8000|8080|9000|5432"
```

**Ожидаемые порты:**
- `8000` - Backend API
- `8080` - React Frontend
- `9000` - MCP Server
- `5432` - PostgreSQL (внутренний)

---

## 🔍 Диагностика проблем

### Проблема: Контейнеры не запускаются

```bash
# Проверить логи
docker compose logs

# Проверить статус
docker compose ps -a

# Перезапустить
docker compose restart
```

### Проблема: Ошибки при сборке

```bash
# Очистить все и пересобрать
docker compose down
docker system prune -a
docker compose build --no-cache
docker compose up -d
```

### Проблема: Проблемы с базой данных

```bash
# Проверить логи PostgreSQL
docker compose logs postgres

# Проверить подключение
docker compose exec postgres psql -U postgres -d document_agent -c "SELECT version();"
```

### Проблема: Проблемы с SSL/сетью

Если есть проблемы с SSL при сборке, используйте вариант с локальной сборкой образов (см. `BUILD_IMAGES_LOCALLY.md`).

---

## 📊 Проверка работоспособности

### 1. Проверка Backend

```bash
# Health check
curl http://localhost:8000/health

# Должен вернуть:
# {"status":"healthy","timestamp":"...","agent_initialized":true}
```

### 2. Проверка Frontend

```bash
# Открыть в браузере
# http://your-server-ip:8080

# Или через curl
curl http://localhost:8080
```

### 3. Проверка MCP Server

```bash
# Проверить логи
docker compose logs mcp-server --tail 20

# Проверить доступность
curl http://localhost:9000/health 2>/dev/null || echo "MCP Server может не иметь /health endpoint"
```

### 4. Проверка базы данных

```bash
# Подключиться к базе
docker compose exec postgres psql -U postgres -d document_agent

# В psql выполнить:
# \dt  -- список таблиц
# SELECT * FROM users;  -- проверить пользователей
# \q  -- выйти
```

---

## 🔄 Обновление проекта

### Обновление кода

```bash
cd ~/document-change-agent

# Получить обновления
git pull origin main

# Если есть конфликты в Dockerfile
git checkout -- mcp-server/Dockerfile
git pull origin main

# Обновить репозиторий Office-Word-MCP-Server (если нужно)
cd mcp-server/Office-Word-MCP-Server
git pull origin main
cd ../..

# Пересобрать и перезапустить
docker compose down
docker compose build --no-cache
docker compose up -d
```

---

## 🛑 Остановка проекта

```bash
# Остановить все контейнеры
docker compose down

# Остановить и удалить volumes (ОСТОРОЖНО - удалит данные!)
docker compose down -v
```

---

## 🔄 Перезапуск проекта

```bash
# Перезапустить все сервисы
docker compose restart

# Или остановить и запустить заново
docker compose down
docker compose up -d
```

---

## 📝 Полезные команды

### Просмотр логов

```bash
# Все сервисы
docker compose logs -f

# Конкретный сервис
docker compose logs -f backend

# Последние 100 строк
docker compose logs --tail 100
```

### Вход в контейнер

```bash
# Backend
docker compose exec backend bash

# PostgreSQL
docker compose exec postgres psql -U postgres -d document_agent

# MCP Server
docker compose exec mcp-server bash
```

### Проверка использования ресурсов

```bash
# Использование ресурсов контейнерами
docker stats

# Использование диска
docker system df
```

### Очистка

```bash
# Остановить и удалить контейнеры
docker compose down

# Удалить неиспользуемые образы
docker image prune -a

# Полная очистка (ОСТОРОЖНО!)
docker system prune -a --volumes
```

---

## 🔐 Безопасность

### Настройка файрвола

```bash
# Разрешить только необходимые порты
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 8080/tcp  # Frontend
sudo ufw allow 8000/tcp  # Backend (если нужен прямой доступ)

# Включить файрвол
sudo ufw enable
sudo ufw status
```

### Изменение паролей по умолчанию

**В .env файле измените:**
- `POSTGRES_PASSWORD` - пароль базы данных
- `JWT_SECRET_KEY` - секретный ключ для JWT
- Пароли пользователей в админ-панели

---

## 📊 Мониторинг

### Проверка статуса сервисов

```bash
# Статус всех контейнеров
docker compose ps

# Должно быть:
# - Все контейнеры в статусе "Up"
# - Backend: healthy
# - PostgreSQL: healthy
```

### Проверка логов на ошибки

```bash
# Поиск ошибок в логах
docker compose logs | grep -i error
docker compose logs | grep -i warning
```

---

## 🎯 Быстрый старт (краткая версия)

```bash
# 1. Клонировать проект
cd ~
git clone https://github.com/marat-janalinov/document-change-agent.git
cd document-change-agent

# 2. Настроить .env
nano .env  # Заполнить OPENAI_API_KEY и другие параметры

# 3. Создать директории
mkdir -p ./data/{uploads,outputs,backups,logs,prompts}

# 4. Подготовить mcp-server
cd mcp-server
git clone https://github.com/GongRzhe/Office-Word-MCP-Server.git Office-Word-MCP-Server
cd ..

# 5. Запустить
docker compose up --build -d

# 6. Проверить
docker compose ps
curl http://localhost:8000/health
```

---

## ✅ Чеклист запуска

- [ ] Docker и Docker Compose установлены
- [ ] Проект клонирован из GitHub
- [ ] Файл .env настроен (OPENAI_API_KEY и другие параметры)
- [ ] Директории data созданы
- [ ] Репозиторий Office-Word-MCP-Server клонирован
- [ ] Контейнеры запущены (`docker compose up -d`)
- [ ] Все контейнеры в статусе "Up" (`docker compose ps`)
- [ ] Backend отвечает на health check
- [ ] Frontend доступен на порту 8080
- [ ] Нет ошибок в логах

---

## 🆘 Решение проблем

### Проблема: "Cannot connect to Docker daemon"

```bash
# Добавить пользователя в группу docker
sudo usermod -aG docker $USER
newgrp docker

# Или использовать sudo
sudo docker compose up -d
```

### Проблема: "Port already in use"

```bash
# Найти процесс, использующий порт
sudo lsof -i :8000
sudo lsof -i :8080

# Остановить процесс или изменить порт в docker-compose.yml
```

### Проблема: "Permission denied" для data директорий

```bash
# Установить правильные права
sudo chown -R $USER:$USER ./data/
chmod -R 755 ./data/
```

---

## 📚 Дополнительная документация

- `DEPLOYMENT_UBUNTU.md` - Подробная инструкция по развертыванию
- `BUILD_IMAGES_LOCALLY.md` - Сборка образов локально
- `MCP_SERVER_SETUP.md` - Настройка mcp-server
- `USER_GUIDE.md` - Руководство пользователя

---

**Версия:** 1.0  
**Дата:** 2025-11-24

