"""
Модуль для логирования операций проверки документов.
"""
import uuid
import logging
from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Session
from database import SessionLocal, OperationLog, User

logger = logging.getLogger(__name__)


class OperationLogger:
    """Класс для логирования операций."""
    
    @staticmethod
    def create_log(
        operation_type: str,
        user_id: Optional[int] = None,
        username: Optional[str] = None,
        source_filename: Optional[str] = None,
        changes_filename: Optional[str] = None,
        db: Optional[Session] = None
    ) -> OperationLog:
        """
        Создание записи лога операции.
        
        Args:
            operation_type: Тип операции (check_instructions, process_documents)
            user_id: ID пользователя
            username: Имя пользователя
            source_filename: Имя исходного файла
            changes_filename: Имя файла с инструкциями
            db: Сессия БД (если None, создается новая)
        
        Returns:
            OperationLog объект
        """
        operation_id = str(uuid.uuid4())
        
        # Если сессия не передана, создаем новую
        should_close = False
        if db is None:
            db = SessionLocal()
            should_close = True
        
        try:
            # Убеждаемся, что db - это Session, а не генератор
            if not isinstance(db, Session):
                raise ValueError(f"db должен быть Session, получен {type(db)}")
            # Если передан user_id, получаем username из БД
            if user_id and not username:
                user = db.query(User).filter(User.id == user_id).first()
                if user:
                    username = user.username or user.email
            
            log_entry = OperationLog(
                operation_id=operation_id,
                operation_type=operation_type,
                user_id=user_id,
                username=username,
                source_filename=source_filename,
                changes_filename=changes_filename,
                status="in_progress"
            )
            
            db.add(log_entry)
            db.commit()
            db.refresh(log_entry)
            
            logger.info(f"Создан лог операции {operation_id} типа {operation_type} для пользователя {username}")
            return log_entry
        except Exception as e:
            db.rollback()
            logger.error(f"Ошибка создания лога операции: {e}", exc_info=True)
            raise
        finally:
            if should_close:
                db.close()
    
    @staticmethod
    def update_log(
        operation_id: str,
        tokens_used: Optional[int] = None,
        tokens_prompt: Optional[int] = None,
        tokens_completion: Optional[int] = None,
        total_changes: Optional[int] = None,
        status: Optional[str] = None,
        error_message: Optional[str] = None,
        db: Optional[Session] = None
    ) -> Optional[OperationLog]:
        """
        Обновление записи лога операции.
        
        Args:
            operation_id: ID операции
            tokens_used: Общее количество токенов
            tokens_prompt: Токены в промпте
            tokens_completion: Токены в ответе
            total_changes: Количество найденных изменений
            status: Статус операции (completed, failed)
            error_message: Сообщение об ошибке
            db: Сессия БД (если None, создается новая)
        
        Returns:
            Обновленный OperationLog объект или None
        """
        should_close = False
        if db is None:
            db = SessionLocal()
            should_close = True
        
        try:
            # Убеждаемся, что db - это Session, а не генератор
            if not isinstance(db, Session):
                raise ValueError(f"db должен быть Session, получен {type(db)}")
            
            log_entry = db.query(OperationLog).filter(OperationLog.operation_id == operation_id).first()
            if not log_entry:
                logger.warning(f"Лог операции {operation_id} не найден")
                return None
            
            if tokens_used is not None:
                log_entry.tokens_used = tokens_used
            if tokens_prompt is not None:
                log_entry.tokens_prompt = tokens_prompt
            if tokens_completion is not None:
                log_entry.tokens_completion = tokens_completion
            if total_changes is not None:
                log_entry.total_changes = total_changes
            if status is not None:
                log_entry.status = status
            if error_message is not None:
                log_entry.error_message = error_message
            
            if status in ["completed", "failed"]:
                log_entry.completed_at = datetime.utcnow()
            
            db.commit()
            db.refresh(log_entry)
            
            logger.info(f"Обновлен лог операции {operation_id}: статус={status}, токенов={tokens_used}")
            return log_entry
        except Exception as e:
            db.rollback()
            logger.error(f"Ошибка обновления лога операции {operation_id}: {e}", exc_info=True)
            raise
        finally:
            if should_close:
                db.close()

