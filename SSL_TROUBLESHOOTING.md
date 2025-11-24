# 🔧 Диагностика и решение проблемы SSL с OpenAI API

**Дата:** 2025-11-24  
**Проблема:** `[SSL: CERTIFICATE_VERIFY_FAILED] certificate verify failed: unable to get local issuer certificate`

---

## 🚨 Текущая ситуация

Проблема сохраняется даже после добавления `certifi`. Возможные причины:

1. **Контейнер не пересобран** - старый код все еще работает
2. **certifi не установлен** - не добавлен в requirements.txt
3. **Проблема с сертификатами на сервере** - системные сертификаты устарели

---

## ✅ Решение 1: Временное отключение SSL (для тестирования)

### Добавить в `.env` на сервере:

```bash
OPENAI_VERIFY_SSL=false
```

**⚠️ ВНИМАНИЕ:** Это небезопасно! Используйте только для тестирования.

### Проверка в коде:

Код уже поддерживает эту опцию:
```python
verify_ssl = os.environ.get("OPENAI_VERIFY_SSL", "true").lower() == "true"
```

---

## ✅ Решение 2: Убедиться, что certifi установлен

### 1. Проверить в контейнере:

```bash
docker compose exec backend python -c "import certifi; print(certifi.where())"
```

### 2. Если certifi не установлен:

```bash
docker compose exec backend pip install certifi
docker compose restart backend
```

---

## ✅ Решение 3: Полная пересборка контейнера

```bash
# 1. Остановить контейнеры
docker compose down

# 2. Удалить старый образ
docker compose rm -f backend
docker rmi document-change-agent-backend || true

# 3. Пересобрать с нуля
docker compose build --no-cache backend

# 4. Запустить
docker compose up -d backend

# 5. Проверить логи
docker compose logs -f backend | grep -i "certifi\|SSL"
```

---

## ✅ Решение 4: Проверка сертификатов в контейнере

```bash
# Проверить наличие certifi
docker compose exec backend python -c "
import certifi
import os
cert_path = certifi.where()
print(f'certifi путь: {cert_path}')
print(f'Файл существует: {os.path.exists(cert_path)}')
if os.path.exists(cert_path):
    size = os.path.getsize(cert_path)
    print(f'Размер файла: {size} байт')
"

# Проверить подключение к OpenAI API
docker compose exec backend python -c "
import certifi
import httpx
import asyncio

async def test():
    cert_path = certifi.where()
    print(f'Используем certifi: {cert_path}')
    client = httpx.AsyncClient(verify=cert_path, timeout=10.0)
    try:
        response = await client.get('https://api.openai.com/v1/')
        print(f'✅ Успешно: HTTP {response.status_code}')
    except Exception as e:
        print(f'❌ Ошибка: {e}')
    finally:
        await client.aclose()

asyncio.run(test())
"
```

---

## ✅ Решение 5: Использование системных сертификатов

Если certifi не работает, можно попробовать использовать системные сертификаты:

```python
# В parlant_agent.py временно изменить:
import ssl
import certifi

# Попробовать системные сертификаты
try:
    import ssl
    ssl_context = ssl.create_default_context()
    verify_param = ssl_context
except:
    # Fallback на certifi
    cert_path = certifi.where()
    verify_param = cert_path
```

---

## 🔍 Диагностика на сервере

### Шаг 1: Проверить логи инициализации

```bash
docker compose logs backend | grep -i "certifi\|SSL\|инициализирован"
```

Должна быть строка:
```
Использование SSL сертификатов из certifi: /usr/local/lib/python3.11/site-packages/certifi/cacert.pem
```

### Шаг 2: Проверить установку certifi

```bash
docker compose exec backend pip list | grep certifi
```

### Шаг 3: Проверить версию Python и httpx

```bash
docker compose exec backend python --version
docker compose exec backend python -c "import httpx; print(httpx.__version__)"
```

---

## 🎯 Рекомендуемая последовательность действий

### Вариант A: Быстрое решение (временное)

1. Добавить в `.env` на сервере:
   ```bash
   OPENAI_VERIFY_SSL=false
   ```

2. Перезапустить контейнер:
   ```bash
   docker compose restart backend
   ```

3. Проверить работу

### Вариант B: Правильное решение

1. Убедиться, что `certifi` в `requirements.txt`

2. Полностью пересобрать контейнер:
   ```bash
   docker compose down
   docker compose build --no-cache backend
   docker compose up -d
   ```

3. Проверить логи:
   ```bash
   docker compose logs backend | grep -i certifi
   ```

4. Если проблема сохраняется, использовать Вариант A временно

---

## 📝 Изменения в коде

1. ✅ `certifi` добавлен в `requirements.txt`
2. ✅ Импорт `certifi` добавлен в `parlant_agent.py`
3. ✅ Использование `certifi.where()` для SSL сертификатов
4. ✅ Поддержка `OPENAI_VERIFY_SSL=false` для отключения проверки

---

## ⚠️ Важные замечания

1. **Безопасность:** Отключение SSL проверки (`OPENAI_VERIFY_SSL=false`) небезопасно и должно использоваться только для тестирования или если у вас есть другие механизмы безопасности (VPN, прокси с проверкой).

2. **Производительность:** Использование `certifi` не влияет на производительность.

3. **Обновление:** `certifi` обновляется регулярно, поэтому bundle всегда актуален.

---

**Версия:** 1.1  
**Дата:** 2025-11-24

