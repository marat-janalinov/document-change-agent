# 🔧 Исправленный Dockerfile для mcp-server

**Дата:** 2025-11-24  
**Проблема:** На сервере старая версия Dockerfile без исправлений для SSL

---

## ✅ Правильный Dockerfile

**Скопируйте это содержимое в `mcp-server/Dockerfile` на сервере:**

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Установка системных зависимостей И обновление ca-certificates
RUN apt-get update && apt-get install -y \
    git \
    ca-certificates \
    openssl \
    && rm -rf /var/lib/apt/lists/* \
    && update-ca-certificates

# Обновление pip и certifi для Python (с отключением SSL проверки для обновления)
RUN pip install --trusted-host pypi.org --trusted-host files.pythonhosted.org --upgrade pip certifi

# Клонирование Office-Word-MCP-Server
RUN git clone https://github.com/GongRzhe/Office-Word-MCP-Server.git .

# Установка Python зависимостей с доверенными хостами (для решения проблем с SSL)
RUN pip install --trusted-host pypi.org --trusted-host files.pythonhosted.org --no-cache-dir -r requirements.txt

# Создание директорий для данных
RUN mkdir -p /data/uploads /data/outputs /data/backups

# Порт для MCP сервера
EXPOSE 8000

# Запуск MCP сервера
CMD ["python", "word_mcp_server.py"]
```

---

## 📋 Что нужно сделать на сервере

### Вариант 1: Обновить через git (РЕКОМЕНДУЕТСЯ)

```bash
cd ~/document-change-agent
git pull origin main
cat mcp-server/Dockerfile
```

### Вариант 2: Вручную отредактировать

```bash
cd ~/document-change-agent/mcp-server
nano Dockerfile
```

**Замените содержимое на правильную версию (см. выше).**

---

## 🔍 Ключевые отличия от старой версии

1. ✅ Добавлен `openssl` в установку пакетов
2. ✅ Добавлено обновление pip и certifi с `--trusted-host`
3. ✅ Добавлен `--trusted-host` для установки зависимостей
4. ✅ Используется `git clone` вместо `COPY` (если репозиторий не клонирован на хосте)

---

## ⚠️ Если используете COPY вместо git clone

Если на сервере уже есть клонированный репозиторий, можно использовать:

```dockerfile
# Вместо git clone
COPY Office-Word-MCP-Server/ .
```

Но тогда нужно сначала клонировать репозиторий на хосте:
```bash
cd ~/document-change-agent/mcp-server
git clone https://github.com/GongRzhe/Office-Word-MCP-Server.git Office-Word-MCP-Server
```

---

**Версия:** 1.0  
**Дата:** 2025-11-24

