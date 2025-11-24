# 🚀 Инструкция по развертыванию Document Change Agent на Ubuntu Server

## Содержание

1. [Требования к системе](#требования-к-системе)
2. [Подготовка сервера](#подготовка-сервера)
3. [Установка Docker и Docker Compose](#установка-docker-и-docker-compose)
4. [Клонирование и настройка проекта](#клонирование-и-настройка-проекта)
5. [Настройка окружения](#настройка-окружения)
6. [Запуск проекта](#запуск-проекта)
7. [Настройка firewall](#настройка-firewall)
8. [Настройка Nginx (опционально)](#настройка-nginx-опционально)
9. [Настройка автозапуска](#настройка-автозапуска)
10. [Мониторинг и обслуживание](#мониторинг-и-обслуживание)
11. [Резервное копирование](#резервное-копирование)
12. [Обновление проекта](#обновление-проекта)
13. [Решение проблем](#решение-проблем)

---

## Требования к системе

### Минимальные требования

- **ОС:** Ubuntu 20.04 LTS или новее (рекомендуется 22.04 LTS)
- **RAM:** 4 GB (рекомендуется 8 GB)
- **CPU:** 2 ядра (рекомендуется 4 ядра)
- **Диск:** 20 GB свободного места (рекомендуется 50 GB)
- **Интернет:** Стабильное подключение для работы с OpenAI API

### Необходимое ПО

- Docker 20.10+
- Docker Compose 2.0+
- Git
- curl (для проверки)

---

## Подготовка сервера

### 1. Обновление системы

```bash
# Войдите на сервер
ssh user@your-server-ip

# Обновите систему
sudo apt update
sudo apt upgrade -y

# Установите необходимые утилиты
sudo apt install -y \
    curl \
    wget \
    git \
    nano \
    ufw \
    htop \
    net-tools
```

### 2. Создание пользователя (опционально)

Рекомендуется создать отдельного пользователя для приложения:

```bash
# Создание пользователя
sudo adduser document-agent

# Добавление в группу sudo (если нужно)
sudo usermod -aG sudo document-agent

# Переключение на нового пользователя
su - document-agent
```

---

## Установка Docker и Docker Compose

### Установка Docker

```bash
# Удаление старых версий (если есть)
sudo apt remove -y docker docker-engine docker.io containerd runc

# Установка зависимостей
sudo apt install -y \
    ca-certificates \
    gnupg \
    lsb-release

# Добавление официального GPG ключа Docker
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Настройка репозитория
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Установка Docker
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Добавление текущего пользователя в группу docker
sudo usermod -aG docker $USER

# Применение изменений группы (требуется перелогиниться)
newgrp docker

# Проверка установки
docker --version
docker compose version
```

### Установка Docker Compose (если используется старая версия)

```bash
# Скачивание последней версии
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose

# Установка прав на выполнение
sudo chmod +x /usr/local/bin/docker-compose

# Проверка
docker-compose --version
```

### Настройка Docker для автозапуска

```bash
# Включение автозапуска Docker
sudo systemctl enable docker
sudo systemctl start docker

# Проверка статуса
sudo systemctl status docker
```

---

## Клонирование и настройка проекта

### 1. Клонирование репозитория

```bash
# Переход в домашнюю директорию или рабочую папку
cd ~

# Клонирование проекта (замените URL на ваш репозиторий)
git clone https://github.com/yourusername/document-change-agent.git

# Или если проект уже есть, загрузите файлы через SCP/SFTP
# scp -r /local/path/to/project user@server:/home/user/

# Переход в директорию проекта
cd document-change-agent
```

### 2. Проверка структуры проекта

```bash
# Проверка наличия необходимых файлов
ls -la

# Должны быть видны:
# - docker-compose.yml
# - backend/
# - react/
# - mcp-server/
# - start.sh
```

---

## Настройка окружения

### 1. Создание файла .env

```bash
# Создание файла .env из примера (если есть)
if [ -f .env.example ]; then
    cp .env.example .env
else
    # Создание нового файла .env
    touch .env
fi

# Редактирование файла
nano .env
```

### 2. Настройка переменных окружения

Добавьте в файл `.env` следующие переменные:

```bash
# OpenAI API Key (ОБЯЗАТЕЛЬНО)
OPENAI_API_KEY=sk-your-openai-api-key-here

# База данных PostgreSQL
POSTGRES_DB=document_agent
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your-secure-password-here

# JWT Secret Key (для безопасности)
JWT_SECRET_KEY=your-very-secure-random-secret-key-min-32-chars

# MCP Server настройки (обычно не требуют изменения)
MCP_SERVER_HOST=mcp-server
MCP_SERVER_PORT=8000

# Data directory
DATA_DIR=/data
```

> ⚠️ **ВАЖНО:** 
> - Замените `your-openai-api-key-here` на ваш реальный OpenAI API ключ
> - Используйте надежный пароль для PostgreSQL
> - Сгенерируйте случайный JWT_SECRET_KEY (минимум 32 символа)

### 3. Генерация безопасного JWT Secret Key

```bash
# Генерация случайного ключа
openssl rand -hex 32

# Скопируйте результат в JWT_SECRET_KEY в файле .env
```

### 4. Установка прав на файл .env

```bash
# Ограничение доступа к файлу .env
chmod 600 .env
```

---

## Запуск проекта

### 1. Создание необходимых директорий

```bash
# Создание директорий для данных
mkdir -p data/{uploads,outputs,backups,logs,prompts}

# Установка прав (для Docker volumes)
sudo chmod -R 777 data/
```

### 2. Первый запуск

```bash
# Запуск всех сервисов
docker compose up --build -d

# Или если используется старая версия docker-compose
docker-compose up --build -d
```

### 3. Проверка статуса

```bash
# Проверка статуса контейнеров
docker compose ps

# Просмотр логов
docker compose logs -f

# Просмотр логов конкретного сервиса
docker compose logs -f backend
docker compose logs -f react-frontend
docker compose logs -f postgres
```

### 4. Проверка работоспособности

```bash
# Проверка health check backend
curl http://localhost:8000/health

# Проверка frontend
curl http://localhost:8080

# Должны вернуться успешные ответы
```

### 5. Доступ к приложению

После успешного запуска приложение будет доступно:

- **Веб-интерфейс:** `http://your-server-ip:8080`
- **API Backend:** `http://your-server-ip:8000`
- **MCP Server:** `http://your-server-ip:9000` (внутренний)

---

## Настройка firewall

### 1. Настройка UFW (Uncomplicated Firewall)

```bash
# Включение firewall
sudo ufw enable

# Разрешение SSH (ВАЖНО: сделайте это первым!)
sudo ufw allow 22/tcp

# Разрешение HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Разрешение портов приложения (если не используете Nginx)
sudo ufw allow 8080/tcp  # Frontend
sudo ufw allow 8000/tcp  # Backend API (опционально, только для внутреннего доступа)

# Проверка правил
sudo ufw status verbose
```

### 2. Настройка iptables (альтернатива)

Если используете iptables напрямую:

```bash
# Разрешение входящих соединений
sudo iptables -A INPUT -p tcp --dport 22 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 443 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 8080 -j ACCEPT

# Сохранение правил
sudo iptables-save > /etc/iptables/rules.v4
```

---

## Настройка Nginx (опционально)

Для production рекомендуется использовать Nginx как reverse proxy.

### 1. Установка Nginx

```bash
sudo apt install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

### 2. Создание конфигурации

```bash
# Создание конфигурации для приложения
sudo nano /etc/nginx/sites-available/document-change-agent
```

Добавьте следующую конфигурацию:

```nginx
server {
    listen 80;
    server_name your-domain.com;  # Замените на ваш домен или IP

    # Логи
    access_log /var/log/nginx/document-agent-access.log;
    error_log /var/log/nginx/document-agent-error.log;

    # Увеличение размера загружаемых файлов
    client_max_body_size 100M;

    # Проксирование на React Frontend
    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Таймауты для больших файлов
        proxy_connect_timeout 600s;
        proxy_send_timeout 600s;
        proxy_read_timeout 600s;
    }

    # Проксирование API запросов
    location /api {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Таймауты
        proxy_connect_timeout 600s;
        proxy_send_timeout 600s;
        proxy_read_timeout 600s;
        proxy_buffering off;
    }

    # Проксирование WebSocket
    location /ws {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 3. Активация конфигурации

```bash
# Создание символической ссылки
sudo ln -s /etc/nginx/sites-available/document-change-agent /etc/nginx/sites-enabled/

# Удаление дефолтной конфигурации (опционально)
sudo rm /etc/nginx/sites-enabled/default

# Проверка конфигурации
sudo nginx -t

# Перезагрузка Nginx
sudo systemctl reload nginx
```

### 4. Настройка SSL с Let's Encrypt (рекомендуется)

```bash
# Установка Certbot
sudo apt install -y certbot python3-certbot-nginx

# Получение сертификата
sudo certbot --nginx -d your-domain.com

# Автоматическое обновление
sudo certbot renew --dry-run
```

После настройки SSL обновите firewall:

```bash
sudo ufw allow 'Nginx Full'
```

---

## Настройка автозапуска

### 1. Создание systemd service

```bash
# Создание файла сервиса
sudo nano /etc/systemd/system/document-change-agent.service
```

Добавьте следующее содержимое:

```ini
[Unit]
Description=Document Change Agent
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/home/your-user/document-change-agent
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
TimeoutStartSec=0
User=your-user
Group=your-user

[Install]
WantedBy=multi-user.target
```

> ⚠️ **Замените:**
> - `/home/your-user/document-change-agent` на путь к вашему проекту
> - `your-user` на ваше имя пользователя

### 2. Активация сервиса

```bash
# Перезагрузка systemd
sudo systemctl daemon-reload

# Включение автозапуска
sudo systemctl enable document-change-agent.service

# Запуск сервиса
sudo systemctl start document-change-agent.service

# Проверка статуса
sudo systemctl status document-change-agent.service
```

---

## Мониторинг и обслуживание

### 1. Просмотр логов

```bash
# Все логи
docker compose logs -f

# Логи конкретного сервиса
docker compose logs -f backend
docker compose logs -f react-frontend
docker compose logs -f postgres
docker compose logs -f mcp-server

# Последние 100 строк
docker compose logs --tail=100 backend

# Логи с временными метками
docker compose logs -f --timestamps backend
```

### 2. Мониторинг ресурсов

```bash
# Использование ресурсов контейнерами
docker stats

# Использование диска
df -h
docker system df

# Использование памяти
free -h
```

### 3. Проверка здоровья сервисов

```bash
# Проверка статуса контейнеров
docker compose ps

# Проверка health check
curl http://localhost:8000/health

# Проверка доступности frontend
curl -I http://localhost:8080
```

### 4. Очистка системы

```bash
# Удаление неиспользуемых образов
docker image prune -a

# Удаление неиспользуемых volumes
docker volume prune

# Полная очистка (осторожно!)
docker system prune -a --volumes
```

---

## Резервное копирование

### 1. Резервное копирование базы данных

```bash
# Создание скрипта резервного копирования
nano ~/backup-db.sh
```

Добавьте содержимое:

```bash
#!/bin/bash
BACKUP_DIR="/home/your-user/backups"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="document_agent"
DB_USER="postgres"
DB_PASSWORD="your-password"

mkdir -p $BACKUP_DIR

# Резервное копирование PostgreSQL
docker compose exec -T postgres pg_dump -U $DB_USER $DB_NAME > $BACKUP_DIR/db_backup_$DATE.sql

# Сжатие
gzip $BACKUP_DIR/db_backup_$DATE.sql

# Удаление старых бэкапов (старше 7 дней)
find $BACKUP_DIR -name "db_backup_*.sql.gz" -mtime +7 -delete

echo "Backup completed: db_backup_$DATE.sql.gz"
```

```bash
# Установка прав на выполнение
chmod +x ~/backup-db.sh

# Тестовый запуск
~/backup-db.sh
```

### 2. Резервное копирование данных

```bash
# Создание скрипта резервного копирования данных
nano ~/backup-data.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/home/your-user/backups"
DATE=$(date +%Y%m%d_%H%M%S)
PROJECT_DIR="/home/your-user/document-change-agent"

mkdir -p $BACKUP_DIR

# Резервное копирование volumes
docker run --rm \
  -v document-change-agent_data-uploads:/data/uploads:ro \
  -v document-change-agent_data-outputs:/data/outputs:ro \
  -v document-change-agent_data-backups:/data/backups:ro \
  -v document-change-agent_data-prompts:/data/prompts:ro \
  -v $BACKUP_DIR:/backup \
  alpine tar czf /backup/data_backup_$DATE.tar.gz -C /data .

echo "Data backup completed: data_backup_$DATE.tar.gz"
```

```bash
chmod +x ~/backup-data.sh
```

### 3. Настройка автоматического резервного копирования

```bash
# Редактирование crontab
crontab -e

# Добавление задач (каждый день в 2:00)
0 2 * * * /home/your-user/backup-db.sh >> /home/your-user/backup-db.log 2>&1
0 3 * * * /home/your-user/backup-data.sh >> /home/your-user/backup-data.log 2>&1
```

---

## Обновление проекта

### 1. Обновление кода

```bash
# Переход в директорию проекта
cd ~/document-change-agent

# Остановка сервисов
docker compose down

# Обновление кода (если используется Git)
git pull origin main

# Или загрузка новых файлов через SCP/SFTP

# Пересборка и запуск
docker compose up --build -d

# Проверка статуса
docker compose ps
```

### 2. Обновление Docker образов

```bash
# Обновление всех образов
docker compose pull

# Пересборка с новыми образами
docker compose up --build -d
```

### 3. Обновление переменных окружения

```bash
# Редактирование .env
nano .env

# Перезапуск сервисов
docker compose restart
```

---

## Решение проблем

### Проблема: Контейнеры не запускаются

**Решение:**
```bash
# Проверка логов
docker compose logs

# Проверка статуса
docker compose ps -a

# Проверка портов
sudo netstat -tulpn | grep -E '8000|8080|9000'

# Перезапуск Docker
sudo systemctl restart docker
```

### Проблема: Ошибка подключения к базе данных

**Решение:**
```bash
# Проверка статуса PostgreSQL
docker compose ps postgres

# Проверка логов
docker compose logs postgres

# Проверка подключения
docker compose exec postgres psql -U postgres -d document_agent
```

### Проблема: Недостаточно места на диске

**Решение:**
```bash
# Проверка использования диска
df -h
docker system df

# Очистка неиспользуемых данных
docker system prune -a

# Удаление старых логов
docker compose logs --tail=0
```

### Проблема: Порт уже занят

**Решение:**
```bash
# Поиск процесса, использующего порт
sudo lsof -i :8080
sudo lsof -i :8000

# Остановка процесса или изменение порта в docker-compose.yml
```

### Проблема: Ошибка при сборке образов

**Решение:**
```bash
# Очистка кэша Docker
docker builder prune -a

# Пересборка без кэша
docker compose build --no-cache

# Проверка доступности интернета
ping -c 3 8.8.8.8
```

### Проблема: Frontend не подключается к Backend

**Решение:**
```bash
# Проверка сетевых настроек
docker network ls
docker network inspect document-change-agent_app-network

# Проверка доступности backend из frontend контейнера
docker compose exec react-frontend ping backend

# Проверка переменных окружения
docker compose exec react-frontend env | grep BACKEND
```

---

## Дополнительные настройки

### 1. Настройка swap (если мало RAM)

```bash
# Создание swap файла (4GB)
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Постоянное включение swap
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### 2. Настройка лимитов для Docker

```bash
# Редактирование конфигурации Docker
sudo nano /etc/docker/daemon.json
```

Добавьте:
```json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  },
  "storage-driver": "overlay2"
}
```

```bash
# Перезапуск Docker
sudo systemctl restart docker
```

### 3. Настройка мониторинга (опционально)

Для production рекомендуется настроить мониторинг:

- **Prometheus + Grafana** для метрик
- **Sentry** для отслеживания ошибок
- **ELK Stack** для централизованных логов

---

## Безопасность

### 1. Рекомендации по безопасности

- ✅ Используйте сильные пароли для всех сервисов
- ✅ Регулярно обновляйте систему и Docker
- ✅ Используйте SSL/TLS для production
- ✅ Ограничьте доступ к портам только необходимым IP
- ✅ Регулярно делайте резервные копии
- ✅ Мониторьте логи на предмет подозрительной активности
- ✅ Не храните секреты в Git репозитории

### 2. Ограничение доступа к API

```bash
# В firewall разрешите доступ только с определенных IP
sudo ufw allow from 192.168.1.0/24 to any port 8000
```

### 3. Регулярные обновления

```bash
# Обновление системы
sudo apt update && sudo apt upgrade -y

# Обновление Docker
sudo apt update && sudo apt install --only-upgrade docker-ce docker-ce-cli containerd.io
```

---

## Полезные команды

### Управление контейнерами

```bash
# Запуск
docker compose up -d

# Остановка
docker compose down

# Перезапуск
docker compose restart

# Перезапуск конкретного сервиса
docker compose restart backend

# Просмотр статуса
docker compose ps

# Просмотр логов
docker compose logs -f
```

### Управление данными

```bash
# Просмотр volumes
docker volume ls

# Просмотр содержимого volume
docker run --rm -v document-change-agent_data-uploads:/data alpine ls -la /data

# Очистка volumes (ОСТОРОЖНО!)
docker compose down -v
```

### Отладка

```bash
# Вход в контейнер
docker compose exec backend bash
docker compose exec react-frontend sh

# Выполнение команд в контейнере
docker compose exec backend python -c "import sys; print(sys.version)"

# Проверка сетевых подключений
docker compose exec backend ping mcp-server
```

---

## Контакты и поддержка

Если возникли проблемы:

1. Проверьте раздел [Решение проблем](#решение-проблем)
2. Просмотрите логи: `docker compose logs`
3. Проверьте документацию проекта
4. Создайте issue в репозитории проекта

---

**Версия инструкции:** 1.0  
**Дата обновления:** 2025-11-24  
**Тестировано на:** Ubuntu 22.04 LTS

---

*Успешного развертывания! 🚀*

