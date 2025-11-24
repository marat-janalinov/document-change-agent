"""
Скрипт для создания тестовых пользователей для всех ролей.
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from database import SessionLocal, User, init_db
from auth import get_password_hash
import bcrypt

def create_users():
    """Создание пользователей для всех ролей."""
    # Инициализация БД
    init_db()
    
    db = SessionLocal()
    try:
        # Пользователи для роли admin (3 пользователя)
        admin_users = [
            {"email": "admin1@example.com", "username": "admin1", "password": "admin123", "role": "admin"},
            {"email": "admin2@example.com", "username": "admin2", "password": "admin123", "role": "admin"},
            {"email": "admin3@example.com", "username": "admin3", "password": "admin123", "role": "admin"},
        ]
        
        # Пользователи для роли executive/operator (3 пользователя)
        executive_users = [
            {"email": "operator1@example.com", "username": "operator1", "password": "operator123", "role": "executive"},
            {"email": "operator2@example.com", "username": "operator2", "password": "operator123", "role": "executive"},
            {"email": "operator3@example.com", "username": "operator3", "password": "operator123", "role": "executive"},
        ]
        
        # Пользователи для роли security (3 пользователя)
        security_users = [
            {"email": "security1@example.com", "username": "security1", "password": "security123", "role": "security"},
            {"email": "security2@example.com", "username": "security2", "password": "security123", "role": "security"},
            {"email": "security3@example.com", "username": "security3", "password": "security123", "role": "security"},
        ]
        
        all_users = admin_users + executive_users + security_users
        
        created_count = 0
        skipped_count = 0
        
        for user_data in all_users:
            # Проверяем, существует ли пользователь
            existing_user = db.query(User).filter(
                (User.email == user_data["email"]) | (User.username == user_data["username"])
            ).first()
            
            if existing_user:
                print(f"⏭ Пользователь {user_data['username']} уже существует, пропускаем")
                skipped_count += 1
                continue
            
            # Хешируем пароль
            password = user_data["password"].encode('utf-8')
            salt = bcrypt.gensalt()
            hashed = bcrypt.hashpw(password, salt)
            
            # Создаем пользователя
            user = User(
                email=user_data["email"],
                username=user_data["username"],
                hashed_password=hashed.decode('utf-8'),
                role=user_data["role"],
                status="active",
                tags="[]"
            )
            
            db.add(user)
            db.commit()
            db.refresh(user)
            
            # Создание всех необходимых персональных директорий пользователя
            try:
                import os
                import re
                DATA_DIR = os.getenv("DATA_DIR", "/data")
                UPLOADS_DIR = os.path.join(DATA_DIR, "uploads")
                safe_username = re.sub(r'[^A-Za-z0-9_-]', '_', user.username)
                user_dir = os.path.join(UPLOADS_DIR, safe_username)
                
                # Создаем основную директорию пользователя
                os.makedirs(user_dir, exist_ok=True)
                
                # Создаем поддиректории source и changes
                source_dir = os.path.join(user_dir, "source")
                changes_dir = os.path.join(user_dir, "changes")
                os.makedirs(source_dir, exist_ok=True)
                os.makedirs(changes_dir, exist_ok=True)
                
                print(f"✓ Созданы директории для пользователя {user_data['username']}: {user_dir}, {source_dir}, {changes_dir}")
            except Exception as e:
                print(f"⚠ Не удалось создать директории для {user_data['username']}: {e}")
            
            created_count += 1
            print(f"✓ Создан пользователь {user_data['username']} ({user_data['role']}): {user_data['email']} / {user_data['password']}")
        
        db.commit()
        
        print(f"\n=== Итоги ===")
        print(f"Создано пользователей: {created_count}")
        print(f"Пропущено (уже существуют): {skipped_count}")
        print(f"Всего обработано: {len(all_users)}")
        
        # Выводим список всех пользователей
        print(f"\n=== Список всех пользователей ===")
        users = db.query(User).all()
        for user in users:
            print(f"  - {user.username} ({user.role}): {user.email}")
        
    except Exception as e:
        db.rollback()
        print(f"✗ Ошибка при создании пользователей: {e}", file=sys.stderr)
        raise
    finally:
        db.close()


if __name__ == "__main__":
    create_users()

