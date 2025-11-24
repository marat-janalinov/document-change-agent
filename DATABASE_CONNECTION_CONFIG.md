# 🔌 Конфигурация подключения к базе данных

## Содержание

1. [Места настройки параметров](#места-настройки-параметров)
2. [Детальное описание каждого места](#детальное-описание-каждого-места)
3. [Приоритет параметров](#приоритет-параметров)
4. [Как изменить параметры](#как-изменить-параметры)
5. [Примеры конфигурации](#примеры-конфигурации)

---

## Места настройки параметров

Параметры подключения к базе данных PostgreSQL настраиваются в **3 местах**:

1. **`docker-compose.yml`** - Основная конфигурация для Docker
2. **`backend/database.py`** - Код приложения (с fallback значениями)
3. **`.env` файл** (опционально) - Переменные окружения

---

## Детальное описание каждого места

### 1. `docker-compose.yml` (Основная конфигурация)

**Расположение:** Корень проекта `/docker-compose.yml`

#### Параметры для контейнера PostgreSQL:

```yaml
# Строки 25-43
postgres:
  image: postgres:16-alpine
  container_name: document-agent-postgres
  environment:
    - POSTGRES_DB=${POSTGRES_DB:-document_agent}        # Имя базы данных
    - POSTGRES_USER=${POSTGRES_USER:-postgres}           # Пользователь
    - POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-postgres123} # Пароль
    - PGDATA=/var/lib/postgresql/data/pgdata             # Путь к данным
```

**Описание:**
- `POSTGRES_DB` - Имя базы данных (по умолчанию: `document_agent`)
- `POSTGRES_USER` - Имя пользователя (по умолчанию: `postgres`)
- `POSTGRES_PASSWORD` - Пароль (по умолчанию: `postgres123`)
- Используется синтаксис `${VAR:-default}` - если переменная не задана, используется значение по умолчанию

#### Параметры для контейнера Backend:

```yaml
# Строка 58
backend:
  environment:
    - DATABASE_URL=postgresql://${POSTGRES_USER:-postgres}:${POSTGRES_PASSWORD:-postgres123}@postgres:5432/${POSTGRES_DB:-document_agent}
```

**Описание:**
- `DATABASE_URL` - Полный URL подключения к базе данных
- Формат: `postgresql://{user}:{password}@{host}:{port}/{database}`
- `host` = `postgres` (имя сервиса в Docker Compose)
- `port` = `5432` (стандартный порт PostgreSQL)

**Пример значения:**
```
postgresql://postgres:postgres123@postgres:5432/document_agent
```

---

### 2. `backend/database.py` (Код приложения)

**Расположение:** `/backend/database.py`

#### Код подключения:

```python
# Строки 13-16
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres123@localhost:5432/document_agent"
)
```

**Описание:**
- Использует переменную окружения `DATABASE_URL`
- Если переменная не задана, используется fallback значение
- Fallback значение используется для локальной разработки (без Docker)
- В fallback используется `localhost` вместо `postgres` (так как вне Docker нет имени сервиса)

#### Создание движка базы данных:

```python
# Строки 19-26
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,  # Проверка соединения перед использованием
    pool_size=10,        # Размер пула соединений
    max_overflow=20,     # Максимальное количество дополнительных соединений
    echo=False,          # Логирование SQL запросов (False = отключено)
    connect_args={"connect_timeout": 10}  # Таймаут подключения (10 секунд)
)
```

**Параметры пула соединений:**
- `pool_pre_ping=True` - Проверка соединения перед использованием (предотвращает ошибки с разорванными соединениями)
- `pool_size=10` - Размер пула соединений (10 постоянных соединений)
- `max_overflow=20` - Максимальное количество дополнительных соединений (всего может быть до 30)
- `connect_timeout=10` - Таймаут подключения (10 секунд)

---

### 3. `.env` файл (Опционально)

**Расположение:** Корень проекта `/.env`

**Примечание:** В проекте нет `.env` файла по умолчанию, но его можно создать для переопределения значений.

#### Пример `.env` файла:

```env
# PostgreSQL настройки
POSTGRES_DB=document_agent
POSTGRES_USER=postgres
POSTGRES_PASSWORD=my_secure_password_123

# DATABASE_URL (если нужно переопределить полностью)
DATABASE_URL=postgresql://postgres:my_secure_password_123@postgres:5432/document_agent

# Другие переменные
OPENAI_API_KEY=sk-...
JWT_SECRET_KEY=your-secret-key-change-in-production
```

**Как использовать:**
1. Создайте файл `.env` в корне проекта
2. Добавьте переменные окружения
3. Docker Compose автоматически загрузит их (если используется `env_file` в `docker-compose.yml`)
4. Или используйте `docker compose --env-file .env up`

---

## Приоритет параметров

### Порядок приоритета (от высшего к низшему):

1. **Переменные окружения системы** (если заданы)
2. **`.env` файл** (если используется)
3. **`docker-compose.yml`** (значения по умолчанию после `${VAR:-default}`)
4. **`backend/database.py`** (fallback значение в коде)

### Пример:

```yaml
# docker-compose.yml
POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-postgres123}
```

**Если:**
- В системе задано `POSTGRES_PASSWORD=system_pass` → используется `system_pass`
- В `.env` задано `POSTGRES_PASSWORD=env_pass` → используется `env_pass`
- Ничего не задано → используется `postgres123`

---

## Как изменить параметры

### Вариант 1: Изменение в `docker-compose.yml`

**Для изменения пароля PostgreSQL:**

```yaml
# docker-compose.yml
postgres:
  environment:
    - POSTGRES_PASSWORD=новый_надежный_пароль  # Изменить здесь
```

**Для изменения имени базы данных:**

```yaml
postgres:
  environment:
    - POSTGRES_DB=my_database  # Изменить здесь
```

**Не забудьте обновить `DATABASE_URL` в секции `backend`:**

```yaml
backend:
  environment:
    - DATABASE_URL=postgresql://postgres:новый_надежный_пароль@postgres:5432/my_database
```

**После изменений:**
```bash
docker compose down
docker compose up -d
```

---

### Вариант 2: Использование `.env` файла (Рекомендуется)

**Создайте файл `.env` в корне проекта:**

```env
# .env
POSTGRES_DB=document_agent
POSTGRES_USER=postgres
POSTGRES_PASSWORD=my_secure_password_123
```

**Обновите `docker-compose.yml` для использования `.env`:**

```yaml
# docker-compose.yml
services:
  postgres:
    env_file:
      - .env  # Добавить эту строку
    environment:
      - POSTGRES_DB=${POSTGRES_DB:-document_agent}
      - POSTGRES_USER=${POSTGRES_USER:-postgres}
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-postgres123}
```

**Или используйте напрямую:**

```bash
docker compose --env-file .env up -d
```

---

### Вариант 3: Переменные окружения системы

**Linux/macOS:**
```bash
export POSTGRES_PASSWORD=my_secure_password
export POSTGRES_DB=my_database
docker compose up -d
```

**Windows (PowerShell):**
```powershell
$env:POSTGRES_PASSWORD="my_secure_password"
$env:POSTGRES_DB="my_database"
docker compose up -d
```

---

## Примеры конфигурации

### Пример 1: Локальная разработка (без Docker)

**Используется:** `backend/database.py` с fallback значением

```python
# backend/database.py
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres123@localhost:5432/document_agent"
)
```

**Запуск PostgreSQL локально:**
```bash
# Установка PostgreSQL
brew install postgresql  # macOS
# или
sudo apt install postgresql  # Ubuntu

# Запуск PostgreSQL
pg_ctl -D /usr/local/var/postgres start

# Создание базы данных
createdb document_agent
```

**Запуск приложения:**
```bash
cd backend
python -m uvicorn app:app --reload
```

---

### Пример 2: Docker Compose (текущая конфигурация)

**Используется:** `docker-compose.yml`

```yaml
# docker-compose.yml
postgres:
  environment:
    - POSTGRES_DB=document_agent
    - POSTGRES_USER=postgres
    - POSTGRES_PASSWORD=postgres123

backend:
  environment:
    - DATABASE_URL=postgresql://postgres:postgres123@postgres:5432/document_agent
```

**Запуск:**
```bash
docker compose up -d
```

---

### Пример 3: Продакшн конфигурация

**Создайте `.env.production`:**

```env
# .env.production
POSTGRES_DB=document_agent_prod
POSTGRES_USER=db_user
POSTGRES_PASSWORD=super_secure_password_12345
DATABASE_URL=postgresql://db_user:super_secure_password_12345@postgres:5432/document_agent_prod
```

**Используйте при запуске:**
```bash
docker compose --env-file .env.production up -d
```

---

### Пример 4: Внешняя база данных

**Если база данных находится на другом сервере:**

```yaml
# docker-compose.yml
backend:
  environment:
    - DATABASE_URL=postgresql://user:password@external-db.example.com:5432/document_agent
```

**Или через `.env`:**
```env
DATABASE_URL=postgresql://user:password@external-db.example.com:5432/document_agent
```

---

## Текущие значения по умолчанию

### Параметры PostgreSQL:

| Параметр | Значение по умолчанию | Где задается |
|----------|----------------------|--------------|
| **База данных** | `document_agent` | `docker-compose.yml:30` |
| **Пользователь** | `postgres` | `docker-compose.yml:31` |
| **Пароль** | `postgres123` | `docker-compose.yml:32` |
| **Хост (в Docker)** | `postgres` | `docker-compose.yml:58` (имя сервиса) |
| **Хост (локально)** | `localhost` | `backend/database.py:15` |
| **Порт** | `5432` | `docker-compose.yml:58` |

### Параметры пула соединений:

| Параметр | Значение | Где задается |
|----------|----------|--------------|
| **pool_pre_ping** | `True` | `backend/database.py:21` |
| **pool_size** | `10` | `backend/database.py:22` |
| **max_overflow** | `20` | `backend/database.py:23` |
| **connect_timeout** | `10` секунд | `backend/database.py:25` |

---

## Проверка подключения

### Проверка из контейнера backend:

```bash
# Вход в контейнер
docker compose exec backend bash

# Проверка переменной окружения
echo $DATABASE_URL

# Тест подключения через Python
python -c "from database import engine; engine.connect(); print('OK')"
```

### Проверка из контейнера postgres:

```bash
# Вход в контейнер PostgreSQL
docker compose exec postgres psql -U postgres -d document_agent

# В консоли PostgreSQL:
\conninfo  # Информация о подключении
\l         # Список баз данных
\dt        # Список таблиц
```

### Проверка через psql снаружи:

```bash
# Подключение к базе данных в Docker
psql -h localhost -p 5432 -U postgres -d document_agent

# Или через Docker
docker compose exec postgres psql -U postgres -d document_agent
```

---

## Безопасность

### ⚠️ Важные рекомендации:

1. **Не коммитьте `.env` файл в Git:**
   ```gitignore
   # .gitignore
   .env
   .env.*
   !.env.example
   ```

2. **Используйте надежные пароли в продакшн:**
   ```env
   POSTGRES_PASSWORD=длинный_случайный_пароль_минимум_16_символов
   ```

3. **Ограничьте доступ к базе данных:**
   - Используйте отдельного пользователя для приложения (не `postgres`)
   - Ограничьте права доступа (только необходимые таблицы)

4. **Используйте SSL для внешних подключений:**
   ```python
   DATABASE_URL=postgresql://user:pass@host:5432/db?sslmode=require
   ```

---

## Устранение проблем

### Проблема: "Connection refused"

**Причина:** База данных не запущена или неправильный хост/порт

**Решение:**
```bash
# Проверка статуса контейнера
docker compose ps postgres

# Проверка логов
docker compose logs postgres

# Перезапуск
docker compose restart postgres
```

---

### Проблема: "Authentication failed"

**Причина:** Неправильный пароль или пользователь

**Решение:**
1. Проверьте переменные окружения:
   ```bash
   docker compose exec backend env | grep DATABASE
   ```

2. Проверьте пароль в контейнере postgres:
   ```bash
   docker compose exec postgres env | grep POSTGRES
   ```

3. Обновите пароль в `docker-compose.yml` и перезапустите:
   ```bash
   docker compose down
   docker compose up -d
   ```

---

### Проблема: "Database does not exist"

**Причина:** База данных не создана

**Решение:**
```bash
# Создание базы данных
docker compose exec postgres psql -U postgres -c "CREATE DATABASE document_agent;"

# Или пересоздание контейнера
docker compose down -v  # Удаляет volumes
docker compose up -d
```

---

## Резюме

### Места настройки (по приоритету):

1. **`.env` файл** (если используется) - самый удобный способ
2. **`docker-compose.yml`** - основная конфигурация для Docker
3. **`backend/database.py`** - fallback для локальной разработки

### Рекомендации:

- ✅ Используйте `.env` файл для разных окружений (dev, staging, prod)
- ✅ Не коммитьте `.env` в Git
- ✅ Используйте надежные пароли в продакшн
- ✅ Проверяйте подключение после изменений

---

**Версия документа:** 1.0  
**Дата обновления:** 2025-11-24

