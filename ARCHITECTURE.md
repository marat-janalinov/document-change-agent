# Архитектура системы Document Change Agent

## Обзор системы

Система состоит из **двух основных агентов**, работающих последовательно:

1. **Агент распознавания инструкций** (`ChangeInstructionParser` + `DocumentChangeAgent._parse_changes_with_llm`)
2. **Агент применения изменений** (`DocumentChangeAgent._execute_change` + `MCPClient`)

---

## Полный цикл работы системы

### Этап 1: Загрузка файлов (Frontend → Backend)

```
Пользователь → Frontend (index.html)
    ↓
POST /api/upload-file
    ↓
Backend сохраняет файлы в /data/uploads/
    ↓
Файлы готовы:
  - source.docx (исходный документ)
  - changes.docx (файл с инструкциями)
```

### Этап 2: Запуск обработки (Backend API)

```
POST /api/process-documents
{
  "source_filename": "dsa.docx",
  "changes_filename": "asd.docx"
}
    ↓
Создается session_id (UUID)
    ↓
Запускается фоновая задача: process_documents_task()
    ↓
Вызывается: document_agent.process_documents()
```

### Этап 3: Агент #1 - Распознавание инструкций

#### 3.1. Извлечение текста из файла инструкций

```
DocumentChangeAgent.process_documents()
    ↓
mcp_client.get_document_text(changes_file)
    ↓
MCPClient → MCP Word Server (HTTP)
    ↓
Office-Word-MCP-Server читает .docx через python-docx
    ↓
Возвращает весь текст файла asd.docx
```

#### 3.2. Быстрый парсер (ChangeInstructionParser)

```
ChangeInstructionParser.parse(changes_text)
    ↓
Анализ текста по регулярным выражениям:
  - "По всему тексту слово X заменить на Y"
  - "Пункт X исключить"
  - "Пункт X изложить в редакции"
  - "Главу X дополнить пунктами"
    ↓
Результат: List[Dict] с изменениями (10-20 изменений)
    ↓
Пример:
{
  "change_id": "CHG-001",
  "operation": "REPLACE_TEXT",
  "target": {"text": "Компания", "replace_all": true},
  "payload": {"new_text": "Общество"}
}
```

#### 3.3. LLM-анализ (DocumentChangeAgent._parse_changes_with_llm)

```
DocumentChangeAgent._parse_changes_with_llm(changes_text, parser_changes)
    ↓
OpenAI API (GPT-4.1-mini)
    ↓
System Prompt: "Ты эксперт по анализу документов..."
User Prompt: "Проанализируй содержимое документа..."
    ↓
LLM анализирует весь текст и находит ВСЕ инструкции
    ↓
Возвращает JSON с изменениями
    ↓
Результат: List[Dict] с изменениями (20-30 изменений)
```

#### 3.4. Объединение результатов

```
DocumentChangeAgent._merge_changes(parser_changes, llm_changes)
    ↓
Дедупликация по ключам:
  - REPLACE: "Компания"->"Общество"
  - DELETE: "30."
  - INSERT: "60."->"новый текст"
    ↓
Приоритет: LLM изменения (более гибкие)
    ↓
Финальный список: List[Dict] (20-27 уникальных изменений)
```

### Этап 4: Создание резервной копии

```
mcp_client.copy_document(source_file, backup_file)
    ↓
MCPClient → MCP Word Server
    ↓
Office-Word-MCP-Server копирует файл через python-docx
    ↓
Создается: dsa_backup.docx
```

### Этап 5: Агент #2 - Применение изменений

Для каждого изменения из списка:

#### 5.1. Определение операции

```
DocumentChangeAgent._execute_change(source_file, change)
    ↓
operation = change.get("operation")
  - REPLACE_TEXT
  - DELETE_PARAGRAPH
  - INSERT_PARAGRAPH
  - REPLACE_POINT_TEXT
  - INSERT_SECTION
```

#### 5.2. Поиск целевого текста (MCP Word Server)

```
Для REPLACE_TEXT:
    ↓
mcp_client.find_text_in_document(filename, target_text)
    ↓
MCPClient → MCP Word Server
    ↓
Office-Word-MCP-Server:
  - Открывает документ через python-docx
  - Ищет текст в параграфах
  - Возвращает: List[MCPTextMatch]
    [
      {
        "paragraph_index": 15,
        "text": "30. Текст пункта..."
      }
    ]
```

#### 5.3. Применение изменения

**Вариант A: Через MCP Word Server (предпочтительно)**

```
mcp_client.replace_text(filename, old_text, new_text, paragraph_index)
    ↓
MCPClient → MCP Word Server
    ↓
Office-Word-MCP-Server:
  - Открывает документ через python-docx
  - Находит параграф по индексу
  - Заменяет текст
  - Сохраняет документ
    ↓
Возвращает: success/failure
```

**Вариант B: Напрямую через python-docx (локально)**

```
DocumentChangeAgent._handle_replace_text()
    ↓
doc = Document(filename)  # python-docx
    ↓
para = doc.paragraphs[paragraph_index]
    ↓
Замена текста в параграфе
    ↓
doc.save(filename)
```

#### 5.4. Добавление аннотации

```
DocumentChangeAgent._add_annotation(filename, paragraph_index, change)
    ↓
mcp_client.add_comment(filename, paragraph_index, comment_text)
    ↓
MCPClient → MCP Word Server (или локально через python-docx)
    ↓
Вставляется параграф с комментарием:
  "[ANNOTATION by DocumentChangeAgent]
   ━━━━━━━━━━━━━━━━━━━━━━━━━
   [CHG-001] REPLACE_TEXT
   ━━━━━━━━━━━━━━━━━━━━━━━━━
   Массовая замена: 'Компания' → 'Общество'
   Время: 2025-11-21T16:25:38"
```

### Этап 6: Отправка прогресса (WebSocket)

```
После каждого изменения:
    ↓
progress_callback({
  "type": "operation_completed",
  "data": {
    "change_id": "CHG-001",
    "operation": "REPLACE_TEXT",
    "status": "SUCCESS",
    "details": {...}
  }
})
    ↓
WebSocket → Frontend
    ↓
Frontend обновляет UI:
  - Прогресс-бар
  - Список изменений
  - Статус выполнения
```

### Этап 7: Завершение обработки

```
Все изменения применены
    ↓
Возвращается итоговый результат:
{
  "session_id": "...",
  "total_changes": 27,
  "successful": 25,
  "failed": 2,
  "changes": [...],
  "processed_filename": "dsa.docx",
  "backup_filename": "dsa_backup.docx"
}
    ↓
WebSocket: {"type": "completed", "data": result}
    ↓
Frontend показывает результаты и ссылки на скачивание
```

---

## Компоненты системы

### 1. ChangeInstructionParser (Быстрый парсер)

**Назначение:** Распознает стандартные паттерны инструкций

**Методы:**
- `parse(text: str) -> List[Dict]` - парсинг текста
- `_add_replace_all()` - массовые замены
- `_add_delete_point()` - удаление пунктов
- `_add_replace_point()` - изменение пунктов

**Использует:** Только регулярные выражения, без LLM

### 2. DocumentChangeAgent (LLM-агент)

**Назначение:** Управляет всем процессом обработки

**Ключевые методы:**

#### Распознавание:
- `_parse_changes_with_llm()` - LLM-анализ инструкций
- `_merge_changes()` - объединение результатов парсера и LLM

#### Применение:
- `process_documents()` - главный метод обработки
- `_execute_change()` - выполнение одного изменения
- `_handle_replace_text()` - обработка замены текста
- `_handle_delete_paragraph()` - обработка удаления
- `_handle_insert_paragraph()` - обработка вставки
- `_add_annotation()` - добавление комментариев

**Использует:**
- OpenAI API (GPT-4.1-mini)
- MCPClient для работы с документами
- python-docx для локальных операций

### 3. MCPClient (Клиент MCP Word Server)

**Назначение:** Взаимодействие с MCP Word Server через HTTP

**Ключевые методы:**
- `get_document_text()` - извлечение текста
- `find_text_in_document()` - поиск текста
- `replace_text()` - замена текста
- `delete_paragraph()` - удаление параграфа
- `add_paragraph()` - добавление параграфа
- `add_comment()` - добавление комментария

**Использует:**
- FastMCP Client (HTTP transport)
- Office-Word-MCP-Server (отдельный сервис)

### 4. Office-Word-MCP-Server (MCP Server)

**Назначение:** Низкоуровневые операции с Word документами

**Использует:**
- python-docx для работы с .docx файлами
- Предоставляет инструменты через MCP протокол

---

## Поток данных

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (index.html)                     │
│  - Загрузка файлов                                           │
│  - Запуск обработки                                          │
│  - Отображение прогресса (WebSocket)                         │
└───────────────────────┬───────────────────────────────────────┘
                       │
                       │ HTTP REST API
                       ↓
┌─────────────────────────────────────────────────────────────┐
│                    BACKEND (app.py)                          │
│  - FastAPI endpoints                                         │
│  - WebSocket для real-time обновлений                        │
│  - Управление сессиями                                       │
└───────────────────────┬───────────────────────────────────────┘
                       │
                       │ Вызов методов
                       ↓
┌─────────────────────────────────────────────────────────────┐
│          DocumentChangeAgent (parlant_agent.py)              │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  ЭТАП 1: Распознавание инструкций                   │    │
│  │                                                       │    │
│  │  1. ChangeInstructionParser.parse()                  │    │
│  │     → Быстрый парсер (regex)                        │    │
│  │                                                       │    │
│  │  2. _parse_changes_with_llm()                       │    │
│  │     → OpenAI API (GPT-4.1-mini)                    │    │
│  │                                                       │    │
│  │  3. _merge_changes()                                 │    │
│  │     → Объединение + дедупликация                    │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  ЭТАП 2: Применение изменений                       │    │
│  │                                                       │    │
│  │  Для каждого изменения:                              │    │
│  │    1. _execute_change()                              │    │
│  │    2. MCPClient.find_text_in_document()             │    │
│  │    3. MCPClient.replace_text() / delete_paragraph()  │    │
│  │    4. _add_annotation()                               │    │
│  └─────────────────────────────────────────────────────┘    │
└───────────────────────┬───────────────────────────────────────┘
                       │
                       │ HTTP (FastMCP)
                       ↓
┌─────────────────────────────────────────────────────────────┐
│              MCPClient (mcp_client.py)                      │
│  - FastMCP Client                                            │
│  - HTTP transport к MCP Server                              │
└───────────────────────┬───────────────────────────────────────┘
                       │
                       │ HTTP POST /mcp
                       ↓
┌─────────────────────────────────────────────────────────────┐
│        Office-Word-MCP-Server (mcp-server/)                 │
│  - FastMCP Server                                            │
│  - Инструменты для работы с Word                            │
│  - Использует python-docx                                   │
└───────────────────────┬───────────────────────────────────────┘
                       │
                       │ python-docx API
                       ↓
┌─────────────────────────────────────────────────────────────┐
│                    .docx файлы                               │
│  - source.docx (исходный документ)                           │
│  - changes.docx (инструкции)                                │
│  - source_backup.docx (резервная копия)                      │
└─────────────────────────────────────────────────────────────┘
```

---

## Детальный пример работы

### Пример 1: Массовая замена "Компания" → "Общество"

```
1. ChangeInstructionParser находит:
   "По всему тексту слово «Компания» заменить словом «Общество»"
   ↓
   Создает: {
     "operation": "REPLACE_TEXT",
     "target": {"text": "Компания", "replace_all": true},
     "payload": {"new_text": "Общество"}
   }

2. DocumentChangeAgent._handle_replace_text():
   ↓
   mcp_client.find_text_in_document("dsa.docx", "Компания")
   ↓
   MCP Server находит все вхождения:
   [
     {"paragraph_index": 5, "text": "Компания является..."},
     {"paragraph_index": 12, "text": "В Компании работают..."},
     {"paragraph_index": 25, "text": "Компания имеет право..."}
   ]
   ↓
   Для каждого вхождения:
     mcp_client.replace_text("dsa.docx", "Компания", "Общество", 5)
     mcp_client.replace_text("dsa.docx", "Компания", "Общество", 12)
     mcp_client.replace_text("dsa.docx", "Компания", "Общество", 25)
   ↓
   MCP Server через python-docx:
     - Открывает dsa.docx
     - Находит параграф 5
     - Заменяет "Компания" на "Общество"
     - Сохраняет документ
   ↓
   Добавляется аннотация в параграф 5
```

### Пример 2: Удаление пункта 30

```
1. ChangeInstructionParser находит:
   "Пункт 30 исключить"
   ↓
   Создает: {
     "operation": "DELETE_PARAGRAPH",
     "target": {"text": "30."}
   }

2. DocumentChangeAgent._handle_delete_paragraph():
   ↓
   mcp_client.find_text_in_document("dsa.docx", "30.")
   ↓
   MCP Server находит:
   [{"paragraph_index": 45, "text": "30. Текст пункта..."}]
   ↓
   mcp_client.delete_paragraph("dsa.docx", 45)
   ↓
   MCP Server через python-docx:
     - Открывает dsa.docx
     - Удаляет параграф 45
     - Сохраняет документ
   ↓
   Добавляется аннотация
```

---

## Ключевые особенности архитектуры

### 1. Двухэтапное распознавание
- **Быстрый парсер** - для стандартных паттернов (без LLM, быстро)
- **LLM-анализ** - для всех инструкций (гибко, но медленнее)

### 2. Два способа применения изменений
- **Через MCP Server** - предпочтительно (изолированно, через HTTP)
- **Напрямую через python-docx** - для сложных операций (локально)

### 3. Асинхронная обработка
- Все операции асинхронные (async/await)
- WebSocket для real-time обновлений
- Фоновая обработка через asyncio.create_task()

### 4. Отказоустойчивость
- Резервная копия перед изменениями
- Обработка ошибок для каждого изменения
- Логирование всех операций

---

## Технологии

| Компонент | Технология | Назначение |
|-----------|-----------|------------|
| **Frontend** | Vanilla JS + HTML/CSS | Веб-интерфейс |
| **Backend API** | FastAPI | REST API + WebSocket |
| **LLM** | OpenAI GPT-4.1-mini | Анализ инструкций |
| **Парсер** | Python regex | Быстрое распознавание |
| **MCP Client** | FastMCP Client | HTTP transport |
| **MCP Server** | FastMCP Server | Инструменты Word |
| **Word обработка** | python-docx | Манипуляции с .docx |
| **Deployment** | Docker Compose | Оркестрация сервисов |

---

## Итоговая схема

```
Пользователь
    ↓
Frontend (загрузка файлов)
    ↓
Backend API (создание сессии)
    ↓
┌─────────────────────────────────────────┐
│  АГЕНТ #1: Распознавание инструкций     │
│  ┌───────────────────────────────────┐  │
│  │ ChangeInstructionParser (regex)   │  │
│  └──────────────┬────────────────────┘  │
│                 ↓                        │
│  ┌───────────────────────────────────┐  │
│  │ LLM (OpenAI GPT-4.1-mini)        │  │
│  └──────────────┬────────────────────┘  │
│                 ↓                        │
│  ┌───────────────────────────────────┐  │
│  │ _merge_changes() (дедупликация)  │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
    ↓
Список изменений (20-27 операций)
    ↓
┌─────────────────────────────────────────┐
│  АГЕНТ #2: Применение изменений         │
│                                         │
│  Для каждого изменения:                 │
│  ┌───────────────────────────────────┐  │
│  │ MCPClient.find_text_in_document()│  │
│  │   → MCP Word Server               │  │
│  │   → python-docx                   │  │
│  └──────────────┬────────────────────┘  │
│                 ↓                        │
│  ┌───────────────────────────────────┐  │
│  │ MCPClient.replace_text() /       │  │
│  │ delete_paragraph() / etc.         │  │
│  │   → MCP Word Server               │  │
│  │   → python-docx                   │  │
│  └──────────────┬────────────────────┘  │
│                 ↓                        │
│  ┌───────────────────────────────────┐  │
│  │ _add_annotation()                 │  │
│  │   → Комментарий в документе       │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
    ↓
Обработанный документ + резервная копия
    ↓
Frontend (отображение результатов)
```

---

## Заключение

Система использует **два агента**:

1. **Агент распознавания** - формирует перечень изменений из текста инструкций
2. **Агент применения** - сопоставляет изменения с документом и применяет их через python-docx (через MCP Word Server)

Оба агента работают последовательно в рамках одного процесса `DocumentChangeAgent.process_documents()`.

