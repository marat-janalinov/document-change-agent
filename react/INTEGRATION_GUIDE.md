# Руководство по интеграции

## Что было сделано

### Backend

1. **База данных SQLite**
   - Модель `User` для хранения пользователей
   - Автоматическая инициализация при запуске
   - Создание администратора по умолчанию: `admin@example.com` / `admin123`

2. **API аутентификации** (`/api/auth/`)
   - `POST /api/auth/login` - вход в систему
   - `GET /api/auth/me` - получение текущего пользователя
   - `GET /api/auth/users` - список пользователей (только для админов)
   - `POST /api/auth/users` - создание пользователя (только для админов)
   - `PUT /api/auth/users/{id}` - обновление пользователя (только для админов)
   - `DELETE /api/auth/users/{id}` - удаление пользователя (только для админов)

3. **JWT токены**
   - Токены хранятся в localStorage
   - Время жизни: 24 часа
   - Автоматическая проверка при каждом запросе

### Frontend

1. **Аутентификация**
   - Хук `useAuth` для управления состоянием аутентификации
   - Обновленный `AppContext` с поддержкой реальных пользователей
   - Защищенные маршруты через `ProtectedRoute`

2. **Главная страница**
   - Интегрирован Document Change Agent для роли `executive`
   - Админ-панель для роли `admin`
   - Панель безопасности для роли `security`

3. **Управление пользователями**
   - Обновленный `UsersTable` с работой через API
   - Создание, редактирование, блокировка, удаление пользователей
   - Диалог создания нового пользователя

## Запуск

### 1. Установка зависимостей backend

```bash
cd backend
pip install -r requirements.txt
```

### 2. Запуск backend

```bash
cd backend
uvicorn app:app --host 0.0.0.0 --port 8000 --reload
```

База данных будет автоматически создана в `data/app.db` при первом запуске.

### 3. Запуск frontend

```bash
cd react
npm install
npm run dev
```

## Использование

### Первый вход

1. Откройте `http://localhost:8080/login2`
2. Войдите с учетными данными администратора:
   - Логин: `admin` или `admin@example.com`
   - Пароль: `admin123`

### Создание пользователей

1. Войдите как администратор
2. Переключитесь на роль "Администратор" в шапке
3. Откройте вкладку "Пользователи и роли"
4. Нажмите "Создать учетную запись"
5. Заполните форму и создайте пользователя

### Роли пользователей

- **executive** - Руководитель (доступ к Document Change Agent)
- **admin** - Администратор (управление пользователями)
- **security** - Безопасность (панель безопасности)

## Структура базы данных

```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE NOT NULL,
    hashed_password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'executive',
    status TEXT NOT NULL DEFAULT 'active',
    tags TEXT,
    created_at DATETIME,
    updated_at DATETIME
);
```

## Переменные окружения

Для backend можно установить:

- `DB_PATH` - путь к файлу базы данных (по умолчанию: `data/app.db`)
- `JWT_SECRET_KEY` - секретный ключ для JWT (по умолчанию: `your-secret-key-change-in-production`)

## Безопасность

⚠️ **Важно для продакшена:**

1. Измените `JWT_SECRET_KEY` на случайную строку
2. Измените пароль администратора по умолчанию
3. Используйте HTTPS
4. Настройте CORS для конкретных доменов
5. Добавьте rate limiting для API

