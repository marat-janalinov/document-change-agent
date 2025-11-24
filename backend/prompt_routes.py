"""
API маршруты для управления промптами.
"""
import os
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from auth import get_current_admin_user
from database import User

router = APIRouter(prefix="/api/prompts", tags=["prompts"])

# Используем persistent volume для промптов
DATA_DIR = os.getenv("DATA_DIR", "/data")
PROMPTS_DIR = os.path.join(DATA_DIR, "prompts")


class PromptInfo(BaseModel):
    """Информация о промпте."""
    filename: str
    name: str
    category: str
    content: str
    is_active: bool = True


class PromptCreate(BaseModel):
    """Создание нового промпта."""
    filename: str
    name: str
    category: str
    content: str


class PromptUpdate(BaseModel):
    """Обновление промпта."""
    name: Optional[str] = None
    category: Optional[str] = None
    content: Optional[str] = None
    is_active: Optional[bool] = None


@router.get("/", response_model=List[PromptInfo])
async def list_prompts(
    current_user: User = Depends(get_current_admin_user)
):
    """Получение списка всех промптов."""
    prompts = []
    
    if not os.path.exists(PROMPTS_DIR):
        return prompts
    
    for filename in os.listdir(PROMPTS_DIR):
        if filename.endswith('.md'):
            filepath = os.path.join(PROMPTS_DIR, filename)
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                # Извлекаем название из первой строки (заголовок markdown)
                lines = content.split('\n')
                name = filename.replace('.md', '').replace('_', ' ').title()
                if lines and lines[0].startswith('#'):
                    name = lines[0].replace('#', '').strip()
                
                # Определяем категорию по имени файла
                category = "instruction_check" if "instruction_check" in filename else "change_application"
                
                # Удаляем заголовок markdown из контента (возвращаем только содержимое без заголовка)
                prompt_lines = [line for line in lines if not line.strip().startswith('#')]
                content_without_header = '\n'.join(prompt_lines).strip()
                
                prompts.append(PromptInfo(
                    filename=filename,
                    name=name,
                    category=category,
                    content=content_without_header,
                    is_active=True
                ))
            except Exception as e:
                continue
    
    return prompts


@router.get("/{filename}", response_model=PromptInfo)
async def get_prompt(
    filename: str,
    current_user: User = Depends(get_current_admin_user)
):
    """Получение конкретного промпта."""
    if not filename.endswith('.md'):
        filename += '.md'
    
    filepath = os.path.join(PROMPTS_DIR, filename)
    
    if not os.path.exists(filepath):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Промпт {filename} не найден"
        )
    
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        lines = content.split('\n')
        name = filename.replace('.md', '').replace('_', ' ').title()
        if lines and lines[0].startswith('#'):
            name = lines[0].replace('#', '').strip()
        
        category = "instruction_check" if "instruction_check" in filename else "change_application"
        
        # Удаляем заголовок markdown из контента (возвращаем только содержимое без заголовка)
        prompt_lines = [line for line in lines if not line.strip().startswith('#')]
        content_without_header = '\n'.join(prompt_lines).strip()
        
        return PromptInfo(
            filename=filename,
            name=name,
            category=category,
            content=content_without_header,
            is_active=True
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка чтения промпта: {str(e)}"
        )


@router.post("/", response_model=PromptInfo)
async def create_prompt(
    prompt_data: PromptCreate,
    current_user: User = Depends(get_current_admin_user)
):
    """Создание нового промпта."""
    if not prompt_data.filename.endswith('.md'):
        prompt_data.filename += '.md'
    
    filepath = os.path.join(PROMPTS_DIR, prompt_data.filename)
    
    if os.path.exists(filepath):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Промпт {prompt_data.filename} уже существует"
        )
    
    try:
        os.makedirs(PROMPTS_DIR, exist_ok=True)
        
        # Сохраняем с заголовком markdown
        content = f"# {prompt_data.name}\n\n{prompt_data.content}"
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        
        return PromptInfo(
            filename=prompt_data.filename,
            name=prompt_data.name,
            category=prompt_data.category,
            content=content,
            is_active=True
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка создания промпта: {str(e)}"
        )


@router.put("/{filename}", response_model=PromptInfo)
async def update_prompt(
    filename: str,
    prompt_data: PromptUpdate,
    current_user: User = Depends(get_current_admin_user)
):
    """Обновление промпта."""
    if not filename.endswith('.md'):
        filename += '.md'
    
    filepath = os.path.join(PROMPTS_DIR, filename)
    
    if not os.path.exists(filepath):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Промпт {filename} не найден"
        )
    
    try:
        # Обновляем контент
        new_name = prompt_data.name if prompt_data.name is not None else filename.replace('.md', '').replace('_', ' ').title()
        new_content = prompt_data.content if prompt_data.content is not None else ""
        
        # Если content не передан, читаем текущий
        if prompt_data.content is None:
            with open(filepath, 'r', encoding='utf-8') as f:
                current_content = f.read()
            lines = current_content.split('\n')
            # Убираем заголовок markdown (первые 2 строки: # заголовок и пустая строка)
            if len(lines) > 2 and lines[0].startswith('#'):
                new_content = '\n'.join(lines[2:])
            else:
                new_content = current_content
        
        # Сохраняем с заголовком markdown
        content = f"# {new_name}\n\n{new_content}"
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        
        category = "instruction_check" if "instruction_check" in filename else "change_application"
        
        return PromptInfo(
            filename=filename,
            name=new_name,
            category=category,
            content=content,
            is_active=prompt_data.is_active if prompt_data.is_active is not None else True
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка обновления промпта: {str(e)}"
        )


@router.delete("/{filename}")
async def delete_prompt(
    filename: str,
    current_user: User = Depends(get_current_admin_user)
):
    """Удаление промпта."""
    if not filename.endswith('.md'):
        filename += '.md'
    
    filepath = os.path.join(PROMPTS_DIR, filename)
    
    if not os.path.exists(filepath):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Промпт {filename} не найден"
        )
    
    try:
        os.remove(filepath)
        return {"success": True, "message": f"Промпт {filename} удален"}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка удаления промпта: {str(e)}"
        )

