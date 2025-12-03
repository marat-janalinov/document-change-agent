#!/usr/bin/env python3
"""
Тестовый скрипт для проверки обработки документов
"""
import asyncio
import os
import sys
from pathlib import Path

# Добавляем backend в путь
backend_path = Path(__file__).parent / "backend"
sys.path.insert(0, str(backend_path))

from parlant_agent import document_agent
from dotenv import load_dotenv

# Загрузка переменных окружения
env_path = Path(__file__).parent / '.env'
if env_path.exists():
    load_dotenv(dotenv_path=env_path)
else:
    load_dotenv()

async def test_processing():
    """Тестовая обработка документов"""
    
    # Инициализация агента
    print("🔧 Инициализация агента...")
    await document_agent.initialize()
    print("✅ Агент инициализирован\n")
    
    # Пути к файлам
    base_dir = Path(__file__).parent / "data" / "Пилотный проект"
    source_file = base_dir / "Регламент  03122025.docx"
    changes_file = base_dir / "changes-03122025.docx"
    
    print(f"📄 Исходный файл: {source_file}")
    print(f"📋 Файл с инструкциями: {changes_file}\n")
    
    if not source_file.exists():
        print(f"❌ Файл не найден: {source_file}")
        return
    
    if not changes_file.exists():
        print(f"❌ Файл не найден: {changes_file}")
        return
    
    # Обработка документов
    print("🚀 Запуск обработки документов...\n")
    
    try:
        results = await document_agent.process_documents(
            source_file=str(source_file),
            changes_file=str(changes_file),
            session_id="test-session"
        )
        
        print("\n" + "="*60)
        print("📊 РЕЗУЛЬТАТЫ ОБРАБОТКИ")
        print("="*60)
        print(f"\nСтатус: {results.get('status', 'UNKNOWN')}")
        print(f"Всего изменений: {results.get('total_changes', 0)}")
        print(f"Успешно: {results.get('successful', 0)}")
        print(f"Ошибок: {results.get('failed', 0)}\n")
        
        # Детали по изменениям
        changes = results.get('changes', [])
        for change in changes:
            change_id = change.get('change_id', 'N/A')
            status = change.get('status', 'UNKNOWN')
            operation = change.get('operation', 'N/A')
            description = change.get('description', '')[:60]
            
            status_icon = "✅" if status == "SUCCESS" else "❌"
            print(f"{status_icon} {change_id} | {operation} | {status}")
            print(f"   {description}...")
            
            if status != "SUCCESS":
                details = change.get('details', {})
                error = details.get('error', '')
                message = details.get('message', '')
                print(f"   ⚠️  Ошибка: {error}")
                print(f"   📝 Сообщение: {message}")
            print()
        
        # Проверка конкретного изменения CHG-001
        print("="*60)
        print("🔍 ДЕТАЛЬНЫЙ АНАЛИЗ CHG-001")
        print("="*60)
        
        chg001 = None
        for change in changes:
            if change.get('change_id') == 'CHG-001':
                chg001 = change
                break
        
        if chg001:
            print(f"\nСтатус: {chg001.get('status')}")
            print(f"Операция: {chg001.get('operation')}")
            print(f"Описание: {chg001.get('description')}")
            print(f"\nИскомый текст: {chg001.get('target_text', 'N/A')}")
            print(f"Новый текст: {chg001.get('payload', {}).get('new_text', 'N/A')}")
            
            details = chg001.get('details', {})
            if details.get('success') is False:
                print(f"\n❌ ОШИБКА:")
                print(f"   Тип: {details.get('error', 'N/A')}")
                print(f"   Сообщение: {details.get('message', 'N/A')}")
        else:
            print("\n⚠️  Изменение CHG-001 не найдено в результатах")
        
    except Exception as e:
        print(f"\n❌ ОШИБКА при обработке: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await document_agent.close()

if __name__ == "__main__":
    asyncio.run(test_processing())

