FROM python:3.11-slim

WORKDIR /app

# Установка системных зависимостей И обновление ca-certificates
RUN apt-get update && apt-get install -y \
    git \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && update-ca-certificates

# Клонирование Office-Word-MCP-Server
RUN git clone https://github.com/GongRzhe/Office-Word-MCP-Server.git .

# Установка Python зависимостей
RUN pip install --no-cache-dir -r requirements.txt

# Создание директорий для данных
RUN mkdir -p /data/uploads /data/outputs /data/backups

# Порт для MCP сервера
EXPOSE 8000

# Запуск MCP сервера
CMD ["python", "word_mcp_server.py"]
