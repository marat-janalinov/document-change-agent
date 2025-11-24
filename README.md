# 📄 Document Change Agent

> Автоматизированная система применения изменений к Word документам с использованием **Parlant Framework** и **MCP Word Server**

[![Docker](https://img.shields.io/badge/Docker-Ready-blue)](https://www.docker.com/)
[![Python](https://img.shields.io/badge/Python-3.11-green)](https://www.python.org/)
[![Parlant](https://img.shields.io/badge/Parlant-Framework-purple)](https://parlant.io/)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

## 🎯 Что это?

Document Change Agent - это интеллектуальная система, которая автоматически применяет изменения к Word документам на основе инструкций в естественном языке.

**Пример использования:**
1. У вас есть технический документ на 50 страниц
2. Нужно применить 20 изменений из другого документа
3. Агент автоматически находит нужные места и применяет все изменения
4. Каждое изменение аннотируется с полной трассировкой

## ✨ Ключевые возможности

- 🤖 **Parlant Framework** - надежное управление поведением LLM агента
- 📝 **MCP Word Server** - профессиональная работа с Word документами
- 🔄 **Real-time обновления** - WebSocket для мониторинга прогресса
- 📊 **Полная трассировка** - каждое изменение с аннотацией
- 🎨 **Веб-интерфейс** - простой и понятный UI
- 🐳 **Docker Compose** - один клик для развертывания
- 💾 **Автоматический backup** - безопасность данных

## 🏗️ Архитектура

```
┌─────────────────────────────────────────────────────────┐
│                  User Browser (port 3000)               │
└────────────────────┬────────────────────────────────────┘
                     │ HTTP/WebSocket
┌────────────────────▼────────────────────────────────────┐
│              Nginx + Frontend (Static)                  │
│  • React-like interface                                 │
│  • Real-time progress updates                           │
└────────────────────┬────────────────────────────────────┘
                     │ Proxy to Backend
┌────────────────────▼────────────────────────────────────┐
│         FastAPI Backend (port 8000)                     │
│  • REST API endpoints                                   │
│  • WebSocket server                                     │
│  • Session management                                   │
└────────────────────┬────────────────────────────────────┘
                     │ Parlant SDK
┌────────────────────▼────────────────────────────────────┐
│           Parlant Agent (DocumentChangeAgent)           │
│  • Guidelines (поведенческие правила)                   │
│  • Tools (MCP + внутренние функции)                     │
│  • Self-critique (проверка выполнения)                  │
└────────────────────┬────────────────────────────────────┘
                     │ MCP Protocol
┌────────────────────▼────────────────────────────────────┐
│       MCP Word Server (Office-Word-MCP-Server)          │
│  • find_text_in_document()                              │
│  • replace_text()                                       │
│  • add_comment()                                        │
│  • delete_paragraph()                                   │
│  • 20+ инструментов для Word                            │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│              Word Documents (.docx)                     │
│  • source.docx (исходный документ)                      │
│  • changes.docx (инструкции изменений)                  │
│  • output.docx (результат с аннотациями)                │
└─────────────────────────────────────────────────────────┘
```

## 🚀 Быстрый старт

### Метод 1: Автоматический запуск

```bash
# 1. Настройка
cp .env.example .env
# Добавьте ваш OPENAI_API_KEY в .env

# 2. Запуск одной командой
./start.sh
```

### Метод 2: Ручной запуск

```bash
# 1. Настройка
cp .env.example .env
nano .env  # Добавьте OPENAI_API_KEY

# 2. Запуск
docker-compose up --build

# 3. Откройте браузер
open http://localhost:3000
```

**Через 30 секунд система готова к работе!** 🎉

## 📁 Структура проекта

```
document-change-agent/
│
├── 📄 docker-compose.yml          # Оркестрация всех сервисов
├── 📄 start.sh                    # Скрипт быстрого запуска
├── 📄 README.md                   # Этот файл
├── 📄 QUICKSTART.md               # Детальное руководство
├── 📄 .env.example                # Пример конфигурации
│
├── 🐳 mcp-server/                 # MCP Word Server
│   └── Dockerfile                 # Клонирует GongRzhe/Office-Word-MCP-Server
│
├── 🎯 backend/                    # FastAPI + Parlant Agent
│   ├── Dockerfile
│   ├── requirements.txt           # Python зависимости
│   ├── app.py                     # FastAPI приложение
│   ├── parlant_agent.py           # Конфигурация Parlant агента
│   ├── mcp_client.py              # MCP клиент
│   └── generate_test_files.py    # Генератор тестовых файлов
│
├── 🎨 frontend/                   # Веб интерфейс
│   ├── Dockerfile
│   ├── nginx.conf                 # Конфигурация Nginx
│   ├── index.html                 # HTML интерфейс
│   └── static/
│       ├── style.css              # Стили
│       └── app.js                 # JavaScript логика
│
└── 💾 data/                       # Persistent storage
    ├── uploads/                   # Загруженные файлы
    ├── outputs/                   # Результаты обработки
    ├── backups/                   # Резервные копии
    └── logs/                      # Логи системы
```

## 🎬 Как это работает?

### Шаг 1: Подготовка документов

**Исходный документ (source.docx):**
```
1. Введение
   Система управления заказами...

2. Аутентификация
   2.1 Базовая аутентификация
   2.2 Token аутентификация

3. Endpoints
   3.1 Управление заказами
   3.2 Версия API
       Текущая версия API v1.2...
```

**Файл с инструкциями (changes.docx):**
```
Изменение 1: Обновление версии API
Измени в разделе 3.2 текст "версия API v1.2" на "версия API v2.0"

Изменение 2: Удаление устаревших методов
Удали весь раздел "5. Устаревшие методы"

Изменение 3: Добавление нового раздела
Добавь новый раздел "2.3 OAuth 2.0" после раздела 2.2...
```

### Шаг 2: Обработка Parlant Agent

```python
# Parlant Agent автоматически:
1. Парсит инструкции из changes.docx
2. Для каждого изменения:
   ✓ Находит целевой текст через MCP
   ✓ Применяет изменение
   ✓ Добавляет аннотацию с метаданными
   ✓ Логирует операцию
3. Генерирует итоговый отчет
```

### Шаг 3: Результат

**Обработанный документ с аннотациями:**
```
3.2 Версия API
Текущая версия API v2.0...  📝 [Комментарий]

━━━━━━━━━━━━━━━━━━━━━━━━━
[CHG-001] REPLACE
━━━━━━━━━━━━━━━━━━━━━━━━━
Источник: changes.docx, §1
Изменено: "v1.2" → "v2.0"
Время: 2025-11-07 14:23:15
Статус: SUCCESS
━━━━━━━━━━━━━━━━━━━━━━━━━
```

## 🔧 Технологический стек

| Компонент | Технология | Назначение |
|-----------|-----------|------------|
| **Backend** | FastAPI | REST API + WebSocket |
| **Agent Framework** | Parlant | Управление поведением LLM |
| **LLM** | OpenAI GPT-4.1 Mini | Анализ и принятие решений |
| **MCP Server** | Office-Word-MCP-Server | Манипуляции с Word |
| **Frontend** | Vanilla JS + CSS | Веб-интерфейс |
| **Web Server** | Nginx | Статика + проксирование |
| **Deployment** | Docker Compose | Оркестрация |

## 📡 API Endpoints

### Генерация тестовых файлов
```bash
POST /api/generate-test-files
```

### Загрузка файла
```bash
POST /api/upload-file
Content-Type: multipart/form-data
```

### Запуск обработки
```bash
POST /api/process-documents
{
  "source_filename": "source.docx",
  "changes_filename": "changes.docx"
}
```

### Статус обработки
```bash
GET /api/session/{session_id}/status
```

### WebSocket для real-time обновлений
```bash
WS /ws/{session_id}
```

### Скачивание результата
```bash
GET /api/download/{filename}
```

## 🎨 Скриншоты интерфейса

### Загрузка файлов
```
┌─────────────────────────────────────────────┐
│  📄 Исходный документ   📋 Инструкции       │
│  ┌──────────────┐       ┌──────────────┐    │
│  │   Загрузить  │       │   Загрузить  │    │
│  │    файл      │       │    файл      │    │
│  └──────────────┘       └──────────────┘    │
│                                             │
│    🎲 Сгенерировать тестовые файлы         │
│                                             │
│         ▶️ Начать обработку                 │
└─────────────────────────────────────────────┘
```

### Прогресс обработки
```
┌─────────────────────────────────────────────┐
│  Применение изменений                       │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━ 47%           │
│                                             │
│  ✓ CHG-001 | REPLACE | Секция 3.2          │
│  ✓ CHG-002 | DELETE  | Секция 4.5          │
│  → CHG-003 | INSERT  | После 2.3           │
│                                             │
│  LIVE LOG:                                  │
│  14:23:45 | CHG-003 | Finding target...    │
└─────────────────────────────────────────────┘
```

## 💡 Примеры использования

### Пример 1: Обновление API документации
```
Задача: Обновить версию API с v1.2 на v2.0 в 50 местах документа
Решение: Один файл с инструкциями → автоматическое применение всех изменений
```

### Пример 2: Реструктуризация документа
```
Задача: Удалить устаревшие разделы и добавить новые
Решение: Агент применяет все изменения с сохранением структуры
```

### Пример 3: Массовая замена терминологии
```
Задача: Заменить "клиент" на "пользователь" во всем документе
Решение: Одна инструкция → все замены с аннотациями
```

## 🐛 Troubleshooting

<details>
<summary><b>Backend не запускается</b></summary>

**Проблема**: Ошибка при запуске backend контейнера

**Решение**:
```bash
# Проверьте API ключ
cat .env | grep OPENAI_API_KEY

# Проверьте логи
docker-compose logs backend
```
</details>

<details>
<summary><b>MCP Server недоступен</b></summary>

**Проблема**: Backend не может подключиться к MCP серверу

**Решение**:
```bash
# Дождитесь полной инициализации (10-15 секунд)
docker-compose logs mcp-server

# Проверьте, что контейнер запущен
docker-compose ps
```
</details>

<details>
<summary><b>Порт 3000 занят</b></summary>

**Проблема**: Веб-интерфейс не открывается

**Решение**:
```bash
# Измените порт в docker-compose.yml
frontend:
  ports:
    - "8080:80"  # вместо 3000:80
```
</details>

## 🚀 Roadmap

- [ ] Поддержка большего количества операций (REORDER, MODIFY)
- [ ] Обработка конфликтов и зависимостей между изменениями
- [ ] Интеграция с Google Drive / Dropbox
- [ ] Batch обработка множества документов
- [ ] Генерация детальных PDF отчетов
- [ ] REST API для интеграции с другими системами
- [ ] Поддержка других форматов (Excel, PowerPoint)

## 📚 Документация

- [Быстрый старт](QUICKSTART.md) - Детальное руководство по запуску
- [Parlant Docs](https://parlant.io/docs) - Документация Parlant Framework
- [MCP Word Server](https://github.com/GongRzhe/Office-Word-MCP-Server) - Репозиторий MCP сервера

## 🤝 Contributing

Приветствуются любые contributions! Если у вас есть идеи или вы нашли баг:

1. Fork проекта
2. Создайте feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit изменения (`git commit -m 'Add some AmazingFeature'`)
4. Push в branch (`git push origin feature/AmazingFeature`)
5. Откройте Pull Request

## 📄 License

Этот проект распространяется под лицензией MIT. См. файл `LICENSE` для деталей.

## 🙏 Благодарности

- [Parlant Framework](https://parlant.io/) - за отличный framework для управления агентами
- [GongRzhe](https://github.com/GongRzhe) - за Office-Word-MCP-Server
- [OpenAI](https://openai.com/) - за высококачественные модели GPT

## 📞 Поддержка

- 🐛 **Issues**: [GitHub Issues](https://github.com/yourusername/document-change-agent/issues)
- 💬 **Обсуждения**: [GitHub Discussions](https://github.com/yourusername/document-change-agent/discussions)
- 📧 **Email**: your.email@example.com

---

<p align="center">
  Сделано с ❤️ для автоматизации работы с документами
</p>

<p align="center">
  ⭐ Если проект полезен, поставьте звезду на GitHub!
</p>
