FROM python:3.11-slim

WORKDIR /app

# Установка системных зависимостей И обновление ca-certificates
RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    libpq-dev \
    ca-certificates \
    openssl \
    && rm -rf /var/lib/apt/lists/* \
    && update-ca-certificates

# Обновление pip и certifi для Python (с отключением SSL проверки для обновления)
RUN pip install --trusted-host pypi.org --trusted-host files.pythonhosted.org --upgrade pip certifi

# Обновление certifi для Python (критично для работы с OpenAI API)
RUN python -m certifi

# Копирование requirements и установка зависимостей
COPY requirements.txt .
RUN pip install --trusted-host pypi.org --trusted-host files.pythonhosted.org --no-cache-dir -r requirements.txt

# Копирование кода приложения
COPY . .

# Создание директорий
RUN mkdir -p /data/uploads /data/outputs /data/backups /data/logs /data/database

# Порт приложения
EXPOSE 8000

# Команда запуска
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
