# 🔧 Исправление ошибки pip SSL: certificate verify failed

**Дата:** 2025-11-24  
**Ошибка:** `[SSL: CERTIFICATE_VERIFY_FAILED] certificate verify failed: unable to get local issuer certificate`

---

## 🔍 Анализ проблемы

Ошибка возникает при установке Python пакетов через pip из PyPI. Это та же проблема с SSL сертификатами, что и при клонировании GitHub.

**Причина:** В образе `python:3.11-slim` отсутствуют или устарели SSL сертификаты для проверки PyPI.

---

## ✅ Решение

### Обновлен `mcp-server/Dockerfile`

**Было:**
```dockerfile
RUN apt-get update && apt-get install -y \
    git \
    && rm -rf /var/lib/apt/lists/*
```

**Стало:**
```dockerfile
RUN apt-get update && apt-get install -y \
    git \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && update-ca-certificates
```

**Изменения:**
- ✅ Добавлен пакет `ca-certificates`
- ✅ Добавлен `update-ca-certificates` для обновления сертификатов
- ✅ Сертификаты обновляются ДО клонирования GitHub и установки pip пакетов

---

## 📋 Что нужно сделать на сервере

### Шаг 1: Получить обновления

```bash
cd ~/document-change-agent
git pull origin main
```

### Шаг 2: Проверить изменения в Dockerfile

```bash
cat mcp-server/Dockerfile | grep -A 5 "apt-get update"
```

**Должно быть:**
```dockerfile
RUN apt-get update && apt-get install -y \
    git \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && update-ca-certificates
```

### Шаг 3: Пересобрать образ

```bash
docker compose build --no-cache mcp-server
```

### Шаг 4: Проверить логи

```bash
docker compose build mcp-server 2>&1 | tail -30
```

### Шаг 5: Запустить все сервисы

```bash
docker compose up -d
```

---

## 🔍 Полный исправленный Dockerfile

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

## ✅ Ожидаемый результат

После применения исправлений:
- ✅ SSL сертификаты обновлены
- ✅ Клонирование GitHub работает
- ✅ Установка pip пакетов работает
- ✅ Сборка образа проходит успешно

---

## 🔍 Проверка на сервере

После `git pull` и пересборки проверьте:

```bash
# Проверка сборки
docker compose build mcp-server 2>&1 | grep -E "ERROR|SUCCESS|certificate"

# Проверка запуска
docker compose up -d mcp-server
docker compose logs mcp-server --tail 20
```

---

## ⚠️ Важные замечания

1. **Обновление ca-certificates** решает обе проблемы:
   - Клонирование GitHub
   - Установка pip пакетов

2. **Используйте `--no-cache`** при пересборке для применения изменений

3. **Порядок важен** - обновление сертификатов должно быть ДО их использования

---

## 🎯 Итог

Исправление применено и отправлено в GitHub. На сервере нужно:
1. Выполнить `git pull origin main`
2. Пересобрать образ: `docker compose build --no-cache mcp-server`
3. Запустить: `docker compose up -d`

---

**Версия:** 1.0  
**Дата:** 2025-11-24

