# 🔗 Информация об URL OpenAI API в проекте

**Дата:** 2025-11-24

---

## 📍 Используемый URL

**По умолчанию:** `https://api.openai.com/v1/`

Проект использует официальный Python SDK OpenAI (`openai==1.51.2`), который по умолчанию обращается к официальному API OpenAI.

---

## 🔍 Где используется

### Файл: `backend/parlant_agent.py`

**Инициализация клиента:**
```python
self.openai_client = AsyncOpenAI(
    api_key=openai_key,
    http_client=self._openai_http_client,
)
```

**Использование:**
```python
response = await self.openai_client.chat.completions.create(
    model=self.model_name,
    messages=[...],
    ...
)
```

---

## 🔧 Настройка кастомного URL

Если нужно использовать другой endpoint (например, прокси или альтернативный API), можно добавить параметр `base_url`:

### Вариант 1: Через переменную окружения

**Добавить в `.env`:**
```env
OPENAI_BASE_URL=https://api.openai.com/v1/
# Или для прокси/альтернативного API:
# OPENAI_BASE_URL=https://your-proxy.com/v1/
```

**Изменить в `backend/parlant_agent.py`:**
```python
async def initialize(self) -> None:
    openai_key = os.environ.get("OPENAI_API_KEY")
    if not openai_key:
        raise RuntimeError("OPENAI_API_KEY не найден. Укажите ключ в .env.")

    # Получить base_url из переменных окружения
    base_url = os.environ.get("OPENAI_BASE_URL", None)
    
    self._openai_http_client = httpx.AsyncClient(timeout=300.0)
    try:
        self.openai_client = AsyncOpenAI(
            api_key=openai_key,
            http_client=self._openai_http_client,
            base_url=base_url,  # Добавить base_url
        )
    except Exception:
        await self._openai_http_client.aclose()
        self._openai_http_client = None
        raise
```

### Вариант 2: Прямо в коде

```python
self.openai_client = AsyncOpenAI(
    api_key=openai_key,
    http_client=self._openai_http_client,
    base_url="https://api.openai.com/v1/",  # Явно указать URL
)
```

---

## 📊 Текущая конфигурация

**Используется:**
- **SDK:** `openai==1.51.2`
- **Клиент:** `AsyncOpenAI`
- **URL по умолчанию:** `https://api.openai.com/v1/`
- **Модель:** `gpt-4o` (из переменной `OPENAI_MODEL`)

**Эндпоинты:**
- Chat Completions: `POST https://api.openai.com/v1/chat/completions`

---

## 🔍 Проверка используемого URL

**В логах можно увидеть:**
```
httpx - INFO - HTTP Request: POST https://api.openai.com/v1/chat/completions "HTTP/1.1 200 OK"
```

Это означает, что используется стандартный URL `https://api.openai.com/v1/`.

---

## ⚙️ Настройка через переменные окружения

**Текущие переменные:**
- `OPENAI_API_KEY` - API ключ (обязательно)
- `OPENAI_MODEL` - модель (по умолчанию: `gpt-4o`)

**Можно добавить:**
- `OPENAI_BASE_URL` - кастомный URL API (опционально)

---

## 📝 Пример использования кастомного URL

**Для использования прокси или альтернативного API:**

1. **Добавить в `.env`:**
```env
OPENAI_BASE_URL=https://your-proxy-server.com/v1/
```

2. **Обновить код в `backend/parlant_agent.py`:**
```python
base_url = os.environ.get("OPENAI_BASE_URL")
self.openai_client = AsyncOpenAI(
    api_key=openai_key,
    http_client=self._openai_http_client,
    base_url=base_url,
)
```

---

## ✅ Итог

**Текущий URL:** `https://api.openai.com/v1/` (стандартный официальный API)

**Настройка:** Можно добавить поддержку кастомного URL через переменную окружения `OPENAI_BASE_URL`.

---

**Версия:** 1.0  
**Дата:** 2025-11-24

