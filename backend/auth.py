"""
Модуль для аутентификации и авторизации.
"""
import os
import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from dotenv import load_dotenv
from database import get_db_session, User

# Загрузка переменных окружения из .env файла
# Ищем .env файл в корне проекта (на уровень выше backend/)
env_path = Path(__file__).parent.parent / '.env'
if env_path.exists():
    load_dotenv(dotenv_path=env_path)
else:
    # Если .env не найден в корне, пробуем загрузить из текущей директории
    load_dotenv()

# Настройки JWT
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 часа

# Контекст для хеширования паролей
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Схема безопасности
security = HTTPBearer(auto_error=False)  # Не выбрасываем ошибку, если токен отсутствует

# Логирование
auth_logger = logging.getLogger(__name__)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Проверка пароля."""
    try:
        # Сначала пробуем через passlib
        return pwd_context.verify(plain_password, hashed_password)
    except (ValueError, AttributeError):
        # Если не получилось, пробуем напрямую через bcrypt
        import bcrypt
        try:
            return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
        except:
            return False


def get_password_hash(password: str) -> str:
    """Хеширование пароля."""
    try:
        # Пробуем через passlib
        return pwd_context.hash(password)
    except (ValueError, AttributeError):
        # Если не получилось, используем bcrypt напрямую
        import bcrypt
        return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Создание JWT токена."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db_session)
) -> Optional[User]:
    """
    Получение текущего пользователя из токена.
    Возвращает None, если токен отсутствует или невалиден (для опциональной аутентификации).
    """
    if not credentials:
        auth_logger.info("get_current_user: credentials отсутствуют (токен не передан)")
        return None
    
    try:
        token = credentials.credentials
        auth_logger.info(f"get_current_user: получен токен {token[:30]}...")
        auth_logger.info(f"get_current_user: SECRET_KEY = {SECRET_KEY[:20]}...")
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        auth_logger.info(f"get_current_user: payload декодирован: {payload}")
        user_id_str = payload.get("sub")
        if user_id_str is None:
            auth_logger.warning("get_current_user: user_id отсутствует в payload")
            return None
        # Преобразуем user_id в int
        try:
            user_id = int(user_id_str)
        except (ValueError, TypeError):
            auth_logger.warning(f"get_current_user: некорректный user_id: {user_id_str}")
            return None
        auth_logger.info(f"get_current_user: user_id = {user_id}")
    except JWTError as e:
        auth_logger.warning(f"get_current_user: ошибка декодирования JWT: {e}")
        return None
    except Exception as e:
        auth_logger.error(f"get_current_user: неожиданная ошибка: {e}", exc_info=True)
        return None
    
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        auth_logger.warning(f"get_current_user: пользователь с id={user_id} не найден в БД")
        return None
    
    if user.status != "active":
        auth_logger.warning(f"get_current_user: пользователь {user_id} неактивен (status={user.status})")
        return None
    
    auth_logger.info(f"get_current_user: пользователь найден: {user.username} (id={user.id})")
    return user


def get_current_admin_user(current_user: Optional[User] = Depends(get_current_user)) -> User:
    """Проверка, что пользователь является администратором."""
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Требуется аутентификация"
        )
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав доступа"
        )
    return current_user
