# Руководство по логированию операций

## Обзор

Система логирования операций проверки документов автоматически записывает в базу данных следующую информацию:

- **ID операции** - уникальный идентификатор (UUID)
- **Тип операции** - `check_instructions` или `process_documents`
- **Пользователь** - ID и имя пользователя, запустившего операцию
- **Файлы** - имена исходного файла и файла с инструкциями
- **Токены** - количество использованных токенов (prompt, completion, total)
- **Результаты** - количество найденных изменений
- **Статус** - `in_progress`, `completed`, `failed`
- **Ошибки** - сообщения об ошибках (если есть)
- **Временные метки** - время создания и завершения операции

## Структура базы данных

Таблица `operation_logs` содержит следующие поля:

```sql
- id: INTEGER PRIMARY KEY
- operation_id: TEXT UNIQUE (UUID операции)
- operation_type: TEXT (check_instructions | process_documents)
- user_id: INTEGER (FK to users.id)
- username: TEXT (имя пользователя на момент операции)
- source_filename: TEXT (исходный файл)
- changes_filename: TEXT (файл с инструкциями)
- tokens_used: INTEGER (общее количество токенов)
- tokens_prompt: INTEGER (токены в промпте)
- tokens_completion: INTEGER (токены в ответе)
- total_changes: INTEGER (количество найденных изменений)
- status: TEXT (in_progress | completed | failed)
- error_message: TEXT (сообщение об ошибке)
- created_at: DATETIME
- completed_at: DATETIME
```

## Автоматическое логирование

### Проверка инструкций (`/api/check-instructions`)

Лог создается автоматически при вызове endpoint:
- Создается запись со статусом `in_progress`
- После получения ответа от LLM обновляется:
  - Количество токенов (prompt, completion, total)
  - Количество найденных изменений
  - Статус `completed` или `failed`

### Обработка документов (`/api/process-documents`)

Лог создается при запуске обработки:
- Создается запись со статусом `in_progress`
- После завершения обработки обновляется:
  - Количество токенов
  - Количество примененных изменений
  - Статус `completed` или `failed`

## Просмотр логов

Логи хранятся в таблице `operation_logs` базы данных SQLite.

Для просмотра логов можно:

1. **Через SQL запросы**:
```sql
SELECT * FROM operation_logs ORDER BY created_at DESC;
```

2. **Через API** (можно добавить endpoint):
```python
@app.get("/api/operation-logs")
async def get_operation_logs(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    logs = db.query(OperationLog).order_by(OperationLog.created_at.desc()).all()
    return [log.to_dict() for log in logs]
```

## Пример записи лога

```json
{
  "id": 1,
  "operation_id": "550e8400-e29b-41d4-a716-446655440000",
  "operation_type": "check_instructions",
  "user_id": 1,
  "username": "admin",
  "source_filename": null,
  "changes_filename": "29092025.docx",
  "tokens_used": 15234,
  "tokens_prompt": 12000,
  "tokens_completion": 3234,
  "total_changes": 55,
  "status": "completed",
  "error_message": null,
  "created_at": "2025-11-23T14:30:00",
  "completed_at": "2025-11-23T14:32:15"
}
```

## Интеграция с пользователями

Если пользователь не аутентифицирован (нет JWT токена), операция все равно логируется, но:
- `user_id` будет `NULL`
- `username` будет `NULL`

Это позволяет отслеживать операции даже от неавторизованных пользователей (если это разрешено в вашей системе).

## Отслеживание токенов

Токены отслеживаются автоматически из ответов OpenAI API:
- `prompt_tokens` - токены в запросе к LLM
- `completion_tokens` - токены в ответе от LLM
- `total_tokens` - общее количество токенов

Эта информация доступна в объекте `response.usage` после вызова OpenAI API.

