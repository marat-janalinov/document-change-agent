"""
Модуль для работы с базой данных PostgreSQL.
"""
import os
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv
from sqlalchemy import create_engine, Column, String, Boolean, DateTime, Integer, Text, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from contextlib import contextmanager

# Загрузка переменных окружения из .env файла
# Ищем .env файл в корне проекта (на уровень выше backend/)
env_path = Path(__file__).parent.parent / '.env'
if env_path.exists():
    load_dotenv(dotenv_path=env_path)
else:
    # Если .env не найден в корне, пробуем загрузить из текущей директории
    load_dotenv()

# Получение параметров подключения к базе данных из переменных окружения
POSTGRES_DB = os.getenv("POSTGRES_DB", "document_agent")
POSTGRES_USER = os.getenv("POSTGRES_USER", "postgres")
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", "postgres123")
POSTGRES_HOST = os.getenv("POSTGRES_HOST", "localhost")
POSTGRES_PORT = os.getenv("POSTGRES_PORT", "5432")

# URL базы данных PostgreSQL
# Используем DATABASE_URL из .env, если задан, иначе формируем из отдельных параметров
database_url_from_env = os.getenv("DATABASE_URL")
if database_url_from_env:
    DATABASE_URL = database_url_from_env
else:
    # Формируем URL из отдельных параметров
    DATABASE_URL = f"postgresql://{POSTGRES_USER}:{POSTGRES_PASSWORD}@{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}"

# Создание движка базы данных PostgreSQL
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,  # Проверка соединения перед использованием
    pool_size=10,
    max_overflow=20,
    echo=False,
    connect_args={"connect_timeout": 10}  # Таймаут подключения
)

# Базовый класс для моделей
Base = declarative_base()

# Фабрика сессий
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class User(Base):
    """Модель пользователя."""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, nullable=False, default="executive")  # executive, admin, security
    status = Column(String, nullable=False, default="active")  # active, blocked
    tags = Column(String, nullable=True)  # JSON строка с тегами
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        """Преобразование в словарь."""
        import json
        tags = json.loads(self.tags) if self.tags else []
        return {
            "id": str(self.id),
            "email": self.email,
            "username": self.username,
            "role": self.role,
            "status": self.status,
            "tags": tags,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
        }


class OperationLog(Base):
    """Модель лога операций проверки документов."""
    __tablename__ = "operation_logs"

    id = Column(Integer, primary_key=True, index=True)
    operation_id = Column(String, unique=True, index=True, nullable=False)  # UUID операции
    operation_type = Column(String, nullable=False)  # check_instructions, process_documents
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    username = Column(String, nullable=True)  # Имя пользователя на момент операции
    source_filename = Column(String, nullable=True)  # Исходный файл
    changes_filename = Column(String, nullable=True)  # Файл с инструкциями
    tokens_used = Column(Integer, default=0)  # Количество использованных токенов
    tokens_prompt = Column(Integer, default=0)  # Токены в промпте
    tokens_completion = Column(Integer, default=0)  # Токены в ответе
    total_changes = Column(Integer, default=0)  # Количество найденных изменений
    status = Column(String, nullable=False, default="completed")  # completed, failed, in_progress
    error_message = Column(Text, nullable=True)  # Сообщение об ошибке, если есть
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    def to_dict(self):
        """Преобразование в словарь."""
        return {
            "id": self.id,
            "operation_id": self.operation_id,
            "operation_type": self.operation_type,
            "user_id": self.user_id,
            "username": self.username,
            "source_filename": self.source_filename,
            "changes_filename": self.changes_filename,
            "tokens_used": self.tokens_used,
            "tokens_prompt": self.tokens_prompt,
            "tokens_completion": self.tokens_completion,
            "total_changes": self.total_changes,
            "status": self.status,
            "error_message": self.error_message,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
        }


@contextmanager
def get_db():
    """Контекстный менеджер для получения сессии БД."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_db_session():
    """Зависимость FastAPI для получения сессии БД."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Инициализация базы данных (создание таблиц)."""
    Base.metadata.create_all(bind=engine)
    
    # Создание администратора по умолчанию
    import bcrypt
    
    db = SessionLocal()
    try:
        # Проверяем, есть ли уже пользователи
        if db.query(User).count() == 0:
            # Хешируем пароль напрямую через bcrypt
            password = "admin123".encode('utf-8')
            salt = bcrypt.gensalt()
            hashed = bcrypt.hashpw(password, salt)
            
            admin = User(
                email="admin@example.com",
                username="admin",
                hashed_password=hashed.decode('utf-8'),
                role="admin",
                status="active",
                tags="[]"
            )
            db.add(admin)
            db.commit()
            
            # Создание персональной директории для администратора
            try:
                import os
                import re
                DATA_DIR = os.getenv("DATA_DIR", "/data")
                UPLOADS_DIR = os.path.join(DATA_DIR, "uploads")
                safe_username = re.sub(r'[^A-Za-z0-9_-]', '_', "admin")
                user_dir = os.path.join(UPLOADS_DIR, safe_username)
                os.makedirs(user_dir, exist_ok=True)
            except Exception as e:
                import logging
                logging.getLogger(__name__).warning(f"Не удалось создать директорию для admin: {e}")
            
            print("✓ Создан администратор по умолчанию: admin@example.com / admin123")
    finally:
        db.close()

