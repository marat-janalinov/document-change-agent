# 🔍 Проверка сетевого доступа к OpenAI API с сервера

**Дата:** 2025-11-24

---

## ✅ Команды для проверки

### 1. Проверка доступности домена

```bash
# Проверка DNS
nslookup api.openai.com

# Или через ping
ping -c 3 api.openai.com

# Проверка через curl
curl -I https://api.openai.com/v1/
```

---

### 2. Проверка HTTPS подключения

```bash
# Проверка SSL сертификата
openssl s_client -connect api.openai.com:443 -showcerts < /dev/null 2>/dev/null | grep -A 2 "subject\|issuer"

# Или проще
curl -v https://api.openai.com/v1/ 2>&1 | grep -E "SSL|TLS|certificate|Connected"
```

---

### 3. Проверка доступа к API endpoint

```bash
# Простой запрос (без авторизации, получим 401, но это нормально)
curl -X POST https://api.openai.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4o","messages":[{"role":"user","content":"test"}]}'

# Ожидаемый ответ: {"error":{"message":"Incorrect API key provided"...}}
# Это означает, что доступ есть, но нужен правильный API ключ
```

---

### 4. Проверка с API ключом

```bash
# С вашим API ключом (замените YOUR_API_KEY)
curl -X POST https://api.openai.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "model": "gpt-4o",
    "messages": [{"role": "user", "content": "Hello"}],
    "max_tokens": 10
  }'
```

---

### 5. Проверка через Python (как в проекте)

```bash
# Создать тестовый скрипт
cat > /tmp/test_openai.py << 'EOF'
import os
import httpx
from openai import AsyncOpenAI
import asyncio

async def test():
    api_key = os.environ.get("OPENAI_API_KEY", "test-key")
    client = AsyncOpenAI(api_key=api_key)
    
    try:
        response = await client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": "test"}],
            max_tokens=5
        )
        print("✅ API доступен!")
        print(f"Ответ: {response.choices[0].message.content}")
    except Exception as e:
        print(f"❌ Ошибка: {e}")
        if "401" in str(e) or "Incorrect API key" in str(e):
            print("✅ API доступен, но нужен правильный API ключ")
        elif "SSL" in str(e) or "certificate" in str(e):
            print("❌ Проблема с SSL сертификатами")
        elif "timeout" in str(e) or "Connection" in str(e):
            print("❌ Проблема с сетевым подключением")

asyncio.run(test())
EOF

# Запустить (нужен правильный OPENAI_API_KEY)
cd ~/document-change-agent
source .env 2>/dev/null || true
python3 /tmp/test_openai.py
```

---

## 🔧 Полная диагностика

### Скрипт для полной проверки

**Создайте на сервере файл `check_openai_access.sh`:**

```bash
#!/bin/bash
# check_openai_access.sh - Полная проверка доступа к OpenAI API

echo "=== Проверка доступа к OpenAI API ==="
echo ""

# 1. Проверка DNS
echo "1. Проверка DNS..."
if nslookup api.openai.com > /dev/null 2>&1; then
    echo "✅ DNS работает"
    nslookup api.openai.com | grep -A 2 "Name:"
else
    echo "❌ DNS не работает"
fi
echo ""

# 2. Проверка ping
echo "2. Проверка ping..."
if ping -c 2 api.openai.com > /dev/null 2>&1; then
    echo "✅ Ping работает"
else
    echo "⚠️  Ping не работает (может быть заблокирован ICMP)"
fi
echo ""

# 3. Проверка HTTPS подключения
echo "3. Проверка HTTPS подключения..."
if curl -s -o /dev/null -w "%{http_code}" --connect-timeout 10 https://api.openai.com/v1/ | grep -q "401\|404"; then
    echo "✅ HTTPS подключение работает"
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 10 https://api.openai.com/v1/)
    echo "   HTTP код: $HTTP_CODE"
else
    echo "❌ HTTPS подключение не работает"
    curl -v https://api.openai.com/v1/ 2>&1 | head -20
fi
echo ""

# 4. Проверка SSL сертификата
echo "4. Проверка SSL сертификата..."
if echo | openssl s_client -connect api.openai.com:443 -servername api.openai.com 2>/dev/null | grep -q "Verify return code: 0"; then
    echo "✅ SSL сертификат валиден"
else
    echo "❌ Проблема с SSL сертификатом"
    echo | openssl s_client -connect api.openai.com:443 -servername api.openai.com 2>&1 | grep -A 5 "Verify return code"
fi
echo ""

# 5. Проверка API endpoint
echo "5. Проверка API endpoint..."
RESPONSE=$(curl -s -w "\n%{http_code}" --connect-timeout 10 -X POST https://api.openai.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4o","messages":[{"role":"user","content":"test"}]}')

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | head -1)

if [ "$HTTP_CODE" = "401" ]; then
    echo "✅ API endpoint доступен (401 = нужна авторизация, это нормально)"
elif [ "$HTTP_CODE" = "200" ]; then
    echo "✅ API endpoint доступен и работает!"
elif echo "$BODY" | grep -q "SSL\|certificate"; then
    echo "❌ Проблема с SSL сертификатом"
    echo "$BODY"
else
    echo "⚠️  Неожиданный ответ: HTTP $HTTP_CODE"
    echo "$BODY" | head -5
fi
echo ""

# 6. Проверка через Python (если установлен)
echo "6. Проверка через Python SDK..."
if command -v python3 > /dev/null 2>&1; then
    python3 << 'PYEOF'
import sys
try:
    import httpx
    client = httpx.AsyncClient(timeout=10.0)
    import asyncio
    async def test():
        try:
            response = await client.get("https://api.openai.com/v1/")
            print(f"✅ Python httpx работает: HTTP {response.status_code}")
        except Exception as e:
            print(f"❌ Python httpx ошибка: {e}")
        finally:
            await client.aclose()
    asyncio.run(test())
except ImportError:
    print("⚠️  httpx не установлен (pip install httpx)")
except Exception as e:
    print(f"❌ Ошибка: {e}")
PYEOF
else
    echo "⚠️  Python3 не установлен"
fi
echo ""

echo "=== Проверка завершена ==="
```

**Сделать исполняемым и запустить:**
```bash
chmod +x check_openai_access.sh
./check_openai_access.sh
```

---

## 🔍 Быстрая проверка (одна команда)

```bash
# Простая проверка доступности
curl -s -o /dev/null -w "HTTP код: %{http_code}\nВремя подключения: %{time_connect}s\n" \
  --connect-timeout 10 \
  https://api.openai.com/v1/

# Ожидаемый результат:
# HTTP код: 401 (или 404)
# Время подключения: 0.xxx
```

---

## 🐳 Проверка из Docker контейнера

```bash
# Проверить из контейнера backend
docker compose exec backend curl -I https://api.openai.com/v1/

# Или через bash
docker compose exec backend bash -c "curl -v https://api.openai.com/v1/ 2>&1 | head -20"
```

---

## ⚠️ Типичные проблемы

### Проблема: DNS не работает

```bash
# Проверить DNS
cat /etc/resolv.conf

# Использовать публичные DNS
echo "nameserver 8.8.8.8" | sudo tee -a /etc/resolv.conf
echo "nameserver 1.1.1.1" | sudo tee -a /etc/resolv.conf
```

### Проблема: SSL сертификат не доверен

```bash
# Обновить ca-certificates
sudo apt update
sudo apt install -y ca-certificates
sudo update-ca-certificates
```

### Проблема: Файрвол блокирует

```bash
# Проверить файрвол
sudo ufw status

# Разрешить исходящие HTTPS соединения (обычно разрешены по умолчанию)
sudo ufw allow out 443/tcp
```

### Проблема: Прокси требуется

```bash
# Если нужен прокси, настроить переменные окружения
export HTTP_PROXY=http://proxy.example.com:8080
export HTTPS_PROXY=http://proxy.example.com:8080

# Проверить через прокси
curl -x $HTTPS_PROXY https://api.openai.com/v1/
```

---

## 📊 Интерпретация результатов

### ✅ Успешная проверка

- **DNS:** `api.openai.com` разрешается в IP адрес
- **HTTPS:** Подключение устанавливается
- **SSL:** Сертификат валиден
- **API:** HTTP 401 (нужна авторизация) или 200 (если ключ правильный)

### ❌ Проблемы

- **DNS не работает:** Проверить `/etc/resolv.conf`, использовать публичные DNS
- **SSL ошибки:** Обновить `ca-certificates`
- **Таймаут:** Проверить файрвол, прокси, сетевое подключение
- **Connection refused:** Проблема с сетью или файрволом

---

## 🎯 Рекомендуемая последовательность проверки

```bash
# 1. Базовая проверка DNS
nslookup api.openai.com

# 2. Проверка HTTPS
curl -I https://api.openai.com/v1/

# 3. Проверка API endpoint
curl -X POST https://api.openai.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4o","messages":[{"role":"user","content":"test"}]}'

# 4. Если все работает, проверить с реальным API ключом
```

---

**Версия:** 1.0  
**Дата:** 2025-11-24

