"""
Скрипт для инициализации промптов в persistent volume.
Копирует промпты из backend/prompts в /data/prompts при первом запуске.
"""
import os
import shutil
import logging

logger = logging.getLogger(__name__)


def init_prompts():
    """
    Инициализация промптов в persistent volume.
    Копирует файлы из backend/prompts в /data/prompts, если их там еще нет.
    """
    # Определяем пути
    data_dir = os.getenv("DATA_DIR", "/data")
    prompts_dir = os.path.join(data_dir, "prompts")
    
    # Локальная директория с промптами (в репозитории)
    current_dir = os.path.dirname(os.path.abspath(__file__))
    local_prompts_dir = os.path.join(current_dir, "prompts")
    
    # Создаем директорию для промптов, если её нет
    os.makedirs(prompts_dir, exist_ok=True)
    
    # Копируем промпты из локальной директории, если их нет в persistent volume
    if os.path.exists(local_prompts_dir):
        copied_count = 0
        for filename in os.listdir(local_prompts_dir):
            if filename.endswith('.md'):
                local_file = os.path.join(local_prompts_dir, filename)
                persistent_file = os.path.join(prompts_dir, filename)
                
                # Копируем только если файла еще нет в persistent volume
                if not os.path.exists(persistent_file):
                    try:
                        shutil.copy2(local_file, persistent_file)
                        logger.info(f"Скопирован промпт: {filename} -> {persistent_file}")
                        copied_count += 1
                    except Exception as e:
                        logger.error(f"Ошибка копирования промпта {filename}: {e}", exc_info=True)
        
        if copied_count > 0:
            logger.info(f"Инициализировано {copied_count} промптов в {prompts_dir}")
        else:
            logger.info(f"Промпты уже инициализированы в {prompts_dir}")
    else:
        logger.warning(f"Локальная директория с промптами не найдена: {local_prompts_dir}")


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    )
    init_prompts()

