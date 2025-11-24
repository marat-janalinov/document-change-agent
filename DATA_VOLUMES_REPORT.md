# 📦 Отчет по использованию Persistent Volumes для директории data

**Дата проверки:** 2025-11-24

---

## ✅ Текущая конфигурация

### Используются Named Volumes (Persistent Volumes)

В `docker-compose.yml` настроены следующие persistent volumes:

| Volume | Назначение | Подключен к контейнерам |
|--------|------------|-------------------------|
| `data-uploads` | Загруженные файлы пользователей | `backend`, `mcp-server` |
| `data-outputs` | Обработанные файлы | `backend`, `mcp-server` |
| `data-backups` | Резервные копии | `backend`, `mcp-server` |
| `data-logs` | Логи приложения | `backend` |
| `data-prompts` | Промпты для LLM | `backend` |
| `postgres-data` | Данные PostgreSQL | `postgres` |

### Конфигурация в docker-compose.yml

```yaml
volumes:
  # Постоянное хранилище для загруженных файлов
  data-uploads:
    driver: local
  # Постоянное хранилище для обработанных файлов
  data-outputs:
    driver: local
  # Постоянное хранилище для резервных копий
  data-backups:
    driver: local
  # Постоянное хранилище для логов
  data-logs:
    driver: local
  # Постоянное хранилище для промптов
  data-prompts:
    driver: local
```

### Подключение к контейнерам

**Backend:**
```yaml
volumes:
  - data-uploads:/data/uploads
  - data-outputs:/data/outputs
  - data-backups:/data/backups
  - data-logs:/data/logs
  - data-prompts:/data/prompts
```

**MCP Server:**
```yaml
volumes:
  - data-uploads:/data/uploads
  - data-outputs:/data/outputs
  - data-backups:/data/backups
```

---

## 📍 Расположение volumes

### На хосте (macOS/Linux)

Docker volumes хранятся в:
- **macOS:** `/var/lib/docker/volumes/` (через Docker Desktop)
- **Linux:** `/var/lib/docker/volumes/`

### Проверка расположения

```bash
# Просмотр всех volumes
docker volume ls

# Информация о конкретном volume
docker volume inspect document-change-agent_data-uploads

# Просмотр содержимого volume (требует root на Linux)
sudo ls -la $(docker volume inspect document-change-agent_data-uploads --format '{{.Mountpoint}}')
```

---

## ✅ Преимущества использования Persistent Volumes

1. **Постоянное хранение данных**
   - Данные сохраняются при перезапуске контейнеров
   - Данные сохраняются при удалении контейнеров
   - Данные сохраняются при обновлении образов

2. **Изоляция данных**
   - Данные не хранятся в контейнере
   - Легко делать бэкапы
   - Легко мигрировать между хостами

3. **Производительность**
   - Volumes оптимизированы для Docker
   - Лучшая производительность, чем bind mounts

4. **Безопасность**
   - Данные изолированы от файловой системы хоста
   - Контролируемый доступ через Docker

---

## ⚠️ Важные замечания

### 1. Локальная директория `./data`

**Текущая ситуация:**
- В проекте есть локальная директория `./data/`
- В `.env` указано `DATA_DIR=/data` (для Docker)
- Локальная директория `./data/` **НЕ синхронизируется** с Docker volumes

**Это означает:**
- Файлы в локальной `./data/` не видны в Docker контейнере
- Файлы в Docker volumes не видны локально
- Это **правильное поведение** для production, но может быть неудобно для разработки

### 2. Для локальной разработки

Если нужно синхронизировать локальную директорию с контейнером, можно использовать **bind mount**:

```yaml
volumes:
  - ./data/uploads:/data/uploads  # Bind mount вместо named volume
```

**⚠️ Внимание:** Это изменит текущую конфигурацию и может привести к потере данных в volumes.

---

## 🔍 Проверка работы volumes

### 1. Проверка существования volumes

```bash
docker volume ls | grep document-change-agent
```

**Ожидаемый результат:**
```
local     document-change-agent_data-backups
local     document-change-agent_data-logs
local     document-change-agent_data-outputs
local     document-change-agent_data-prompts
local     document-change-agent_data-uploads
local     document-change-agent_postgres-data
```

### 2. Проверка содержимого volume

```bash
# В контейнере
docker compose exec backend ls -la /data/uploads/

# На хосте (требует root на Linux)
sudo ls -la $(docker volume inspect document-change-agent_data-uploads --format '{{.Mountpoint}}')
```

### 3. Проверка размера volumes

```bash
docker system df -v | grep document-change-agent
```

---

## 📊 Структура данных в volumes

### data-uploads
```
/data/uploads/
  └── {username}/
      ├── source/
      │   └── *.docx
      └── changes/
          └── *.docx
```

### data-outputs
```
/data/outputs/
  └── {processed_files}.docx
```

### data-backups
```
/data/backups/
  └── {filename}_backup_{timestamp}.docx
```

### data-prompts
```
/data/prompts/
  ├── instruction_check_system.md
  ├── instruction_check_user.md
  ├── change_application_system.md
  └── change_application_user.md
```

### data-logs
```
/data/logs/
  └── *.log
```

---

## 🔧 Управление volumes

### Просмотр информации о volume

```bash
docker volume inspect document-change-agent_data-uploads
```

### Удаление volume (⚠️ Удалит все данные!)

```bash
docker volume rm document-change-agent_data-uploads
```

### Создание бэкапа volume

```bash
# Создание бэкапа
docker run --rm \
  -v document-change-agent_data-uploads:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/data-uploads-backup.tar.gz -C /data .

# Восстановление из бэкапа
docker run --rm \
  -v document-change-agent_data-uploads:/data \
  -v $(pwd):/backup \
  alpine tar xzf /backup/data-uploads-backup.tar.gz -C /data
```

---

## ✅ Итоговый ответ

**Да, для директории data используются Persistent Volumes (Named Volumes).**

### Используемые volumes:
1. ✅ `data-uploads` - для загруженных файлов пользователей
2. ✅ `data-outputs` - для обработанных файлов
3. ✅ `data-backups` - для резервных копий
4. ✅ `data-logs` - для логов
5. ✅ `data-prompts` - для промптов LLM

### Преимущества:
- ✅ Данные сохраняются при перезапуске контейнеров
- ✅ Данные сохраняются при удалении контейнеров
- ✅ Легко делать бэкапы
- ✅ Изоляция данных от файловой системы хоста

### Важно:
- ⚠️ Локальная директория `./data/` **НЕ синхронизируется** с Docker volumes
- ⚠️ Для просмотра данных в volumes нужно использовать Docker команды
- ⚠️ Для синхронизации с локальной директорией нужно использовать bind mounts (не рекомендуется для production)

---

**Версия:** 1.0  
**Дата:** 2025-11-24

