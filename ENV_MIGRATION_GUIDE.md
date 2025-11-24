# 📝 Миграция параметров БД в .env файл

## ✅ Выполненные изменения

### 1. Создан/обновлен файл `.env`

В корне проекта добавлены переменные окружения для подключения к базе данных:

```env
# PostgreSQL Database Settings
POSTGRES_DB=document_agent
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres123

# PostgreSQL Host and Port
POSTGRES_HOST=postgres
POSTGRES_PORT=5432

# Database URL
DATABASE_URL=postgresql://postgres:postgres123@postgres:5432/document_agent
```

### 2. Обновлен `backend/database.py`

- ✅ Добавлена загрузка `.env` файла через `python-dotenv`
- ✅ Параметры БД теперь читаются из переменных окружения
- ✅ Поддержка как `DATABASE_URL`, так и отдельных параметров
- ✅ Автоматическое формирование `DATABASE_URL` из отдельных параметров, если не задан напрямую

**Изменения:**
```python
# Загрузка .env файла
from dotenv import load_dotenv
env_path = Path(__file__).parent.parent / '.env'
if env_path.exists():
    load_dotenv(dotenv_path=env_path)

# Чтение параметров из переменных окружения
POSTGRES_DB = os.getenv("POSTGRES_DB", "document_agent")
POSTGRES_USER = os.getenv("POSTGRES_USER", "postgres")
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", "postgres123")
POSTGRES_HOST = os.getenv("POSTGRES_HOST", "localhost")
POSTGRES_PORT = os.getenv("POSTGRES_PORT", "5432")

# Использование DATABASE_URL или формирование из параметров
DATABASE_URL = os.getenv("DATABASE_URL") or \
    f"postgresql://{POSTGRES_USER}:{POSTGRES_PASSWORD}@{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}"
```

### 3. Обновлен `docker-compose.yml`

- ✅ Добавлен `env_file: - .env` для сервисов `postgres` и `backend`
- ✅ Все переменные теперь читаются из `.env` файла
- ✅ Сохранена обратная совместимость через значения по умолчанию

**Изменения:**
```yaml
postgres:
  env_file:
    - .env
  environment:
    - POSTGRES_DB=${POSTGRES_DB:-document_agent}
    - POSTGRES_USER=${POSTGRES_USER:-postgres}
    - POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-postgres123}

backend:
  env_file:
    - .env
  environment:
    - DATABASE_URL=${DATABASE_URL:-postgresql://...}
    - POSTGRES_DB=${POSTGRES_DB:-document_agent}
    - POSTGRES_USER=${POSTGRES_USER:-postgres}
    - POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-postgres123}
    - POSTGRES_HOST=${POSTGRES_HOST:-postgres}
    - POSTGRES_PORT=${POSTGRES_PORT:-5432}
```

---

## 🔧 Как использовать

### Для Docker Compose (рекомендуется)

1. **Отредактируйте `.env` файл** с вашими параметрами:
   ```env
   POSTGRES_DB=document_agent
   POSTGRES_USER=postgres
   POSTGRES_PASSWORD=your_secure_password
   POSTGRES_HOST=postgres
   POSTGRES_PORT=5432
   DATABASE_URL=postgresql://postgres:your_secure_password@postgres:5432/document_agent
   ```

2. **Запустите контейнеры:**
   ```bash
   docker compose up -d
   ```

3. **Docker Compose автоматически загрузит переменные из `.env`**

### Для локальной разработки (без Docker)

1. **Отредактируйте `.env` файл:**
   ```env
   POSTGRES_HOST=localhost  # Измените на localhost
   POSTGRES_PORT=5432
   DATABASE_URL=postgresql://postgres:postgres123@localhost:5432/document_agent
   ```

2. **Запустите приложение:**
   ```bash
   cd backend
   python -m uvicorn app:app --reload
   ```

3. **`backend/database.py` автоматически загрузит `.env` из корня проекта**

---

## 📋 Приоритет загрузки переменных

1. **Переменные окружения системы** (высший приоритет)
2. **`.env` файл** (загружается через `python-dotenv` и `docker-compose`)
3. **Значения по умолчанию** в коде (fallback)

---

## 🔒 Безопасность

### ⚠️ Важно:

- ✅ Файл `.env` уже добавлен в `.gitignore` (не коммитится в Git)
- ✅ Не коммитьте `.env` с реальными паролями
- ✅ Используйте `.env.example` как шаблон для команды
- ✅ В продакшн используйте переменные окружения системы или секреты Docker

### Создание `.env.example`:

```bash
cp .env .env.example
# Отредактируйте .env.example, заменив реальные значения на примеры
```

---

## 🧪 Проверка работы

### Проверка загрузки переменных в Python:

```python
# В Python консоли или скрипте
from backend.database import DATABASE_URL, POSTGRES_DB, POSTGRES_USER
print(f"DATABASE_URL: {DATABASE_URL}")
print(f"POSTGRES_DB: {POSTGRES_DB}")
print(f"POSTGRES_USER: {POSTGRES_USER}")
```

### Проверка в Docker контейнере:

```bash
# Проверка переменных в контейнере backend
docker compose exec backend env | grep POSTGRES
docker compose exec backend env | grep DATABASE_URL

# Проверка переменных в контейнере postgres
docker compose exec postgres env | grep POSTGRES
```

---

## 📝 Изменение параметров

### Изменить пароль БД:

1. Отредактируйте `.env`:
   ```env
   POSTGRES_PASSWORD=новый_надежный_пароль
   DATABASE_URL=postgresql://postgres:новый_надежный_пароль@postgres:5432/document_agent
   ```

2. Перезапустите контейнеры:
   ```bash
   docker compose down
   docker compose up -d
   ```

### Изменить имя базы данных:

1. Отредактируйте `.env`:
   ```env
   POSTGRES_DB=my_database
   DATABASE_URL=postgresql://postgres:postgres123@postgres:5432/my_database
   ```

2. Перезапустите контейнеры

---

## ✅ Преимущества

1. **Централизованная конфигурация** - все параметры в одном месте
2. **Безопасность** - `.env` не коммитится в Git
3. **Гибкость** - легко менять параметры для разных окружений
4. **Удобство** - один файл для всех настроек
5. **Обратная совместимость** - значения по умолчанию сохранены

---

**Версия документа:** 1.0  
**Дата обновления:** 2025-11-24

