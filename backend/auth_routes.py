"""
API маршруты для аутентификации и управления пользователями.
"""
from datetime import timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from database import get_db_session, User, init_db, OperationLog
from auth import (
    verify_password,
    get_password_hash,
    create_access_token,
    get_current_user,
    get_current_admin_user,
    ACCESS_TOKEN_EXPIRE_MINUTES,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


# Pydantic модели
class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


class UserCreate(BaseModel):
    email: EmailStr
    username: str
    password: str
    role: str = "executive"
    tags: Optional[List[str]] = None


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    username: Optional[str] = None
    role: Optional[str] = None
    status: Optional[str] = None
    tags: Optional[List[str]] = None


class UserResponse(BaseModel):
    id: str
    email: str
    username: str
    role: str
    status: str
    tags: List[str]
    createdAt: str


@router.post("/login", response_model=LoginResponse)
async def login(credentials: LoginRequest, db: Session = Depends(get_db_session)):
    """Аутентификация пользователя."""
    user = db.query(User).filter(
        (User.username == credentials.username) | (User.email == credentials.username)
    ).first()
    
    if not user or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверное имя пользователя или пароль"
        )
    
    if user.status != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Пользователь заблокирован"
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(user.id)}, expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user.to_dict()
    }


@router.get("/me", response_model=UserResponse)
async def get_me(
    request: Request,
    db: Session = Depends(get_db_session)
):
    """Получение информации о текущем пользователе."""
    from auth import SECRET_KEY, ALGORITHM
    from jose import jwt
    
    # Проверяем заголовок Authorization напрямую
    auth_header = request.headers.get("Authorization")
    
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Требуется аутентификация"
        )
    
    try:
        # Извлекаем токен из заголовка
        token = auth_header[7:]
        
        # Декодируем токен
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        except jwt.ExpiredSignatureError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Токен истек"
            )
        except jwt.JWTError as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Невалидный токен: {str(e)}"
            )
        
        user_id_str = payload.get("sub")
        
        if user_id_str is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Невалидный токен: отсутствует user_id"
            )
        
        # Преобразуем user_id в int
        try:
            user_id = int(user_id_str)
        except (ValueError, TypeError):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Невалидный токен: некорректный user_id"
            )
        
        # Получаем пользователя из БД
        user = db.query(User).filter(User.id == user_id).first()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Пользователь не найден"
            )
        
        if user.status != "active":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Пользователь неактивен"
            )
        
        return UserResponse(**user.to_dict())
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Ошибка аутентификации: {str(e)}"
        )


@router.get("/users", response_model=List[UserResponse])
async def get_users(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db_session)
):
    """Получение списка всех пользователей (только для администраторов)."""
    users = db.query(User).all()
    return [UserResponse(**user.to_dict()) for user in users]


@router.post("/users", response_model=UserResponse)
async def create_user(
    user_data: UserCreate,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db_session)
):
    """Создание нового пользователя (только для администраторов)."""
    # Проверка уникальности email и username
    if db.query(User).filter(User.email == user_data.email).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Пользователь с таким email уже существует"
        )
    
    if db.query(User).filter(User.username == user_data.username).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Пользователь с таким именем уже существует"
        )
    
    # Валидация роли
    if user_data.role not in ["executive", "admin", "security"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Недопустимая роль"
        )
    
    import json
    new_user = User(
        email=user_data.email,
        username=user_data.username,
        hashed_password=get_password_hash(user_data.password),
        role=user_data.role,
        status="active",
        tags=json.dumps(user_data.tags or [])
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # Создание всех необходимых персональных директорий пользователя
    try:
        import os
        import re
        import logging
        logger = logging.getLogger(__name__)
        
        DATA_DIR = os.getenv("DATA_DIR", "/data")
        UPLOADS_DIR = os.path.join(DATA_DIR, "uploads")
        safe_username = re.sub(r'[^A-Za-z0-9_-]', '_', new_user.username)
        user_dir = os.path.join(UPLOADS_DIR, safe_username)
        
        # Создаем основную директорию пользователя
        os.makedirs(user_dir, exist_ok=True)
        
        # Создаем поддиректории source и changes
        source_dir = os.path.join(user_dir, "source")
        changes_dir = os.path.join(user_dir, "changes")
        os.makedirs(source_dir, exist_ok=True)
        os.makedirs(changes_dir, exist_ok=True)
        
        logger.info(f"Созданы директории для пользователя {new_user.username}: {user_dir}, {source_dir}, {changes_dir}")
    except Exception as e:
        # Логируем ошибку, но не прерываем создание пользователя
        import logging
        logging.getLogger(__name__).warning(f"Не удалось создать директории для пользователя {new_user.username}: {e}")
    
    return UserResponse(**new_user.to_dict())


@router.put("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    user_data: UserUpdate,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db_session)
):
    """Обновление пользователя (только для администраторов)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пользователь не найден"
        )
    
    if user_data.email and user_data.email != user.email:
        if db.query(User).filter(User.email == user_data.email).first():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Пользователь с таким email уже существует"
            )
        user.email = user_data.email
    
    if user_data.username and user_data.username != user.username:
        if db.query(User).filter(User.username == user_data.username).first():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Пользователь с таким именем уже существует"
            )
        user.username = user_data.username
    
    if user_data.role:
        if user_data.role not in ["executive", "admin", "security"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Недопустимая роль"
            )
        user.role = user_data.role
    
    if user_data.status:
        if user_data.status not in ["active", "blocked"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Недопустимый статус"
            )
        user.status = user_data.status
    
    if user_data.tags is not None:
        import json
        user.tags = json.dumps(user_data.tags)
    
    db.commit()
    db.refresh(user)
    
    return UserResponse(**user.to_dict())


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db_session)
):
    """Удаление пользователя (только для администраторов)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пользователь не найден"
        )
    
    # Нельзя удалить самого себя
    if user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Нельзя удалить самого себя"
        )
    
    # Удаляем все связанные записи в operation_logs
    try:
        logs_count = db.query(OperationLog).filter(OperationLog.user_id == user_id).count()
        if logs_count > 0:
            db.query(OperationLog).filter(OperationLog.user_id == user_id).delete()
            import logging
            logging.getLogger(__name__).info(f"Удалено {logs_count} записей логов для пользователя {user.username}")
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"Ошибка при удалении логов пользователя {user.username}: {e}")
        # Продолжаем удаление пользователя даже если не удалось удалить логи
    
    # Удаляем пользователя
    db.delete(user)
    db.commit()
    
    return {"message": "Пользователь удален"}
