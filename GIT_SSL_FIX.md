# 🔧 Исправление ошибки Git SSL: certificate signer not trusted

**Дата:** 2025-11-24  
**Ошибка:** `fatal: unable to access 'https://github.com/...': server verification failed: certificate signer not trusted`

---

## 🔍 Анализ проблемы

Ошибка возникает при клонировании репозитория GitHub в Docker контейнере. Это проблема с SSL сертификатами в базовом образе.

**Причина:** В образе `python:3.11-slim` отсутствуют или устарели SSL сертификаты для проверки GitHub.

---

## ✅ Рекомендации по исправлению

### Рекомендация 1: Обновить ca-certificates в Dockerfile (РЕКОМЕНДУЕТСЯ)

**Измените `mcp-server/Dockerfile`:**

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Установка системных зависимостей И обновление ca-certificates
RUN apt-get update && apt-get install -y \
    git \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && update-ca-certificates

# Клонирование Office-Word-MCP-Server
RUN git clone https://github.com/GongRzhe/Office-Word-MCP-Server.git .

# Остальное...
```

**Ключевые изменения:**
- Добавлен `ca-certificates` в установку
- Добавлен `update-ca-certificates` для обновления сертификатов
- Сертификаты обновляются ДО клонирования репозитория

---

### Рекомендация 2: Использовать временное отключение проверки SSL (НЕ РЕКОМЕНДУЕТСЯ для production)

**Если нужно быстрое решение (только для тестирования):**

```dockerfile
# ВРЕМЕННОЕ РЕШЕНИЕ - отключение проверки SSL
RUN git -c http.sslVerify=false clone https://github.com/GongRzhe/Office-Word-MCP-Server.git .
```

**⚠️ ВНИМАНИЕ:** Это небезопасно и не должно использоваться в production!

---

### Рекомендация 3: Использовать SSH вместо HTTPS

**Если у вас настроен SSH доступ к GitHub:**

```dockerfile
# Использование SSH (требует настройки SSH ключей)
RUN git clone git@github.com:GongRzhe/Office-Word-MCP-Server.git .
```

**Требуется:**
- Настройка SSH ключей в Dockerfile
- Добавление SSH ключа в Docker build context

---

### Рекомендация 4: Клонировать репозиторий на хосте и копировать в образ

**Альтернативный подход:**

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Установка системных зависимостей
RUN apt-get update && apt-get install -y \
    git \
    && rm -rf /var/lib/apt/lists/*

# Копирование репозитория с хоста (клонируйте на хосте)
COPY Office-Word-MCP-Server/ .

# Остальное...
```

**На хосте:**
```bash
# Клонировать репозиторий на хост
cd mcp-server
git clone https://github.com/GongRzhe/Office-Word-MCP-Server.git Office-Word-MCP-Server

# Затем собрать образ
docker compose build mcp-server
```

---

### Рекомендация 5: Использовать более свежий базовый образ

**Обновить базовый образ:**

```dockerfile
# Использовать более свежий образ
FROM python:3.11-slim-bookworm

# Или последний stable
FROM python:3.11
```

---

## 🔧 Рекомендуемое решение

### Вариант 1: Обновление ca-certificates (ЛУЧШИЙ)

**Измените `mcp-server/Dockerfile`:**

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Установка системных зависимостей
RUN apt-get update && apt-get install -y \
    git \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Обновление SSL сертификатов
RUN update-ca-certificates

# Клонирование Office-Word-MCP-Server
RUN git clone https://github.com/GongRzhe/Office-Word-MCP-Server.git .

# Установка Python зависимостей
RUN pip install --no-cache-dir -r requirements.txt

# Создание директорий для данных
RUN mkdir -p /data/uploads /data/outputs /data/backups

# Порт для MCP сервера
EXPOSE 8000

# Запуск MCP сервера
CMD ["python", "word_mcp_server.py"]
```

---

### Вариант 2: Копирование с хоста (АЛЬТЕРНАТИВНЫЙ)

**Если обновление сертификатов не помогает:**

1. **Клонируйте репозиторий на хосте:**
```bash
cd ~/document-change-agent/mcp-server
rm -rf Office-Word-MCP-Server  # Если уже есть
git clone https://github.com/GongRzhe/Office-Word-MCP-Server.git Office-Word-MCP-Server
```

2. **Измените Dockerfile:**
```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Установка системных зависимостей
RUN apt-get update && apt-get install -y \
    git \
    && rm -rf /var/lib/apt/lists/*

# Копирование репозитория с хоста
COPY Office-Word-MCP-Server/ .

# Установка Python зависимостей
RUN pip install --no-cache-dir -r requirements.txt

# Создание директорий для данных
RUN mkdir -p /data/uploads /data/outputs /data/backups

# Порт для MCP сервера
EXPOSE 8000

# Запуск MCP сервера
CMD ["python", "word_mcp_server.py"]
```

3. **Добавьте в `.dockerignore` (если нужно):**
```
mcp-server/Office-Word-MCP-Server/.git
```

---

## 📋 Пошаговое решение (рекомендуемый порядок)

### Шаг 1: Обновить Dockerfile

```bash
# На сервере
cd ~/document-change-agent
nano mcp-server/Dockerfile
```

**Добавьте обновление ca-certificates:**
```dockerfile
RUN apt-get update && apt-get install -y \
    git \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && update-ca-certificates
```

### Шаг 2: Пересобрать образ

```bash
docker compose build --no-cache mcp-server
```

### Шаг 3: Проверить логи

```bash
docker compose build mcp-server 2>&1 | tail -20
```

---

## 🔍 Альтернативное решение: Клонирование на хосте

Если обновление сертификатов не помогает:

### Шаг 1: Клонировать репозиторий на хосте

```bash
cd ~/document-change-agent/mcp-server
git clone https://github.com/GongRzhe/Office-Word-MCP-Server.git Office-Word-MCP-Server
```

### Шаг 2: Изменить Dockerfile

Замените строку:
```dockerfile
RUN git clone https://github.com/GongRzhe/Office-Word-MCP-Server.git .
```

На:
```dockerfile
COPY Office-Word-MCP-Server/ .
```

### Шаг 3: Пересобрать

```bash
docker compose build --no-cache mcp-server
```

---

## ⚠️ Важные замечания

1. **Обновление ca-certificates** - это правильное решение для production
2. **Отключение SSL проверки** - небезопасно, используйте только для тестирования
3. **Копирование с хоста** - работает, но требует клонирования на хосте
4. **SSH клонирование** - требует настройки SSH ключей

---

## 🎯 Рекомендация

**Используйте Вариант 1** (обновление ca-certificates) - это правильное и безопасное решение.

Если это не поможет, используйте **Вариант 2** (копирование с хоста) - он гарантированно работает.

---

**Версия:** 1.0  
**Дата:** 2025-11-24

