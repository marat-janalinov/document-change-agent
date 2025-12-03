# 🔧 Альтернативные решения для ошибки pip SSL

**Дата:** 2025-11-24  
**Проблема:** Обновление ca-certificates не помогло, pip все еще не может проверить SSL сертификаты

---

## ✅ Безопасные решения (рекомендуется попробовать сначала)

### Решение 1: Обновление pip и certifi (ДОБАВЛЕНО В DOCKERFILE)

**Обновлен Dockerfile:**
```dockerfile
# Обновление pip и certifi для Python
RUN pip install --upgrade pip certifi
```

Это обновляет Python SSL сертификаты перед установкой зависимостей.

---

### Решение 2: Использование доверенных хостов (если решение 1 не помогло)

**Добавьте в Dockerfile перед установкой зависимостей:**
```dockerfile
# Настройка pip для использования доверенных хостов
RUN pip config set global.trusted-host "pypi.org files.pythonhosted.org"
```

**Или в одной команде:**
```dockerfile
RUN pip install --trusted-host pypi.org --trusted-host files.pythonhosted.org --no-cache-dir -r requirements.txt
```

---

### Решение 3: Использование pip с флагом --trusted-host

**Измените строку установки зависимостей:**
```dockerfile
RUN pip install --trusted-host pypi.org --trusted-host files.pythonhosted.org --no-cache-dir -r requirements.txt
```

---

## ⚠️ Временное отключение SSL (НЕБЕЗОПАСНО, только для тестирования)

**Если ничего не помогает, можно временно отключить проверку SSL:**

```dockerfile
# ВРЕМЕННОЕ РЕШЕНИЕ - отключение проверки SSL (НЕБЕЗОПАСНО!)
RUN pip install --trusted-host pypi.org --trusted-host files.pythonhosted.org --no-cache-dir -r requirements.txt
```

**Или полностью отключить проверку:**
```dockerfile
# КРАЙНЕ НЕБЕЗОПАСНО - отключение проверки SSL
ENV PIP_CERT=""
RUN pip install --no-cache-dir --no-warn-script-location -r requirements.txt
```

**⚠️ ВНИМАНИЕ:** Это делает установку уязвимой для атак man-in-the-middle!

---

## 🔧 Рекомендуемый порядок действий

### Шаг 1: Попробовать обновленный Dockerfile (с обновлением pip и certifi)

**Текущий Dockerfile уже обновлен:**
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

# Обновление pip и certifi для Python
RUN pip install --upgrade pip certifi

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

**На сервере:**
```bash
git pull origin main
docker compose build --no-cache mcp-server
```

### Шаг 2: Если не помогло - использовать --trusted-host

**Измените строку установки:**
```dockerfile
RUN pip install --trusted-host pypi.org --trusted-host files.pythonhosted.org --no-cache-dir -r requirements.txt
```

### Шаг 3: Только если ничего не помогает - временно отключить SSL

**Используйте только для тестирования:**
```dockerfile
# ВРЕМЕННОЕ РЕШЕНИЕ
RUN pip install --trusted-host pypi.org --trusted-host files.pythonhosted.org --no-cache-dir -r requirements.txt
```

---

## 📋 Полный Dockerfile с --trusted-host (рекомендуется)

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

# Обновление pip и certifi для Python
RUN pip install --upgrade pip certifi

# Клонирование Office-Word-MCP-Server
RUN git clone https://github.com/GongRzhe/Office-Word-MCP-Server.git .

# Установка Python зависимостей с доверенными хостами
RUN pip install --trusted-host pypi.org --trusted-host files.pythonhosted.org --no-cache-dir -r requirements.txt

# Создание директорий для данных
RUN mkdir -p /data/uploads /data/outputs /data/backups

# Порт для MCP сервера
EXPOSE 8000

# Запуск MCP сервера
CMD ["python", "word_mcp_server.py"]
```

---

## ⚠️ Важные замечания

1. **--trusted-host** - это компромисс между безопасностью и функциональностью
   - Проверка SSL все еще выполняется
   - Но для указанных хостов проверка сертификата пропускается
   - Более безопасно, чем полное отключение SSL

2. **Полное отключение SSL** - крайне небезопасно
   - Используйте только для тестирования
   - Никогда не используйте в production

3. **Порядок важен:**
   - Сначала обновить ca-certificates
   - Затем обновить pip и certifi
   - Только потом устанавливать зависимости

---

## 🎯 Рекомендация

**Используйте вариант с `--trusted-host`** - это баланс между безопасностью и функциональностью. Он позволяет pip работать, но все еще выполняет базовую проверку.

---

**Версия:** 1.0  
**Дата:** 2025-11-24

