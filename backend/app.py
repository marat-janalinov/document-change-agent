"""
FastAPI Backend для Document Change Agent
"""
import asyncio
import json
import logging
import os
import re
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional

import uvicorn
from fastapi import FastAPI, File, Form, HTTPException, UploadFile, WebSocket, WebSocketDisconnect, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, RedirectResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from dotenv import load_dotenv

from generate_test_files import generate_test_files
from mcp_client import mcp_client
from parlant_agent import document_agent
from translation_service import translation_service

# Загрузка переменных окружения из .env файла
# Ищем .env файл в корне проекта (на уровень выше backend/)
env_path = Path(__file__).parent.parent / '.env'
if env_path.exists():
    load_dotenv(dotenv_path=env_path)
else:
    # Если .env не найден в корне, пробуем загрузить из текущей директории
    load_dotenv()

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


# Конфигурация
# Нормализуем DATA_DIR: если указан относительный путь, преобразуем в абсолютный
data_dir_raw = os.getenv("DATA_DIR", "/data")
logger.info(f"DATA_DIR из переменной окружения: '{data_dir_raw}'")

if data_dir_raw.startswith("./") or (not os.path.isabs(data_dir_raw) and not data_dir_raw.startswith("/")):
    # Относительный путь - преобразуем в абсолютный относительно корня проекта
    base_path = Path(__file__).parent.parent
    DATA_DIR = str(base_path / data_dir_raw.lstrip("./"))
    logger.info(f"DATA_DIR преобразован из относительного пути в: {DATA_DIR}")
else:
    DATA_DIR = data_dir_raw
    logger.info(f"DATA_DIR используется как абсолютный путь: {DATA_DIR}")

UPLOADS_DIR = os.path.join(DATA_DIR, "uploads")
OUTPUTS_DIR = os.path.join(DATA_DIR, "outputs")
BACKUPS_DIR = os.path.join(DATA_DIR, "backups")

logger.info(f"Итоговые пути: DATA_DIR={DATA_DIR}, UPLOADS_DIR={UPLOADS_DIR}")

# Создание директорий
for dir_path in [UPLOADS_DIR, OUTPUTS_DIR, BACKUPS_DIR]:
    os.makedirs(dir_path, exist_ok=True)


def get_user_directory(username: str) -> str:
    """
    Получение пути к персональной директории пользователя.
    Директория именуется по логину пользователя.
    """
    # Очистка username от опасных символов
    safe_username = re.sub(r'[^A-Za-z0-9_-]', '_', username)
    user_dir = os.path.join(UPLOADS_DIR, safe_username)
    return user_dir


def ensure_user_directory(username: str) -> str:
    """
    Создание персональной директории пользователя, если она не существует.
    Возвращает путь к директории.
    """
    user_dir = get_user_directory(username)
    os.makedirs(user_dir, exist_ok=True)
    return user_dir


def ensure_user_directories(username: str) -> str:
    """
    Создание всех необходимых персональных директорий пользователя:
    - основная директория пользователя
    - поддиректория source (для исходных файлов)
    - поддиректория changes (для файлов с инструкциями)
    
    Возвращает путь к основной директории пользователя.
    """
    user_dir = ensure_user_directory(username)
    
    # Создаем поддиректории source и changes
    source_dir = os.path.join(user_dir, "source")
    changes_dir = os.path.join(user_dir, "changes")
    
    os.makedirs(source_dir, exist_ok=True)
    os.makedirs(changes_dir, exist_ok=True)
    
    logger.info(f"Созданы директории для пользователя {username}: {user_dir}, {source_dir}, {changes_dir}")
    
    return user_dir


def check_file_access(filename: str, username: str) -> bool:
    """
    Проверка доступа пользователя к файлу.
    Файл должен находиться в персональной директории пользователя.
    """
    user_dir = get_user_directory(username)
    file_path = os.path.join(user_dir, filename)
    
    # Проверяем, что файл существует и находится в директории пользователя
    if not os.path.exists(file_path):
        return False
    
    # Проверяем, что путь файла действительно находится в директории пользователя
    # (защита от path traversal атак)
    try:
        real_file_path = os.path.realpath(file_path)
        real_user_dir = os.path.realpath(user_dir)
        return real_file_path.startswith(real_user_dir)
    except Exception:
        return False


def get_user_file_path(filename: str, username: str, file_type: Optional[str] = None) -> Optional[str]:
    """
    Получение полного пути к файлу пользователя с проверкой доступа.
    Если указан file_type ("source" или "changes"), ищет файл в соответствующей подпапке.
    Возвращает None, если доступ запрещен.
    """
    user_dir = get_user_directory(username)
    
    # Если указан тип файла, ищем в подпапке
    if file_type in ["source", "changes"]:
        file_path = os.path.join(user_dir, file_type, filename)
        if os.path.exists(file_path):
            # Проверяем, что путь действительно в директории пользователя
            try:
                real_file_path = os.path.realpath(file_path)
                real_user_dir = os.path.realpath(user_dir)
                if real_file_path.startswith(real_user_dir):
                    return file_path
            except Exception:
                return None
        return None
    
    # Иначе проверяем стандартным способом
    if not check_file_access(filename, username):
        return None
    return os.path.join(user_dir, filename)


def sanitize_filename(filename: str) -> str:
    """
    Очистка названия файла от потенциально опасных символов.
    """
    base_name = os.path.basename(filename)
    if not base_name:
        base_name = uuid.uuid4().hex
    name, ext = os.path.splitext(base_name)
    if not ext:
        ext = ".docx"
    elif ext.lower() != ".docx":
        ext = ".docx"
    safe_name = re.sub(r"[^A-Za-z0-9А-Яа-я._-]", "_", name)
    safe_name = safe_name.strip("_") or "document"
    safe_name = safe_name[:120]
    return f"{safe_name}{ext.lower()}"

# FastAPI app
app = FastAPI(
    title="Document Change Agent API",
    description="API для автоматизированного применения изменений к Word документам",
    version="1.0.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Хранилище активных сессий
active_sessions: Dict[str, Dict[str, Any]] = {}

# WebSocket connections
websocket_connections: Dict[str, WebSocket] = {}


# Models
class ProcessRequest(BaseModel):
    source_filename: Optional[str] = None
    changes_filename: Optional[str] = None


class SessionStatus(BaseModel):
    session_id: str
    status: str
    progress: Optional[Dict[str, Any]] = None
    results: Optional[Dict[str, Any]] = None


# Импорт модулей аутентификации
from database import init_db, User, get_db_session, OperationLog
from auth_routes import router as auth_router
from prompt_routes import router as prompt_router
from auth import get_current_user
from operation_logger import OperationLogger
from sqlalchemy.orm import Session
from typing import List

# Подключение роутеров
app.include_router(auth_router)
app.include_router(prompt_router)

# Startup event
@app.on_event("startup")
async def startup_event():
    """
    Инициализация при запуске
    """
    logger.info("🚀 Запуск Document Change Agent Backend...")
    
    # Инициализация базы данных
    try:
        init_db()
        logger.info("✓ База данных инициализирована")
        
        # Создание тестовых пользователей (если их нет)
        try:
            from create_users import create_users
            create_users()
            logger.info("✓ Пользователи проверены/созданы")
        except Exception as e:
            logger.warning(f"⚠ Ошибка создания пользователей: {e}")
        
        # Инициализация промптов в persistent volume
        try:
            from init_prompts import init_prompts
            init_prompts()
            logger.info("✓ Промпты инициализированы")
        except Exception as e:
            logger.warning(f"⚠ Ошибка инициализации промптов: {e}")
        
        # Создание персональных папок для всех существующих пользователей
        try:
            from database import SessionLocal, User
            db = SessionLocal()
            users = db.query(User).all()
            created_count = 0
            for user in users:
                try:
                    user_dir = ensure_user_directories(user.username)
                    if not os.path.exists(user_dir):
                        created_count += 1
                    logger.debug(f"Проверены/созданы папки для пользователя {user.username}: {user_dir}")
                except Exception as e:
                    logger.warning(f"Не удалось создать папку для пользователя {user.username}: {e}")
            db.close()
            if created_count > 0:
                logger.info(f"✓ Создано {created_count} персональных папок для пользователей")
            else:
                logger.info("✓ Все пользователи имеют персональные папки")
        except Exception as e:
            logger.warning(f"Ошибка при создании папок пользователей: {e}")
    except Exception as e:
        logger.error(f"✗ Ошибка инициализации БД: {e}", exc_info=True)
    
    # Инициализация Parlant агента
    try:
        await document_agent.initialize()
        logger.info("✓ Parlant агент инициализирован")
    except Exception as e:
        logger.error(f"✗ Ошибка инициализации агента: {e}", exc_info=True)
    
    logger.info("✓ Backend готов к работе")


# Shutdown event
@app.on_event("shutdown")
async def shutdown_event():
    """
    Cleanup при остановке
    """
    logger.info("🛑 Остановка Document Change Agent Backend...")
    
    # Закрытие Parlant агента
    await document_agent.close()
    
    # Закрытие MCP клиента
    await mcp_client.close()
    
    logger.info("✓ Backend остановлен")


# Корневой маршрут - редирект на React frontend
@app.get("/")
async def root():
    """
    Корневой маршрут - редирект на React frontend
    """
    return RedirectResponse(url="http://localhost:8080", status_code=302)

# Health check
@app.get("/health")
async def health_check():
    """
    Проверка состояния сервиса
    """
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "agent_initialized": document_agent.openai_client is not None
    }


# Генерация тестовых файлов
@app.post("/api/generate-test-files")
async def api_generate_test_files():
    """
    Генерация тестовых файлов для демонстрации
    """
    try:
        files = generate_test_files(DATA_DIR)
        
        return {
            "success": True,
            "files": {
                "source": os.path.basename(files["source"]),
                "changes": os.path.basename(files["changes"])
            },
            "message": "Тестовые файлы сгенерированы успешно"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Загрузка файлов
@app.post("/api/upload-file")
async def upload_file(
    file: UploadFile = File(...),
    file_type: str = Form("source"),  # Получаем из Form данных
    current_user: Optional[User] = Depends(get_current_user)
):
    """
    Загрузка Word документа в персональную директорию пользователя.
    Файл загружается в директорию /data/uploads/{username}/{file_type}/
    """
    # Проверка аутентификации
    if not current_user:
        logger.error("Попытка загрузки файла без аутентификации")
        raise HTTPException(status_code=401, detail="Требуется аутентификация")
    
    logger.info(f"Загрузка файла пользователем: {current_user.username} (ID: {current_user.id}, Role: {current_user.role})")
    logger.info(f"Тип файла из Form: '{file_type}' (тип Python: {type(file_type).__name__})")
    logger.info(f"Имя файла: {file.filename}")
    
    try:
        # Проверка расширения
        if not file.filename.lower().endswith('.docx'):
            raise HTTPException(
                status_code=400,
                detail="Поддерживаются только .docx файлы"
            )

        # Создание/проверка персональной директории пользователя и всех поддиректорий
        user_dir = ensure_user_directories(current_user.username)
        logger.info(f"Директория пользователя: {user_dir}")
        
        # Нормализация file_type (убираем пробелы, приводим к нижнему регистру)
        file_type_normalized = str(file_type).strip().lower() if file_type else "source"
        logger.info(f"Нормализованный тип файла: '{file_type_normalized}'")
        
        # Определяем подпапку в зависимости от типа файла
        if file_type_normalized == "source":
            target_dir = os.path.join(user_dir, "source")
            logger.info(f"✓ Файл будет сохранен в папку SOURCE: {target_dir}")
        elif file_type_normalized == "changes":
            target_dir = os.path.join(user_dir, "changes")
            logger.info(f"✓ Файл будет сохранен в папку CHANGES: {target_dir}")
        else:
            # Если file_type не указан или неверный, используем source по умолчанию
            logger.warning(f"⚠ Неизвестный тип файла '{file_type_normalized}', используем SOURCE по умолчанию")
            target_dir = os.path.join(user_dir, "source")
            file_type_normalized = "source"  # Устанавливаем правильный тип для дальнейшего использования
        
        original_name = file.filename
        filename = sanitize_filename(original_name)
        filepath = os.path.join(target_dir, filename)

        # Предотвращение перезаписи: добавление суффикса
        if os.path.exists(filepath):
            base, ext = os.path.splitext(filename)
            counter = 1
            while True:
                candidate = f"{base}_{counter}{ext}"
                candidate_path = os.path.join(target_dir, candidate)
                if not os.path.exists(candidate_path):
                    filename = candidate
                    filepath = candidate_path
                    break
                counter += 1

        content = await file.read()
        with open(filepath, 'wb') as f:
            f.write(content)
        
        logger.info(f"Файл {filename} загружен пользователем {current_user.username} в {target_dir}")
        logger.info(f"Полный путь к файлу: {filepath}")
        logger.info(f"Размер файла: {len(content)} байт")
        
        # Проверяем, что файл действительно сохранен
        if not os.path.exists(filepath):
            logger.error(f"Файл не был сохранен: {filepath}")
            raise HTTPException(
                status_code=500,
                detail=f"Файл не был сохранен: {filepath}"
            )
        
        # Проверяем доступ к файлу через get_user_file_path
        verified_path = get_user_file_path(filename, current_user.username, file_type=file_type_normalized)
        if not verified_path or verified_path != filepath:
            logger.warning(f"⚠ Несоответствие путей: сохранен в {filepath}, проверка вернула {verified_path}")
        else:
            logger.info(f"✓ Путь к файлу подтвержден: {verified_path}")
        
        logger.info(f"✓ Файл успешно сохранен и проверен: {filepath}")
        logger.info(f"✓ Файл сохранен в папку типа: {file_type_normalized}")
        
        return {
            "success": True,
            "filename": filename,
            "original_filename": original_name,
            "size": len(content),
            "file_type": file_type_normalized,
            "message": f"Файл {filename} загружен успешно в папку {file_type_normalized}"
        }
    
    except Exception as e:
        logger.error(f"Ошибка загрузки файла: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# Запуск обработки
@app.post("/api/process-documents")
async def process_documents(
    request: ProcessRequest,
    current_user: Optional[User] = Depends(get_current_user)
):
    """
    Запуск процесса применения изменений
    """
    try:
        # Создание новой сессии
        session_id = str(uuid.uuid4())
        
        if not request.source_filename or not request.changes_filename:
            raise HTTPException(
                status_code=400,
                detail="Необходимо указать source_filename и changes_filename"
            )

        if not current_user:
            raise HTTPException(status_code=401, detail="Требуется аутентификация")
        
        # Проверка доступа к файлам и получение путей
        source_path = get_user_file_path(request.source_filename, current_user.username, file_type="source")
        changes_path = get_user_file_path(request.changes_filename, current_user.username, file_type="changes")
        
        if not source_path:
            raise HTTPException(
                status_code=403,
                detail=f"Нет доступа к исходному файлу {request.source_filename} или файл не найден"
            )
        
        if not changes_path:
            raise HTTPException(
                status_code=403,
                detail=f"Нет доступа к файлу с инструкциями {request.changes_filename} или файл не найден"
            )
        
        # Сохранение резервной копии исходного файла в папку source пользователя
        try:
            import shutil
            from datetime import datetime
            
            # Убеждаемся, что все директории пользователя созданы
            user_dir = ensure_user_directories(current_user.username)
            source_dir = os.path.join(user_dir, "source")
            
            # Создаем имя резервной копии с timestamp
            base_name = os.path.splitext(request.source_filename)[0]
            extension = os.path.splitext(request.source_filename)[1]
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            backup_filename = f"{base_name}_backup_{timestamp}{extension}"
            backup_path = os.path.join(source_dir, backup_filename)
            
            # Копируем файл
            shutil.copy2(source_path, backup_path)
            logger.info(f"Резервная копия исходного файла сохранена: {backup_path}")
        except Exception as e:
            logger.error(f"Ошибка при создании резервной копии: {e}", exc_info=True)
            # Не прерываем обработку, если не удалось создать резервную копию
        
        # Создание лога операции
        user_id = current_user.id if current_user else None
        username = current_user.username if current_user else None
        operation_log = OperationLogger.create_log(
            operation_type="process_documents",
            user_id=user_id,
            username=username,
            source_filename=request.source_filename,
            changes_filename=request.changes_filename
        )
        operation_id = operation_log.operation_id
        
        # Инициализация сессии
        active_sessions[session_id] = {
            "status": "processing",
            "started_at": datetime.now().isoformat(),
            "source_file": source_path,
            "changes_file": changes_path,
            "operation_id": operation_id,
            "user_id": user_id,
            "username": username
        }
        
        # Запуск обработки в фоне
        asyncio.create_task(
            process_documents_task(
                session_id,
                source_path,
                changes_path,
                operation_id
            )
        )
        
        return {
            "session_id": session_id,
            "status": "processing",
            "message": "Обработка запущена"
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


async def process_documents_task(
    session_id: str,
    source_path: str,
    changes_path: str,
    operation_id: str
):
    """
    Фоновая задача обработки документов
    """
    try:
        logger.info(f"Начало обработки для сессии {session_id}")
        
        # Отправка уведомления о старте
        await send_websocket_update(session_id, {
            "type": "progress",
            "data": {
                "status": "Начало обработки...",
                "progress": 0
            }
        })
        
        # Вызов Parlant агента
        async def progress_callback(payload: Dict[str, Any]):
            await send_websocket_update(session_id, payload)

        result = await document_agent.process_documents(
            source_path,
            changes_path,
            session_id,
            progress_callback=progress_callback,
            operation_id=operation_id
        )
        
        # Обновление лога операции с информацией о токенах и результатах
        tokens_total = result.get("tokens_used", 0)
        tokens_prompt = result.get("tokens_prompt", 0)
        tokens_completion = result.get("tokens_completion", 0)
        total_changes = result.get("total_changes", 0)
        
        OperationLogger.update_log(
            operation_id=operation_id,
            tokens_used=tokens_total,
            tokens_prompt=tokens_prompt,
            tokens_completion=tokens_completion,
            total_changes=total_changes,
            status="completed"
        )
        
        # Обновление сессии
        active_sessions[session_id]["status"] = "completed"
        active_sessions[session_id]["results"] = result
        active_sessions[session_id]["completed_at"] = datetime.now().isoformat()
        
        logger.info(f"Обработка завершена для сессии {session_id}: успешно={result.get('successful', 0)}, ошибок={result.get('failed', 0)}, токенов={tokens_total}")
        
        # Отправка финального уведомления
        await send_websocket_update(session_id, {
            "type": "completed",
            "data": result
        })
    
    except Exception as e:
        # Обработка ошибки
        logger.error(f"Ошибка при обработке сессии {session_id}: {e}", exc_info=True)
        
        # Обновление лога операции с ошибкой
        if operation_id:
            OperationLogger.update_log(
                operation_id=operation_id,
                status="failed",
                error_message=str(e)
            )
        
        active_sessions[session_id]["status"] = "failed"
        active_sessions[session_id]["error"] = str(e)
        
        await send_websocket_update(session_id, {
            "type": "error",
            "data": {
                "error": str(e)
            }
        })


async def send_websocket_update(session_id: str, message: Dict[str, Any]):
    """
    Отправка обновления через WebSocket
    """
    if session_id in websocket_connections:
        try:
            await websocket_connections[session_id].send_json(message)
        except Exception as e:
            logger.warning(f"Ошибка отправки WebSocket для сессии {session_id}: {e}")


# Получение статуса сессии
@app.get("/api/session/{session_id}/status")
async def get_session_status(session_id: str):
    """
    Получение статуса обработки
    """
    if session_id not in active_sessions:
        raise HTTPException(status_code=404, detail="Сессия не найдена")
    
    session = active_sessions[session_id]
    
    return {
        "session_id": session_id,
        "status": session["status"],
        "started_at": session.get("started_at"),
        "completed_at": session.get("completed_at"),
        "results": session.get("results")
    }


# Скачивание результата
@app.get("/api/download/{filename}")
async def download_file(
    filename: str,
    file_type: Optional[str] = None,  # "source" или "changes"
    current_user: Optional[User] = Depends(get_current_user)
):
    """
    Скачивание файла из персональной директории пользователя.
    Ищет файл ТОЛЬКО в персональных папках пользователя: source или changes.
    Если указан file_type, ищет только в указанной папке.
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="Требуется аутентификация")
    
    logger.info(f"Запрос на скачивание файла {filename} от пользователя {current_user.username}, file_type={file_type}")
    
    file_path = None
    
    # Если указан тип файла, ищем только в указанной папке
    if file_type in ["source", "changes"]:
        potential_path = get_user_file_path(filename, current_user.username, file_type=file_type)
        if potential_path and os.path.exists(potential_path):
            file_path = potential_path
            logger.info(f"Файл найден в папке {file_type} пользователя {current_user.username}: {file_path}")
        else:
            logger.warning(f"Файл {filename} не найден в папке {file_type} пользователя {current_user.username}")
    else:
        # Если тип не указан, ищем в обеих папках (source, changes)
        for search_type in ["source", "changes"]:
            potential_path = get_user_file_path(filename, current_user.username, file_type=search_type)
            if potential_path and os.path.exists(potential_path):
                file_path = potential_path
                logger.info(f"Файл найден в папке {search_type} пользователя {current_user.username}: {file_path}")
                break
    
    if not file_path:
        logger.warning(f"Файл {filename} не найден в персональных папках пользователя {current_user.username}")
        raise HTTPException(
            status_code=403,
            detail=f"Нет доступа к файлу {filename} или файл не найден в папках source/changes пользователя"
        )
    
    return FileResponse(
        file_path,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        filename=filename
    )


# WebSocket для real-time обновлений
@app.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    """
    WebSocket соединение для real-time обновлений
    """
    await websocket.accept()
    websocket_connections[session_id] = websocket
    
    try:
        while True:
            # Ожидание сообщений от клиента (ping/pong)
            data = await websocket.receive_text()
            
            if data == "ping":
                await websocket.send_text("pong")
    
    except WebSocketDisconnect:
        logger.info(f"WebSocket отключен: {session_id}")
        if session_id in websocket_connections:
            del websocket_connections[session_id]


# Проверка файла на наличие инструкций
@app.post("/api/check-instructions")
async def check_instructions(
    filename: str,
    current_user: Optional[User] = Depends(get_current_user)
):
    """
    Проверка файла на наличие инструкций изменений
    """
    try:
        if not filename:
            raise HTTPException(status_code=400, detail="Необходимо указать filename")
        
        if not current_user:
            raise HTTPException(status_code=401, detail="Требуется аутентификация")
        
        # Проверка доступа к файлу (для проверки инструкций ищем в папке changes)
        file_path = get_user_file_path(filename, current_user.username, file_type="changes")
        if not file_path:
            raise HTTPException(
                status_code=403,
                detail=f"Нет доступа к файлу {filename} или файл не найден в папке changes"
            )
        
        logger.info(f"Проверка файла {filename} пользователем {current_user.username} на наличие инструкций")
        logger.info(f"Путь к файлу: {file_path}")
        
        # Создание лога операции
        user_id = current_user.id if current_user else None
        username = current_user.username if current_user else None
        operation_log = OperationLogger.create_log(
            operation_type="check_instructions",
            user_id=user_id,
            username=username,
            changes_filename=filename
        )
        operation_id = operation_log.operation_id
        
        try:
            # Извлекаем текст из файла
            try:
                logger.info(f"Извлечение текста из файла: {file_path}")
                changes_text = await mcp_client.get_document_text(file_path)
                logger.info(f"Извлечено {len(changes_text)} символов из файла")
            except Exception as e:
                logger.error(f"Ошибка извлечения текста из файла {filename}: {e}", exc_info=True)
                OperationLogger.update_log(
                    operation_id=operation_id,
                    status="failed",
                    error_message=f"Не удалось извлечь текст из файла: {str(e)}"
                )
                raise HTTPException(
                    status_code=500, 
                    detail=f"Не удалось извлечь текст из файла: {str(e)}"
                )
            
            # Распознавание изменений с помощью LLM
            try:
                all_changes, tokens_info = await document_agent._parse_changes_with_llm(changes_text, initial_changes=[])
                # Нумерация изменений
                for idx, change in enumerate(all_changes, start=1):
                    change["change_id"] = f"CHG-{idx:03d}"
                
                # Обновление лога с информацией о токенах
                OperationLogger.update_log(
                    operation_id=operation_id,
                    tokens_used=tokens_info.get("total_tokens", 0),
                    tokens_prompt=tokens_info.get("prompt_tokens", 0),
                    tokens_completion=tokens_info.get("completion_tokens", 0),
                    total_changes=len(all_changes),
                    status="completed"
                )
            except Exception as e:
                logger.warning(f"Ошибка LLM анализа для файла {filename}: {e}", exc_info=True)
                # Если LLM не сработал, возвращаем пустой список
                all_changes = []
                OperationLogger.update_log(
                    operation_id=operation_id,
                    status="failed",
                    error_message=f"Ошибка LLM анализа: {str(e)}"
                )
        except Exception as e:
            # Обновляем лог в случае любой ошибки
            OperationLogger.update_log(
                operation_id=operation_id,
                status="failed",
                error_message=str(e)
            )
            raise
        
        # Формируем детальный отчет
        report = {
            "filename": filename,
            "file_size": len(changes_text),
            "total_changes": len(all_changes),
            "parser_changes": 0,  # Быстрый парсер отключен
            "llm_changes": len(all_changes),
            "changes": all_changes,
            "summary": {
                "by_operation": {},
                "mass_replacements": [],
                "point_changes": [],
                "deletions": [],
                "insertions": []
            }
        }
        
        # Группируем по типам операций
        for change in all_changes:
            op = change.get("operation", "UNKNOWN")
            report["summary"]["by_operation"][op] = report["summary"]["by_operation"].get(op, 0) + 1
            
            if op == "REPLACE_TEXT" and change.get("target", {}).get("replace_all"):
                report["summary"]["mass_replacements"].append({
                    "old": change.get("target", {}).get("text", ""),
                    "new": change.get("payload", {}).get("new_text", "")
                })
            elif op == "REPLACE_POINT_TEXT":
                report["summary"]["point_changes"].append({
                    "point": change.get("target", {}).get("text", ""),
                    "description": change.get("description", "")
                })
            elif op == "DELETE_PARAGRAPH":
                report["summary"]["deletions"].append({
                    "target": change.get("target", {}).get("text", ""),
                    "description": change.get("description", "")
                })
            elif op in ["INSERT_PARAGRAPH", "INSERT_SECTION"]:
                report["summary"]["insertions"].append({
                    "description": change.get("description", ""),
                    "operation": op
                })
        
        return report
    
    except Exception as e:
        logger.error(f"Ошибка проверки инструкций: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# Экспорт результатов проверки в текстовый файл
@app.get("/api/export-check-results")
async def export_check_results(
    filename: str,
    current_user: Optional[User] = Depends(get_current_user)
):
    """
    Экспорт результатов проверки в текстовый файл
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="Требуется аутентификация")
    
    try:
        if not filename:
            raise HTTPException(status_code=400, detail="Необходимо указать filename")
        
        # Проверка доступа к файлу
        file_path = get_user_file_path(filename, current_user.username)
        if not file_path:
            raise HTTPException(
                status_code=403,
                detail=f"Нет доступа к файлу {filename} или файл не найден"
            )
        
        changes_text = await mcp_client.get_document_text(file_path)
        # Распознавание изменений с помощью LLM
        all_changes, _ = await document_agent._parse_changes_with_llm(changes_text, initial_changes=[])
        # Нумерация изменений
        for idx, change in enumerate(all_changes, start=1):
            change["change_id"] = f"CHG-{idx:03d}"
        
        # Формируем текстовый отчет
        report_lines = []
        report_lines.append("=" * 80)
        report_lines.append(f"ОТЧЕТ О ПРОВЕРКЕ ФАЙЛА НА НАЛИЧИЕ ИНСТРУКЦИЙ")
        report_lines.append("=" * 80)
        report_lines.append(f"Файл: {filename}")
        report_lines.append(f"Дата проверки: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        report_lines.append(f"Размер файла: {len(changes_text)} символов")
        report_lines.append("")
        report_lines.append(f"ИТОГО НАЙДЕНО ИНСТРУКЦИЙ: {len(all_changes)}")
        report_lines.append(f"  - Распознано парсером: 0 (отключен)")
        report_lines.append(f"  - Распознано LLM: {len(all_changes)}")
        report_lines.append("")
        
        # Группировка по типам
        by_operation = {}
        for change in all_changes:
            op = change.get("operation", "UNKNOWN")
            by_operation[op] = by_operation.get(op, 0) + 1
        
        report_lines.append("РАСПРЕДЕЛЕНИЕ ПО ТИПАМ ОПЕРАЦИЙ:")
        for op, count in sorted(by_operation.items()):
            report_lines.append(f"  - {op}: {count}")
        report_lines.append("")
        
        # Массовые замены
        mass_replacements = [
            c for c in all_changes 
            if c.get("operation") == "REPLACE_TEXT" and c.get("target", {}).get("replace_all")
        ]
        if mass_replacements:
            report_lines.append("МАССОВЫЕ ЗАМЕНЫ:")
            for change in mass_replacements:
                target = change.get("target", {})
                payload = change.get("payload", {})
                report_lines.append(f"  - '{target.get('text', '')}' → '{payload.get('new_text', '')}'")
            report_lines.append("")
        
        # Детальный список всех изменений
        report_lines.append("ДЕТАЛЬНЫЙ СПИСОК ИЗМЕНЕНИЙ:")
        report_lines.append("-" * 80)
        for idx, change in enumerate(all_changes, 1):
            report_lines.append(f"\n{idx}. {change.get('change_id', 'N/A')}: {change.get('operation', 'UNKNOWN')}")
            report_lines.append(f"   Описание: {change.get('description', 'Нет описания')}")
            
            if change.get("operation") == "REPLACE_TEXT":
                target = change.get("target", {})
                payload = change.get("payload", {})
                report_lines.append(f"   Ищем: '{target.get('text', '')}'")
                report_lines.append(f"   Заменяем на: '{payload.get('new_text', '')}'")
                if target.get("replace_all"):
                    report_lines.append(f"   Тип: МАССОВАЯ ЗАМЕНА")
            
            elif change.get("operation") == "DELETE_PARAGRAPH":
                target = change.get("target", {})
                report_lines.append(f"   Удаляем: '{target.get('text', '')}'")
            
            elif change.get("operation") == "REPLACE_POINT_TEXT":
                target = change.get("target", {})
                payload = change.get("payload", {})
                report_lines.append(f"   Пункт: '{target.get('text', '')}'")
                new_text = payload.get("new_text", "")
                if len(new_text) > 100:
                    new_text = new_text[:100] + "..."
                report_lines.append(f"   Новый текст: {new_text}")
            
            elif change.get("operation") == "INSERT_PARAGRAPH":
                target = change.get("target", {})
                payload = change.get("payload", {})
                report_lines.append(f"   После: '{target.get('after_text', '')}'")
                report_lines.append(f"   Вставляем: '{payload.get('text', '')[:100]}...'")
        
        report_lines.append("")
        report_lines.append("=" * 80)
        report_lines.append("Конец отчета")
        
        # Сохраняем в файл
        report_text = "\n".join(report_lines)
        report_filename = f"{os.path.splitext(filename)[0]}_check_report.txt"
        report_path = os.path.join(OUTPUTS_DIR, report_filename)
        
        with open(report_path, 'w', encoding='utf-8') as f:
            f.write(report_text)
        
        return FileResponse(
            report_path,
            media_type='text/plain; charset=utf-8',
            filename=report_filename,
            headers={"Content-Disposition": f"attachment; filename={report_filename}"}
        )
    
    except Exception as e:
        logger.error(f"Ошибка экспорта результатов: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# Список доступных файлов
@app.get("/api/files")
async def list_files(
    file_type: Optional[str] = Query(None, description="Тип файла: 'source' или 'changes'"),
    current_user: Optional[User] = Depends(get_current_user)
):
    """
    Список файлов пользователя из его персональной директории.
    Если указан file_type, возвращает файлы из соответствующей подпапки.
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="Требуется аутентификация")
    
    user_dir = get_user_directory(current_user.username)
    
    logger.info(f"Запрос списка файлов для пользователя {current_user.username}, file_type={file_type}")
    logger.info(f"DATA_DIR: {DATA_DIR}")
    logger.info(f"UPLOADS_DIR: {UPLOADS_DIR}")
    logger.info(f"Директория пользователя: {user_dir}")
    logger.info(f"Абсолютный путь к директории пользователя: {os.path.abspath(user_dir)}")
    logger.info(f"Существует ли директория пользователя: {os.path.exists(user_dir)}")
    
    files = {
        "uploads": [],
        "outputs": [],
        "backups": []
    }
    
    # Если указан тип файла, ищем в соответствующей подпапке
    if file_type in ["source", "changes"]:
        subdir = os.path.join(user_dir, file_type)
        logger.info(f"Поиск файлов в подпапке: {subdir}")
        logger.info(f"Абсолютный путь: {os.path.abspath(subdir)}")
        logger.info(f"Существует ли директория: {os.path.exists(subdir)}")
        
        if not os.path.exists(subdir):
            # Создаем поддиректорию, если она не существует
            logger.info(f"Создание поддиректории {subdir}")
            os.makedirs(subdir, exist_ok=True)
        
        if os.path.exists(subdir):
            try:
                all_files = os.listdir(subdir)
                logger.info(f"Все файлы в директории {subdir}: {all_files}")
                # Фильтруем файлы: только .docx и исключаем файлы резервного копирования
                docx_files = [
                    f for f in all_files 
                    if f.endswith('.docx') and '_backup_' not in f and os.path.isfile(os.path.join(subdir, f))
                ]
                files["uploads"] = docx_files
                logger.info(f"Найдено {len(docx_files)} файлов в папке {file_type} (исключены backup файлы): {docx_files}")
            except Exception as e:
                logger.error(f"Ошибка при чтении директории {subdir}: {e}", exc_info=True)
                files["uploads"] = []
        else:
            logger.warning(f"Подпапка {subdir} не существует и не была создана")
    else:
        # Если тип не указан, возвращаем все файлы из корня папки пользователя
        if os.path.exists(user_dir):
            files["uploads"] = [
                f for f in os.listdir(user_dir)
                if f.endswith('.docx') and os.path.isfile(os.path.join(user_dir, f)) and '_backup_' not in f
            ]
    
    return files


# Удаление файла
@app.delete("/api/files/{filename}")
async def delete_file(
    filename: str,
    file_type: Optional[str] = None,  # "source" или "changes"
    current_user: Optional[User] = Depends(get_current_user)
):
    """
    Удаление файла из персональной директории пользователя.
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="Требуется аутентификация")
    
    # Определяем путь к файлу
    if file_type in ["source", "changes"]:
        file_path = get_user_file_path(filename, current_user.username, file_type=file_type)
    else:
        file_path = get_user_file_path(filename, current_user.username)
    
    if not file_path:
        raise HTTPException(
            status_code=403,
            detail=f"Нет доступа к файлу {filename} или файл не найден"
        )
    
    try:
        if os.path.exists(file_path):
            os.remove(file_path)
            logger.info(f"Файл {filename} удален пользователем {current_user.username}")
            return {"success": True, "message": f"Файл {filename} успешно удален"}
        else:
            raise HTTPException(status_code=404, detail=f"Файл {filename} не найден")
    except Exception as e:
        logger.error(f"Ошибка удаления файла {filename}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Ошибка удаления файла: {str(e)}")


# Получение текста документа
@app.get("/api/document-text/{filename}")
async def get_document_text(
    filename: str,
    current_user: Optional[User] = Depends(get_current_user)
):
    """
    Получение текстового содержимого документа из персональной директории пользователя.
    Ищет файл в подпапках source и changes, а также в backups и outputs.
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="Требуется аутентификация")
    
    try:
        if not filename:
            raise HTTPException(status_code=400, detail="Необходимо указать filename")
        
        logger.info(f"Запрос текста файла {filename} от пользователя {current_user.username}")
        
        # Ищем файл в подпапках source и changes
        file_path = None
        for file_type in ["source", "changes"]:
            potential_path = get_user_file_path(filename, current_user.username, file_type=file_type)
            if potential_path and os.path.exists(potential_path):
                file_path = potential_path
                logger.info(f"Файл найден в папке {file_type}: {file_path}")
                break
        
        # Если не найден в подпапках, ищем в backups и outputs
        if not file_path:
            for directory in [BACKUPS_DIR, OUTPUTS_DIR]:
                potential_path = os.path.join(directory, filename)
                if os.path.exists(potential_path):
                    file_path = potential_path
                    logger.info(f"Файл найден в {directory}: {file_path}")
                    break
        
        if not file_path:
            logger.warning(f"Файл {filename} не найден для пользователя {current_user.username}")
            raise HTTPException(
                status_code=403,
                detail=f"Нет доступа к файлу {filename} или файл не найден"
            )
        
        # Извлекаем текст через MCP клиент
        try:
            text = await mcp_client.get_document_text(file_path)
            return {
                "filename": filename,
                "text": text,
                "length": len(text)
            }
        except Exception as e:
            logger.error(f"Ошибка извлечения текста из файла {filename}: {e}", exc_info=True)
            raise HTTPException(
                status_code=500,
                detail=f"Не удалось извлечь текст из файла: {str(e)}"
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка получения текста документа: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# Получение логов операций (для операторов и администраторов)
@app.get("/api/operation-logs")
async def get_operation_logs(
    limit: int = 50,
    offset: int = 0,
    operation_type: Optional[str] = None,
    user_id: Optional[int] = None,
    current_user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db_session)
):
    """
    Получение логов операций.
    Доступно для операторов (executive), операторов ИБ (security) и администраторов.
    Операторы видят только свои логи, операторы ИБ и администраторы - все.
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="Требуется аутентификация")
    
    query = db.query(OperationLog)
    
    if current_user.role == "executive":
        # Обычные операторы видят только свои логи
        query = query.filter(OperationLog.user_id == current_user.id)
    elif current_user.role == "admin" or current_user.role == "security":
        # Администраторы и операторы ИБ видят все логи
        if user_id:
            query = query.filter(OperationLog.user_id == user_id)
    else:
        # Другие роли не имеют доступа
        raise HTTPException(status_code=403, detail="Недостаточно прав доступа")
    
    # Фильтрация по типу операции
    if operation_type:
        query = query.filter(OperationLog.operation_type == operation_type)
    
    # Сортировка по дате создания (новые сначала)
    query = query.order_by(OperationLog.created_at.desc())
    
    # Подсчет общего количества
    total = query.count()
    
    # Применение пагинации
    logs = query.offset(offset).limit(limit).all()
    
    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "logs": [log.to_dict() for log in logs]
    }


# Перевод документов
@app.post("/api/translate-document")
async def translate_document(
    file: UploadFile = File(...),
    source_language: str = Form(...),
    target_language: str = Form(...),
    current_user: Optional[User] = Depends(get_current_user)
):
    """
    Перевод Word документа между русским и казахским языками.
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="Требуется аутентификация")
    
    # Проверяем поддерживаемые языки
    supported_languages = translation_service.get_supported_languages()
    if source_language not in supported_languages or target_language not in supported_languages:
        raise HTTPException(
            status_code=400, 
            detail=f"Поддерживаемые языки: {', '.join(supported_languages.keys())}"
        )
    
    if source_language == target_language:
        raise HTTPException(status_code=400, detail="Исходный и целевой языки должны отличаться")
    
    # Проверяем тип файла
    if not file.filename or not file.filename.endswith('.docx'):
        raise HTTPException(status_code=400, detail="Поддерживаются только файлы .docx")
    
    try:
        # Создаем директории для переводов
        translations_dir = os.path.join(DATA_DIR, "translations")
        os.makedirs(translations_dir, exist_ok=True)
        
        # Генерируем уникальные имена файлов
        file_id = str(uuid.uuid4())
        input_filename = f"input_{file_id}_{file.filename}"
        output_filename = f"translated_{source_language}_{target_language}_{file_id}_{file.filename}"
        
        input_path = os.path.join(translations_dir, input_filename)
        output_path = os.path.join(translations_dir, output_filename)
        
        # Сохраняем загруженный файл
        with open(input_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
        
        logger.info(f"Начинаем перевод документа {file.filename} с {source_language} на {target_language}")
        
        # Выполняем перевод
        result = await translation_service.translate_document(
            input_file=input_path,
            output_file=output_path,
            source_lang=source_language,
            target_lang=target_language
        )
        
        # Удаляем исходный файл
        os.remove(input_path)
        
        logger.info(f"Перевод завершен: {result}")
        
        return {
            "success": True,
            "translatedFile": output_filename,
            "originalFilename": file.filename,
            "sourceLanguage": source_language,
            "targetLanguage": target_language,
            "statistics": {
                "translatedParagraphs": result.get("translated_paragraphs", 0),
                "translatedTables": result.get("translated_tables", 0),
                "totalCharacters": result.get("total_characters", 0)
            }
        }
        
    except Exception as e:
        logger.error(f"Ошибка при переводе документа: {e}", exc_info=True)
        
        # Очищаем временные файлы в случае ошибки
        for temp_file in [input_path, output_path]:
            if os.path.exists(temp_file):
                try:
                    os.remove(temp_file)
                except:
                    pass
        
        raise HTTPException(status_code=500, detail=f"Ошибка перевода: {str(e)}")


@app.get("/api/download-translated/{filename}")
async def download_translated_file(
    filename: str,
    current_user: Optional[User] = Depends(get_current_user)
):
    """
    Скачивание переведенного файла.
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="Требуется аутентификация")
    
    # Проверяем безопасность имени файла
    if not re.match(r'^translated_[a-z]{2}_[a-z]{2}_[a-f0-9-]+_.+\.docx$', filename):
        raise HTTPException(status_code=400, detail="Недопустимое имя файла")
    
    translations_dir = os.path.join(DATA_DIR, "translations")
    file_path = os.path.join(translations_dir, filename)
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Файл не найден")
    
    # Извлекаем оригинальное имя файла из имени переведенного файла
    # Формат: translated_{source}_{target}_{uuid}_{original_name}.docx
    parts = filename.split('_', 4)
    if len(parts) >= 5:
        original_name = parts[4]
    else:
        original_name = filename
    
    return FileResponse(
        path=file_path,
        filename=f"translated_{original_name}",
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )


@app.get("/api/translation/languages")
async def get_supported_languages():
    """
    Получение списка поддерживаемых языков для перевода.
    """
    return translation_service.get_supported_languages()


if __name__ == "__main__":
    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
