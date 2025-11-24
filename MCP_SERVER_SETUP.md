# 🔧 Настройка mcp-server: Клонирование репозитория на хосте

**Дата:** 2025-11-24  
**Изменение:** Теперь репозиторий клонируется на хосте и копируется в образ

---

## ✅ Причина изменения

Git clone в Docker образе имеет проблемы с SSL сертификатами на сервере. Решение: клонировать репозиторий на хосте и копировать в образ.

---

## 📋 Что нужно сделать

### На сервере (перед сборкой образа):

```bash
cd ~/document-change-agent/mcp-server

# Удалить старую директорию, если есть
rm -rf Office-Word-MCP-Server

# Клонировать репозиторий
git clone https://github.com/GongRzhe/Office-Word-MCP-Server.git Office-Word-MCP-Server

# Проверить, что клонировалось
ls -la Office-Word-MCP-Server/ | head -10
```

### Затем собрать образ:

```bash
cd ~/document-change-agent
docker compose build --no-cache mcp-server
```

---

## 🔄 Обновление репозитория

При обновлении кода репозитория:

```bash
cd ~/document-change-agent/mcp-server/Office-Word-MCP-Server
git pull origin main

# Затем пересобрать образ
cd ~/document-change-agent
docker compose build --no-cache mcp-server
```

---

## 📝 Обновленный Dockerfile

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

# Клонирование Office-Word-MCP-Server (копирование с хоста)
COPY Office-Word-MCP-Server/ .

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

## ⚠️ Важно

1. **Директория должна называться `Office-Word-MCP-Server`** (с заглавными буквами)
2. **Клонировать нужно в `mcp-server/Office-Word-MCP-Server/`**
3. **Перед каждой сборкой** убедитесь, что репозиторий обновлен

---

## 🔍 Проверка на сервере

```bash
# Проверить наличие директории
ls -la ~/document-change-agent/mcp-server/Office-Word-MCP-Server/

# Должны быть файлы:
# - requirements.txt
# - word_mcp_server.py
# - и другие файлы репозитория
```

---

**Версия:** 1.0  
**Дата:** 2025-11-24

