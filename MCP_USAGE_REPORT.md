# Отчет об использовании MCP Word Server

## Доступные операции через MCP Word Server

MCPClient предоставляет следующие методы, которые вызывают MCP Word Server:

### 1. Чтение и анализ документов

| Метод | MCP Tool | Используется? | Где используется |
|-------|----------|---------------|------------------|
| `get_document_text()` | `get_document_text` | ✅ **ДА** | `parlant_agent.py:447`, `app.py:420, 498` |
| `get_document_outline()` | `get_document_outline` | ❌ НЕТ | Не используется в коде |
| `find_text_in_document()` | `find_text_in_document` | ✅ **ДА** | `parlant_agent.py` (множество мест) |
| `get_paragraph_text()` | `get_paragraph_text_from_document` | ❌ НЕТ | Не используется в коде |

### 2. Модификация документов

| Метод | MCP Tool | Используется? | Где используется |
|-------|----------|---------------|------------------|
| `replace_text()` | `search_and_replace` | ❌ **НЕТ** | Не используется напрямую |
| `delete_paragraph()` | `delete_paragraph` | ❌ **НЕТ** | Не используется напрямую |
| `add_paragraph()` | `add_paragraph` | ⚠️ **ЧАСТИЧНО** | Используется только если `position=None` |
| `add_heading()` | `add_heading` | ⚠️ **ЧАСТИЧНО** | Используется только если `position=None` |
| `copy_document()` | `copy_document` | ✅ **ДА** | `parlant_agent.py:443` (создание бэкапа) |
| `add_comment()` | - | ❌ **НЕТ** | Реализовано локально через python-docx |

---

## Фактическое использование в коде

### ✅ Операции, которые ИСПОЛЬЗУЮТ MCP Word Server:

#### 1. `get_document_text()` - Извлечение текста из файла инструкций
```python
# parlant_agent.py:447
changes_text = await mcp_client.get_document_text(changes_file)

# app.py:420, 498 (проверка инструкций)
changes_text = await mcp_client.get_document_text(file_path)
```
**Использование:** ✅ Активно используется для чтения файлов с инструкциями

#### 2. `find_text_in_document()` - Поиск текста в документе
```python
# parlant_agent.py:663, 672, 684, 808, 817, 899, 907, 916, 989, 997, 1057, 1121
matches = await mcp_client.find_text_in_document(
    filename,
    normalized_target,
    match_case=match_case,
)
```
**Использование:** ✅ Активно используется для поиска целевого текста перед применением изменений

#### 3. `copy_document()` - Создание резервной копии
```python
# parlant_agent.py:443
await mcp_client.copy_document(source_file, backup_path)
```
**Использование:** ✅ Используется для создания бэкапа перед изменениями

#### 4. `add_comment()` - Добавление комментариев
```python
# parlant_agent.py:1130, 1160
comment_id = await mcp_client.add_comment(
    filename,
    paragraph_index,
    comment_text,
    author="DocumentChangeAgent"
)
```
**Использование:** ✅ Используется, но реализовано **локально через python-docx**, а не через MCP Server

---

### ❌ Операции, которые НЕ используют MCP Word Server (выполняются напрямую через python-docx):

#### 1. `replace_text()` - Замена текста
**Статус:** ❌ Не используется через MCP

**Вместо этого:**
```python
# parlant_agent.py:705, 750, 759, 763
doc = Document(filename)  # Напрямую через python-docx
# ... замена текста в параграфах
doc.save(filename)
```

#### 2. `delete_paragraph()` - Удаление параграфа
**Статус:** ❌ Не используется через MCP

**Вместо этого:**
```python
# parlant_agent.py:853
doc = Document(filename)  # Напрямую через python-docx
self._delete_paragraph(doc.paragraphs[start_idx])
doc.save(filename)
```

#### 3. `add_paragraph()` - Добавление параграфа
**Статус:** ⚠️ Используется только частично

**Через MCP (только если position=None):**
```python
# mcp_client.py:201-210
if position is None:
    result = await self._call_tool("add_paragraph", {...})
```

**Напрямую через python-docx (если position указан):**
```python
# mcp_client.py:212-214
self._insert_paragraph_locally(filename, text, position, style)
# Который использует Document(filename) напрямую
```

**В parlant_agent.py:**
```python
# parlant_agent.py:1023, 1083, 869
doc = Document(filename)  # Всегда напрямую через python-docx
doc.add_paragraph(text)
doc.save(filename)
```

#### 4. `add_heading()` - Добавление заголовка
**Статус:** ⚠️ Используется только частично (аналогично add_paragraph)

---

## Итоговая статистика использования

### Операции через MCP Word Server:
1. ✅ `get_document_text()` - **Активно используется**
2. ✅ `find_text_in_document()` - **Активно используется**
3. ✅ `copy_document()` - **Используется**
4. ⚠️ `add_comment()` - **Используется, но реализовано локально**

### Операции напрямую через python-docx:
1. ❌ `replace_text()` - **НЕ используется через MCP, только локально**
2. ❌ `delete_paragraph()` - **НЕ используется через MCP, только локально**
3. ❌ `add_paragraph()` - **НЕ используется через MCP, только локально**
4. ❌ `add_heading()` - **НЕ используется через MCP, только локально**

---

## Почему так происходит?

### Причины использования MCP Server:

1. **`get_document_text()`** - Удобно для извлечения всего текста из файла
2. **`find_text_in_document()`** - Нужен для поиска текста перед применением изменений
3. **`copy_document()`** - Простое копирование файла

### Причины НЕ использования MCP Server для модификаций:

1. **Точный контроль** - Прямая работа с python-docx дает больше контроля над операциями
2. **Производительность** - Избежание HTTP-запросов для каждой операции
3. **Сложные операции** - Массовые замены требуют итерации по всем параграфам
4. **Гибкость** - Возможность выполнять сложные манипуляции с XML структурой документа

---

## Примеры использования

### Пример 1: Замена текста (НЕ через MCP)

```python
# parlant_agent.py:640-785
async def _handle_replace_text(self, filename: str, change: Dict[str, Any]):
    # 1. Поиск через MCP Server
    matches = await mcp_client.find_text_in_document(filename, target_text)
    
    # 2. Замена напрямую через python-docx (НЕ через MCP!)
    doc = Document(filename)  # Напрямую
    for idx, para in enumerate(doc.paragraphs):
        if self._replace_in_paragraph(para, target_text, new_text):
            replaced_count += 1
    doc.save(filename)  # Сохранение напрямую
```

### Пример 2: Удаление параграфа (НЕ через MCP)

```python
# parlant_agent.py:798-953
async def _handle_delete_paragraph(self, filename: str, change: Dict[str, Any]):
    # 1. Поиск через MCP Server
    matches = await mcp_client.find_text_in_document(filename, target_text)
    
    # 2. Удаление напрямую через python-docx (НЕ через MCP!)
    doc = Document(filename)  # Напрямую
    self._delete_paragraph(doc.paragraphs[paragraph_index])
    doc.save(filename)  # Сохранение напрямую
```

### Пример 3: Вставка параграфа (НЕ через MCP)

```python
# parlant_agent.py:1013-1085
async def _handle_insert_paragraph(self, filename: str, change: Dict[str, Any]):
    # 1. Поиск через MCP Server
    matches = await mcp_client.find_text_in_document(filename, after_text)
    
    # 2. Вставка напрямую через python-docx (НЕ через MCP!)
    doc = Document(filename)  # Напрямую
    insert_after = doc.paragraphs[anchor_index]
    new_para = self._insert_paragraph_after(insert_after, text)
    doc.save(filename)  # Сохранение напрямую
```

---

## Выводы

### MCP Word Server используется для:
- ✅ **Чтения** документов (`get_document_text`)
- ✅ **Поиска** текста (`find_text_in_document`)
- ✅ **Копирования** файлов (`copy_document`)

### MCP Word Server НЕ используется для:
- ❌ **Замены** текста (выполняется напрямую через python-docx)
- ❌ **Удаления** параграфов (выполняется напрямую через python-docx)
- ❌ **Вставки** параграфов (выполняется напрямую через python-docx)
- ❌ **Добавления** заголовков (выполняется напрямую через python-docx)

### Архитектурный паттерн:

```
1. MCP Server используется для ПОИСКА и ЧТЕНИЯ
   ↓
2. python-docx используется для МОДИФИКАЦИИ
```

Это гибридный подход:
- **MCP Server** - для операций поиска и чтения (удобно, изолированно)
- **python-docx** - для операций модификации (быстрее, больше контроля)

---

## Рекомендации

Если нужно использовать MCP Server для всех операций, можно:

1. Заменить прямые вызовы `Document(filename)` на `mcp_client.replace_text()`
2. Заменить `self._delete_paragraph()` на `mcp_client.delete_paragraph()`
3. Заменить `doc.add_paragraph()` на `mcp_client.add_paragraph()`

Но текущий подход имеет преимущества:
- ✅ Быстрее (меньше HTTP-запросов)
- ✅ Больше контроля над операциями
- ✅ Возможность выполнения сложных массовых операций

