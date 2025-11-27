# Диагностика последней операции Document Change Agent

## Как проверить результаты последней операции

### 1. Через веб-интерфейс

**Шаг 1: Проверка логов операций**
1. Войдите в систему под своей учетной записью
2. Перейдите на вкладку с логами операций (если доступна)
3. Найдите последнюю операцию по времени
4. Проверьте статус операции и детали

**Шаг 2: Проверка результатов в "Проверка изменений"**
1. Перейдите на вкладку "Проверка изменений"
2. Найдите обработанный документ
3. Скачайте результат и проверьте изменения
4. Сравните с оригинальным документом

### 2. Через API (для технической диагностики)

**Получение логов операций:**
```bash
# Получить последние 10 операций
curl -X GET "http://localhost:3000/api/operation-logs?limit=10&offset=0" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Получение деталей конкретной операции:**
```bash
# Заменить OPERATION_ID на ID операции из логов
curl -X GET "http://localhost:3000/api/operation-logs?operation_id=OPERATION_ID" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 3. Проверка файлов в системе

**Структура файлов после обработки:**
```
/data/uploads/{username}/
├── source/
│   ├── original_document.docx          # Исходный документ
│   └── original_document_processed.docx # Обработанный документ
├── changes/
│   └── instructions.docx               # Файл с инструкциями
└── backups/
    └── original_document_backup.docx   # Резервная копия
```

## Что проверить при проблемах

### 1. Проверка статуса операции

**Возможные статусы:**
- `SUCCESS` - операция выполнена успешно
- `FAILED` - операция не выполнена
- `PARTIAL` - операция выполнена частично
- `IN_PROGRESS` - операция выполняется

### 2. Проверка деталей каждого изменения

**Для каждой инструкции проверьте:**
```json
{
  "change_id": "CHG-001",
  "operation": "REPLACE_TEXT",
  "description": "Заменить 'ДРМ' на 'ДКР'",
  "status": "SUCCESS",
  "details": {
    "success": true,
    "matches_found": 5,
    "replacements_made": 3,
    "error": null
  }
}
```

**Ключевые поля:**
- `matches_found` - сколько совпадений найдено
- `replacements_made` - сколько замен выполнено
- `error` - текст ошибки (если есть)

### 3. Типичные проблемы и их диагностика

**Проблема: "Текст не найден"**
```json
{
  "status": "FAILED",
  "details": {
    "success": false,
    "error": "ANCHOR_NOT_FOUND",
    "message": "Текст 'ДРМ' не найден в документе"
  }
}
```
**Причина:** Точный текст не соответствует тексту в документе

**Проблема: "Частичная замена"**
```json
{
  "status": "PARTIAL",
  "details": {
    "success": true,
    "matches_found": 10,
    "replacements_made": 7,
    "error": "Некоторые вхождения в таблицах не заменены"
  }
}
```
**Причина:** Проблемы с заменой в таблицах (должно быть исправлено)

**Проблема: "Аннотации в неправильном месте"**
```json
{
  "annotation_location": "paragraph_0",
  "expected_location": "paragraph_32"
}
```
**Причина:** Проблемы с привязкой аннотаций (должно быть исправлено)

## Команды для диагностики на сервере

### 1. Проверка логов Docker контейнеров

**Логи backend сервиса:**
```bash
docker compose logs backend | tail -100
```

**Логи MCP сервера:**
```bash
docker compose logs mcp-server | tail -100
```

**Поиск ошибок:**
```bash
docker compose logs backend | grep -i "error\|failed\|exception"
```

### 2. Проверка файлов в контейнере

**Вход в backend контейнер:**
```bash
docker compose exec backend bash
```

**Проверка структуры файлов:**
```bash
ls -la /data/uploads/operator1/
ls -la /data/uploads/operator1/source/
ls -la /data/uploads/operator1/changes/
ls -la /data/backups/
```

### 3. Проверка базы данных

**Подключение к PostgreSQL:**
```bash
docker compose exec postgres psql -U postgres -d document_agent
```

**Проверка последних операций:**
```sql
SELECT 
    operation_id,
    operation_type,
    status,
    created_at,
    source_filename,
    changes_filename,
    tokens_used
FROM operation_logs 
ORDER BY created_at DESC 
LIMIT 10;
```

**Проверка деталей конкретной операции:**
```sql
SELECT 
    operation_id,
    status,
    error_message,
    result_data,
    created_at,
    updated_at
FROM operation_logs 
WHERE operation_id = 'YOUR_OPERATION_ID';
```

## Интерпретация результатов

### Успешная операция
```json
{
  "total_changes": 4,
  "successful": 4,
  "failed": 0,
  "changes": [
    {
      "change_id": "CHG-001",
      "status": "SUCCESS",
      "details": {"replacements_made": 1}
    },
    {
      "change_id": "CHG-002", 
      "status": "SUCCESS",
      "details": {"replacements_made": 1}
    },
    {
      "change_id": "CHG-003",
      "status": "SUCCESS", 
      "details": {"replacements_made": 1}
    },
    {
      "change_id": "CHG-004",
      "status": "SUCCESS",
      "details": {"replacements_made": 15}
    }
  ]
}
```

### Проблемная операция
```json
{
  "total_changes": 4,
  "successful": 2,
  "failed": 2,
  "changes": [
    {
      "change_id": "CHG-001",
      "status": "FAILED",
      "details": {
        "error": "ANCHOR_NOT_FOUND",
        "message": "Текст не найден в таблице"
      }
    },
    {
      "change_id": "CHG-004",
      "status": "PARTIAL",
      "details": {
        "matches_found": 20,
        "replacements_made": 15,
        "message": "Не все вхождения заменены"
      }
    }
  ]
}
```

## Следующие шаги при проблемах

1. **Проверьте точность текста** в инструкциях
2. **Убедитесь, что файлы загружены** правильно
3. **Проверьте логи** на наличие ошибок
4. **Сравните исходный и обработанный** документы
5. **Проверьте, что изменения** применились к нужным местам

---

*Используйте этот скрипт для диагностики проблем с последней операцией*
