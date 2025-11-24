FROM python:3.11-slim

WORKDIR /app

# Установка системных зависимостей И обновление ca-certificates
RUN apt-get update && apt-get install -y \
    git \
    ca-certificates \
    openssl \
    && rm -rf /var/lib/apt/lists/* \
    && update-ca-certificates

# Обновление pip и certifi для Python (с отключением SSL проверки для обновления)
RUN pip install --trusted-host pypi.org --trusted-host files.pythonhosted.org --upgrade pip certifi

# Клонирование Office-Word-MCP-Server (копирование с хоста, так как git clone имеет проблемы с SSL)
# ВАЖНО: Перед сборкой образа нужно клонировать репозиторий на хосте:
# cd mcp-server && git clone https://github.com/GongRzhe/Office-Word-MCP-Server.git Office-Word-MCP-Server
COPY Office-Word-MCP-Server/ .

# Установка Python зависимостей с доверенными хостами (для решения проблем с SSL)
RUN pip install --trusted-host pypi.org --trusted-host files.pythonhosted.org --no-cache-dir -r requirements.txt

# Создание директорий для данных
RUN mkdir -p /data/uploads /data/outputs /data/backups

# Порт для MCP сервера
EXPOSE 8000

# Запуск MCP сервера
CMD ["python", "word_mcp_server.py"]
