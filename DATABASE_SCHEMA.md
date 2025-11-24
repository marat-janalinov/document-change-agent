# 🗄️ Описание структуры базы данных

## Содержание

1. [Общая информация](#общая-информация)
2. [Таблица users](#таблица-users)
3. [Таблица operation_logs](#таблица-operation_logs)
4. [Связи между таблицами](#связи-между-таблицами)
5. [Индексы](#индексы)
6. [SQL запросы для работы с таблицами](#sql-запросы-для-работы-с-таблицами)

---

## Общая информация

**База данных:** PostgreSQL 16  
**Имя базы данных:** `document_agent`  
**ORM:** SQLAlchemy 2.0  
**Всего таблиц:** 2

---

## Таблица users

### Назначение

Хранит информацию о пользователях системы: администраторах, операторах и операторах безопасности.

### Структура таблицы

| Поле | Тип данных | Ограничения | Описание |
|------|------------|-------------|----------|
| **id** | `INTEGER` | `PRIMARY KEY`, `NOT NULL`, `INDEX` | Уникальный идентификатор пользователя (автоинкремент) |
| **email** | `VARCHAR` | `UNIQUE`, `NOT NULL`, `INDEX` | Email адрес пользователя (уникальный) |
| **username** | `VARCHAR` | `UNIQUE`, `NOT NULL`, `INDEX` | Логин пользователя (уникальный) |
| **hashed_password** | `VARCHAR` | `NOT NULL` | Хешированный пароль (bcrypt) |
| **role** | `VARCHAR` | `NOT NULL`, `DEFAULT 'executive'` | Роль пользователя: `admin`, `executive`, `security` |
| **status** | `VARCHAR` | `NOT NULL`, `DEFAULT 'active'` | Статус пользователя: `active`, `blocked` |
| **tags** | `VARCHAR` | `NULL` | JSON строка с тегами пользователя (например: `["tag1", "tag2"]`) |
| **created_at** | `TIMESTAMP` | `DEFAULT CURRENT_TIMESTAMP` | Дата и время создания записи |
| **updated_at** | `TIMESTAMP` | `DEFAULT CURRENT_TIMESTAMP`, `ON UPDATE CURRENT_TIMESTAMP` | Дата и время последнего обновления |

### SQL CREATE TABLE

```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR NOT NULL UNIQUE,
    username VARCHAR NOT NULL UNIQUE,
    hashed_password VARCHAR NOT NULL,
    role VARCHAR NOT NULL DEFAULT 'executive',
    status VARCHAR NOT NULL DEFAULT 'active',
    tags VARCHAR,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Индексы
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
```

### Примеры данных

```sql
-- Пример записи администратора
INSERT INTO users (email, username, hashed_password, role, status, tags) 
VALUES (
    'admin@example.com',
    'admin',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYqB5K5K5K5K',
    'admin',
    'active',
    '[]'
);

-- Пример записи оператора
INSERT INTO users (email, username, hashed_password, role, status, tags) 
VALUES (
    'operator1@example.com',
    'operator1',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYqB5K5K5K5K',
    'executive',
    'active',
    '["operator", "team1"]'
);
```

### Возможные значения полей

**role:**
- `admin` - Администратор (полный доступ)
- `executive` - Оператор/Исполнитель (работа с документами)
- `security` - Оператор безопасности (просмотр логов и аудит)

**status:**
- `active` - Активный пользователь
- `blocked` - Заблокированный пользователь

---

## Таблица operation_logs

### Назначение

Хранит логи всех операций проверки инструкций и применения изменений к документам. Используется для аудита, отслеживания использования токенов и анализа производительности.

### Структура таблицы

| Поле | Тип данных | Ограничения | Описание |
|------|------------|-------------|----------|
| **id** | `INTEGER` | `PRIMARY KEY`, `NOT NULL`, `INDEX` | Уникальный идентификатор записи (автоинкремент) |
| **operation_id** | `VARCHAR` | `UNIQUE`, `NOT NULL`, `INDEX` | UUID операции (уникальный идентификатор операции) |
| **operation_type** | `VARCHAR` | `NOT NULL` | Тип операции: `check_instructions`, `process_documents` |
| **user_id** | `INTEGER` | `FOREIGN KEY(users.id)`, `NULL`, `INDEX` | ID пользователя, выполнившего операцию |
| **username** | `VARCHAR` | `NULL` | Имя пользователя на момент операции (для истории) |
| **source_filename** | `VARCHAR` | `NULL` | Имя исходного файла документа |
| **changes_filename** | `VARCHAR` | `NULL` | Имя файла с инструкциями |
| **tokens_used** | `INTEGER` | `DEFAULT 0` | Общее количество использованных токенов OpenAI |
| **tokens_prompt** | `INTEGER` | `DEFAULT 0` | Количество токенов в промпте |
| **tokens_completion** | `INTEGER` | `DEFAULT 0` | Количество токенов в ответе LLM |
| **total_changes** | `INTEGER` | `DEFAULT 0` | Количество найденных/примененных изменений |
| **status** | `VARCHAR` | `NOT NULL`, `DEFAULT 'completed'` | Статус операции: `completed`, `failed`, `in_progress` |
| **error_message** | `TEXT` | `NULL` | Сообщение об ошибке (если операция завершилась с ошибкой) |
| **created_at** | `TIMESTAMP` | `DEFAULT CURRENT_TIMESTAMP` | Дата и время начала операции |
| **completed_at** | `TIMESTAMP` | `NULL` | Дата и время завершения операции |

### SQL CREATE TABLE

```sql
CREATE TABLE operation_logs (
    id SERIAL PRIMARY KEY,
    operation_id VARCHAR NOT NULL UNIQUE,
    operation_type VARCHAR NOT NULL,
    user_id INTEGER,
    username VARCHAR,
    source_filename VARCHAR,
    changes_filename VARCHAR,
    tokens_used INTEGER DEFAULT 0,
    tokens_prompt INTEGER DEFAULT 0,
    tokens_completion INTEGER DEFAULT 0,
    total_changes INTEGER DEFAULT 0,
    status VARCHAR NOT NULL DEFAULT 'completed',
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Индексы
CREATE INDEX idx_operation_logs_operation_id ON operation_logs(operation_id);
CREATE INDEX idx_operation_logs_user_id ON operation_logs(user_id);
CREATE INDEX idx_operation_logs_operation_type ON operation_logs(operation_type);
CREATE INDEX idx_operation_logs_status ON operation_logs(status);
CREATE INDEX idx_operation_logs_created_at ON operation_logs(created_at);
```

### Примеры данных

```sql
-- Пример записи успешной проверки инструкций
INSERT INTO operation_logs (
    operation_id, 
    operation_type, 
    user_id, 
    username, 
    changes_filename, 
    tokens_used, 
    tokens_prompt, 
    tokens_completion, 
    total_changes, 
    status, 
    created_at, 
    completed_at
) VALUES (
    '550e8400-e29b-41d4-a716-446655440000',
    'check_instructions',
    1,
    'operator1',
    'changes.docx',
    15234,
    12000,
    3234,
    6,
    'completed',
    '2025-11-24 10:30:00',
    '2025-11-24 10:30:15'
);

-- Пример записи применения изменений
INSERT INTO operation_logs (
    operation_id, 
    operation_type, 
    user_id, 
    username, 
    source_filename, 
    changes_filename, 
    tokens_used, 
    tokens_prompt, 
    tokens_completion, 
    total_changes, 
    status, 
    created_at, 
    completed_at
) VALUES (
    '550e8400-e29b-41d4-a716-446655440001',
    'process_documents',
    1,
    'operator1',
    'source.docx',
    'changes.docx',
    45234,
    40000,
    5234,
    6,
    'completed',
    '2025-11-24 10:35:00',
    '2025-11-24 10:36:30'
);

-- Пример записи с ошибкой
INSERT INTO operation_logs (
    operation_id, 
    operation_type, 
    user_id, 
    username, 
    source_filename, 
    changes_filename, 
    tokens_used, 
    total_changes, 
    status, 
    error_message, 
    created_at, 
    completed_at
) VALUES (
    '550e8400-e29b-41d4-a716-446655440002',
    'process_documents',
    2,
    'operator2',
    'source.docx',
    'changes.docx',
    0,
    0,
    'failed',
    'Файл source.docx не найден',
    '2025-11-24 11:00:00',
    '2025-11-24 11:00:05'
);
```

### Возможные значения полей

**operation_type:**
- `check_instructions` - Проверка инструкций (парсинг файла с инструкциями)
- `process_documents` - Применение изменений к документу

**status:**
- `in_progress` - Операция выполняется
- `completed` - Операция успешно завершена
- `failed` - Операция завершилась с ошибкой

---

## Связи между таблицами

### Схема связей

```
users (1) ────────< (N) operation_logs
  │                      │
  │                      │
  id              user_id (FK)
```

### Описание связи

- **users.id** → **operation_logs.user_id** (Foreign Key)
- **Тип связи:** Один ко многим (One-to-Many)
- **Ограничение:** `ON DELETE SET NULL` - при удалении пользователя, `user_id` в логах устанавливается в `NULL`, но записи сохраняются для истории

### Примеры запросов со связями

```sql
-- Получение всех операций пользователя с информацией о пользователе
SELECT 
    ol.operation_id,
    ol.operation_type,
    ol.status,
    ol.tokens_used,
    ol.total_changes,
    ol.created_at,
    u.username,
    u.email,
    u.role
FROM operation_logs ol
LEFT JOIN users u ON ol.user_id = u.id
WHERE ol.user_id = 1
ORDER BY ol.created_at DESC;

-- Статистика по пользователям
SELECT 
    u.username,
    u.role,
    COUNT(ol.id) as total_operations,
    SUM(ol.tokens_used) as total_tokens,
    AVG(ol.tokens_used) as avg_tokens_per_operation
FROM users u
LEFT JOIN operation_logs ol ON u.id = ol.user_id
GROUP BY u.id, u.username, u.role
ORDER BY total_operations DESC;
```

---

## Индексы

### Таблица users

| Индекс | Поля | Тип | Назначение |
|--------|------|-----|------------|
| `PRIMARY KEY` | `id` | Primary Key | Уникальная идентификация записей |
| `idx_users_email` | `email` | Unique Index | Быстрый поиск по email |
| `idx_users_username` | `username` | Unique Index | Быстрый поиск по логину |

### Таблица operation_logs

| Индекс | Поля | Тип | Назначение |
|--------|------|-----|------------|
| `PRIMARY KEY` | `id` | Primary Key | Уникальная идентификация записей |
| `idx_operation_logs_operation_id` | `operation_id` | Unique Index | Быстрый поиск по UUID операции |
| `idx_operation_logs_user_id` | `user_id` | Index | Быстрый поиск операций пользователя |
| `idx_operation_logs_operation_type` | `operation_type` | Index | Фильтрация по типу операции |
| `idx_operation_logs_status` | `status` | Index | Фильтрация по статусу |
| `idx_operation_logs_created_at` | `created_at` | Index | Сортировка и фильтрация по дате |

---

## SQL запросы для работы с таблицами

### Просмотр структуры таблиц

```sql
-- Список всех таблиц
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public';

-- Структура таблицы users
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'users'
ORDER BY ordinal_position;

-- Структура таблицы operation_logs
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'operation_logs'
ORDER BY ordinal_position;
```

### Работа с пользователями

```sql
-- Получение всех пользователей
SELECT id, username, email, role, status, created_at 
FROM users 
ORDER BY created_at;

-- Поиск пользователя по логину
SELECT * FROM users WHERE username = 'admin';

-- Поиск пользователя по email
SELECT * FROM users WHERE email = 'admin@example.com';

-- Пользователи по роли
SELECT username, email, status 
FROM users 
WHERE role = 'admin';

-- Активные пользователи
SELECT username, email, role 
FROM users 
WHERE status = 'active';

-- Подсчет пользователей по ролям
SELECT role, COUNT(*) as count 
FROM users 
GROUP BY role;

-- Последние созданные пользователи
SELECT username, email, role, created_at 
FROM users 
ORDER BY created_at DESC 
LIMIT 10;
```

### Работа с логами операций

```sql
-- Все операции
SELECT 
    operation_id,
    operation_type,
    username,
    status,
    tokens_used,
    total_changes,
    created_at
FROM operation_logs
ORDER BY created_at DESC;

-- Операции конкретного пользователя
SELECT 
    operation_id,
    operation_type,
    status,
    tokens_used,
    total_changes,
    created_at,
    completed_at
FROM operation_logs
WHERE user_id = 1
ORDER BY created_at DESC;

-- Операции по типу
SELECT 
    operation_type,
    COUNT(*) as count,
    AVG(tokens_used) as avg_tokens,
    SUM(tokens_used) as total_tokens
FROM operation_logs
GROUP BY operation_type;

-- Успешные операции
SELECT 
    operation_id,
    operation_type,
    username,
    tokens_used,
    total_changes,
    created_at
FROM operation_logs
WHERE status = 'completed'
ORDER BY created_at DESC;

-- Операции с ошибками
SELECT 
    operation_id,
    operation_type,
    username,
    error_message,
    created_at
FROM operation_logs
WHERE status = 'failed'
ORDER BY created_at DESC;

-- Статистика использования токенов
SELECT 
    DATE(created_at) as date,
    SUM(tokens_used) as total_tokens,
    AVG(tokens_used) as avg_tokens,
    COUNT(*) as operations_count
FROM operation_logs
WHERE status = 'completed'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Топ пользователей по использованию токенов
SELECT 
    u.username,
    u.role,
    COUNT(ol.id) as operations_count,
    SUM(ol.tokens_used) as total_tokens,
    AVG(ol.tokens_used) as avg_tokens
FROM users u
LEFT JOIN operation_logs ol ON u.id = ol.user_id
WHERE ol.status = 'completed'
GROUP BY u.id, u.username, u.role
ORDER BY total_tokens DESC;

-- Операции за последние 24 часа
SELECT 
    operation_id,
    operation_type,
    username,
    status,
    tokens_used,
    created_at
FROM operation_logs
WHERE created_at >= NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;
```

### Аналитические запросы

```sql
-- Общая статистика системы
SELECT 
    (SELECT COUNT(*) FROM users) as total_users,
    (SELECT COUNT(*) FROM users WHERE status = 'active') as active_users,
    (SELECT COUNT(*) FROM operation_logs) as total_operations,
    (SELECT COUNT(*) FROM operation_logs WHERE status = 'completed') as completed_operations,
    (SELECT COUNT(*) FROM operation_logs WHERE status = 'failed') as failed_operations,
    (SELECT SUM(tokens_used) FROM operation_logs WHERE status = 'completed') as total_tokens_used;

-- Средняя производительность операций
SELECT 
    operation_type,
    AVG(EXTRACT(EPOCH FROM (completed_at - created_at))) as avg_duration_seconds,
    MIN(EXTRACT(EPOCH FROM (completed_at - created_at))) as min_duration_seconds,
    MAX(EXTRACT(EPOCH FROM (completed_at - created_at))) as max_duration_seconds,
    COUNT(*) as operations_count
FROM operation_logs
WHERE status = 'completed' AND completed_at IS NOT NULL
GROUP BY operation_type;

-- Распределение операций по дням недели
SELECT 
    TO_CHAR(created_at, 'Day') as day_of_week,
    COUNT(*) as operations_count
FROM operation_logs
GROUP BY TO_CHAR(created_at, 'Day')
ORDER BY operations_count DESC;
```

### Очистка старых данных

```sql
-- Удаление логов старше 90 дней
DELETE FROM operation_logs 
WHERE created_at < NOW() - INTERVAL '90 days';

-- Удаление только завершенных операций старше 90 дней
DELETE FROM operation_logs 
WHERE status = 'completed' 
  AND created_at < NOW() - INTERVAL '90 days';

-- Архивирование старых логов (создание таблицы архива)
CREATE TABLE operation_logs_archive (LIKE operation_logs INCLUDING ALL);

-- Перемещение старых записей в архив
INSERT INTO operation_logs_archive 
SELECT * FROM operation_logs 
WHERE created_at < NOW() - INTERVAL '90 days';

DELETE FROM operation_logs 
WHERE created_at < NOW() - INTERVAL '90 days';
```

---

## Диаграмма базы данных

```
┌─────────────────────────────────┐
│           users                 │
├─────────────────────────────────┤
│ PK id (INTEGER)                 │
│    email (VARCHAR, UNIQUE)       │
│    username (VARCHAR, UNIQUE)    │
│    hashed_password (VARCHAR)    │
│    role (VARCHAR)               │
│    status (VARCHAR)             │
│    tags (VARCHAR)               │
│    created_at (TIMESTAMP)       │
│    updated_at (TIMESTAMP)       │
└─────────────────────────────────┘
           │
           │ 1
           │
           │ N
           ▼
┌─────────────────────────────────┐
│      operation_logs             │
├─────────────────────────────────┤
│ PK id (INTEGER)                 │
│    operation_id (VARCHAR, UNIQ)│
│    operation_type (VARCHAR)     │
│ FK user_id (INTEGER)            │
│    username (VARCHAR)           │
│    source_filename (VARCHAR)    │
│    changes_filename (VARCHAR)   │
│    tokens_used (INTEGER)        │
│    tokens_prompt (INTEGER)      │
│    tokens_completion (INTEGER)  │
│    total_changes (INTEGER)      │
│    status (VARCHAR)             │
│    error_message (TEXT)         │
│    created_at (TIMESTAMP)       │
│    completed_at (TIMESTAMP)     │
└─────────────────────────────────┘
```

---

## Миграции базы данных

### Создание таблиц (первая миграция)

```sql
-- Создание таблицы users
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR NOT NULL UNIQUE,
    username VARCHAR NOT NULL UNIQUE,
    hashed_password VARCHAR NOT NULL,
    role VARCHAR NOT NULL DEFAULT 'executive',
    status VARCHAR NOT NULL DEFAULT 'active',
    tags VARCHAR,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Создание таблицы operation_logs
CREATE TABLE IF NOT EXISTS operation_logs (
    id SERIAL PRIMARY KEY,
    operation_id VARCHAR NOT NULL UNIQUE,
    operation_type VARCHAR NOT NULL,
    user_id INTEGER,
    username VARCHAR,
    source_filename VARCHAR,
    changes_filename VARCHAR,
    tokens_used INTEGER DEFAULT 0,
    tokens_prompt INTEGER DEFAULT 0,
    tokens_completion INTEGER DEFAULT 0,
    total_changes INTEGER DEFAULT 0,
    status VARCHAR NOT NULL DEFAULT 'completed',
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Создание индексов
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_operation_logs_operation_id ON operation_logs(operation_id);
CREATE INDEX IF NOT EXISTS idx_operation_logs_user_id ON operation_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_operation_logs_operation_type ON operation_logs(operation_type);
CREATE INDEX IF NOT EXISTS idx_operation_logs_status ON operation_logs(status);
CREATE INDEX IF NOT EXISTS idx_operation_logs_created_at ON operation_logs(created_at);
```

### Проверка целостности данных

```sql
-- Проверка внешних ключей
SELECT 
    COUNT(*) as orphaned_logs
FROM operation_logs ol
LEFT JOIN users u ON ol.user_id = u.id
WHERE ol.user_id IS NOT NULL AND u.id IS NULL;

-- Проверка уникальности
SELECT email, COUNT(*) 
FROM users 
GROUP BY email 
HAVING COUNT(*) > 1;

SELECT username, COUNT(*) 
FROM users 
GROUP BY username 
HAVING COUNT(*) > 1;

SELECT operation_id, COUNT(*) 
FROM operation_logs 
GROUP BY operation_id 
HAVING COUNT(*) > 1;
```

---

## Резюме

### Таблица users

- **Назначение:** Хранение информации о пользователях системы
- **Количество полей:** 9
- **Индексы:** 3 (id, email, username)
- **Связи:** Связана с `operation_logs` через `user_id`

### Таблица operation_logs

- **Назначение:** Логирование всех операций с документами
- **Количество полей:** 14
- **Индексы:** 6 (id, operation_id, user_id, operation_type, status, created_at)
- **Связи:** Связана с `users` через `user_id` (Foreign Key)

### Общая статистика

- **Всего таблиц:** 2
- **Всего индексов:** 9
- **Foreign Keys:** 1
- **Типы операций:** 2 (check_instructions, process_documents)
- **Роли пользователей:** 3 (admin, executive, security)

---

**Версия документа:** 1.0  
**Дата обновления:** 2025-11-24

---

*Для работы с базой данных используйте SQLAlchemy ORM или прямые SQL запросы через psql.*

