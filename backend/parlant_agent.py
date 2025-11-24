"""
LLM-агент для применения изменений к Word документам без зависимостей от Parlant runtime.
"""
import inspect
import json
import logging
import os
from datetime import datetime
from functools import wraps
from pathlib import Path
from typing import Any, Awaitable, Callable, Dict, List, Optional

import httpx
from docx import Document
from docx.oxml import OxmlElement
from docx.text.paragraph import Paragraph
from openai import AsyncOpenAI
from dotenv import load_dotenv

from mcp_client import MCPTextMatch, mcp_client

# Загрузка переменных окружения из .env файла
# Ищем .env файл в корне проекта (на уровень выше backend/)
env_path = Path(__file__).parent.parent / '.env'
if env_path.exists():
    load_dotenv(dotenv_path=env_path)
else:
    # Если .env не найден в корне, пробуем загрузить из текущей директории
    load_dotenv()

# Настройка логирования
logger = logging.getLogger(__name__)

OperationCallback = Optional[Callable[[Dict[str, Any]], Awaitable[None]]]


class DocumentChangeAgent:
    """
    LLM-агент, который парсит инструкции изменений и управляет операциями MCP Word Server.
    """

    def _load_prompt(self, filename: str) -> str:
        """
        Загрузка промпта из markdown файла.
        Файлы находятся в директории prompts/ относительно файла parlant_agent.py.
        """
        try:
            # Используем persistent volume для промптов
            data_dir = os.getenv("DATA_DIR", "/data")
            prompts_dir = os.path.join(data_dir, "prompts")
            # Если папка не существует, пробуем локальную
            if not os.path.exists(prompts_dir):
                current_dir = os.path.dirname(os.path.abspath(__file__))
                prompts_dir = os.path.join(current_dir, "prompts")
            prompt_path = os.path.join(prompts_dir, filename)
            
            if os.path.exists(prompt_path):
                with open(prompt_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    # Удаляем заголовок markdown (если есть)
                    lines = content.split('\n')
                    # Пропускаем строки, начинающиеся с # (заголовки markdown)
                    prompt_lines = [line for line in lines if not line.strip().startswith('#')]
                    return '\n'.join(prompt_lines).strip()
            else:
                logger.warning(f"Файл промпта не найден: {prompt_path}, используем дефолтный промпт")
                return self._get_default_prompt(filename)
        except Exception as e:
            logger.error(f"Ошибка загрузки промпта {filename}: {e}", exc_info=True)
            return self._get_default_prompt(filename)
    
    def _get_default_prompt(self, filename: str) -> str:
        """
        Возвращает дефолтный промпт, если файл не найден.
        """
        if "instruction_check_system" in filename:
            return (
                "Ты эксперт по анализу документов с инструкциями изменений. "
                "Твоя задача - проанализировать содержимое документа и распознать ВСЕ инструкции по изменению текста, "
                "независимо от формата их представления. "
                "Документ может содержать инструкции в любом формате: списки, параграфы, таблицы, свободный текст. "
                "Твоя задача - найти ВСЕ инструкции и преобразовать их в структурированный JSON. "
                "Допустимые операции: REPLACE_TEXT, DELETE_PARAGRAPH, INSERT_PARAGRAPH, INSERT_SECTION, ADD_COMMENT, REPLACE_POINT_TEXT. "
                "КРИТИЧЕСКИ ВАЖНО: Ответ должен быть валидным JSON без комментариев, trailing commas и других ошибок. "
                "Используй экранирование для специальных символов в строках (\\\", \\n, \\t). "
                "Будь внимательным и найди ВСЕ инструкции, даже если они написаны в нестандартном или неочевидном формате."
            )
        elif "instruction_check_user" in filename:
            return (
                "Проанализируй содержимое документа и найди ВСЕ инструкции по изменению текста. "
                "Инструкции могут быть представлены в любом формате: списки, параграфы, таблицы, свободный текст."
            )
        else:
            return ""

    SUPPORTED_OPERATIONS = {
        "REPLACE_TEXT",
        "DELETE_PARAGRAPH",
        "INSERT_PARAGRAPH",
        "INSERT_SECTION",
        "INSERT_TABLE",  # Вставка таблицы
        "ADD_COMMENT",
        "REPLACE_POINT_TEXT",  # Специальная операция для замены всего пункта
    }

    BASE_GUIDELINES: List[Dict[str, Any]] = [
        {
            "priority": "CRITICAL",
            "condition": "Получены текстовые инструкции изменений",
            "action": (
                "1. Считать файл инструкций через get_document_text.\n"
                "2. Вызвать LLM для структурирования изменений.\n"
                "3. Подготовить последовательность действий."
            ),
            "tools": ["get_document_text", "parse_changes_document"],
        },
        {
            "priority": "HIGH",
            "condition": "Необходим анализ структуры документа",
            "action": (
                "Используй get_document_outline и get_paragraph_text для понимания структуры "
                "и поиска точек привязки через find_text."
            ),
            "tools": ["get_document_outline", "get_paragraph_text", "find_text"],
        },
        {
            "priority": "HIGH",
            "condition": "Выполняются изменения документа",
            "action": (
                "Для замены текста используй replace_text, для вставки — add_paragraph/add_heading, "
                "для удаления — delete_paragraph. После успешного изменения добавь аннотацию через add_comment."
            ),
            "tools": ["replace_text", "add_paragraph", "add_heading", "delete_paragraph", "add_comment"],
        },
    ]

    AVAILABLE_TOOLS = [
        "parse_changes_document",
        "get_document_text",
        "get_document_outline",
        "find_text",
        "replace_text",
        "add_comment",
        "delete_paragraph",
        "add_paragraph",
        "add_heading",
        "copy_document",
        "get_paragraph_text",
    ]

    def __init__(self):
        self.openai_client: Optional[AsyncOpenAI] = None
        self._openai_http_client: Optional[httpx.AsyncClient] = None
        # Чтение модели из переменных окружения (загружены из .env)
        self.model_name: str = os.environ.get("OPENAI_MODEL", "gpt-4o")
        logger.info(f"Инициализация LLM агента с моделью: {self.model_name}")
        self._patch_openai_httpx()

    async def initialize(self) -> None:
        """
        Инициализация клиента OpenAI.
        """
        openai_key = os.environ.get("OPENAI_API_KEY")
        if not openai_key:
            raise RuntimeError("OPENAI_API_KEY не найден. Укажите ключ в .env.")

        # Увеличенный timeout для больших документов
        self._openai_http_client = httpx.AsyncClient(timeout=300.0)  # 5 минут
        try:
            self.openai_client = AsyncOpenAI(
                api_key=openai_key,
                http_client=self._openai_http_client,
            )
        except Exception:
            await self._openai_http_client.aclose()
            self._openai_http_client = None
            raise

        if not self.model_name:
            self.model_name = "gpt-4o"
            logger.warning("OPENAI_MODEL не задан, используется модель по умолчанию: gpt-4o")

        logger.info("LLM агент инициализирован")

    async def _parse_changes_with_llm(
        self, 
        changes_text: str, 
        initial_changes: Optional[List[Dict[str, Any]]] = None
    ) -> tuple[List[Dict[str, Any]], Dict[str, int]]:
        """
        Преобразование текстовых инструкций в структурированный JSON через LLM.
        
        Returns:
            Tuple[список изменений, словарь с информацией о токенах]
        """
        """
        Преобразование текстовых инструкций в структурированный JSON через LLM.
        """
        if not self.openai_client:
            raise RuntimeError("OpenAI клиент не инициализирован")

        # Обрабатываем весь документ без обрезания
        logger.info(f"Обработка полного текста инструкций: {len(changes_text)} символов")

        # Формируем контекст о уже найденных изменениях (для будущего использования)
        initial_context = ""
        if initial_changes:
            initial_context = (
                f"\n\nУЖЕ РАСПОЗНАННЫЕ ИЗМЕНЕНИЯ (для справки, не дублируй их):\n"
                f"Найдено {len(initial_changes)} изменений. "
                f"Твоя задача - найти ВСЕ остальные изменения, которые могли быть пропущены.\n"
            )
        
        # Загрузка system prompt из файла
        # Файл: /data/prompts/instruction_check_system.md (или backend/prompts/instruction_check_system.md)
        system_prompt = self._load_prompt("instruction_check_system.md")

        # Загрузка user prompt из файла
        # Файл: /data/prompts/instruction_check_user.md (или backend/prompts/instruction_check_user.md)
        user_prompt_template = self._load_prompt("instruction_check_user.md")

        # Подготовка промпта с учетом уже найденных изменений
        # Форматируем user_prompt_template, подставляя changes_text
        if "{changes_list}" in user_prompt_template:
            user_prompt = user_prompt_template.format(changes_list=changes_text)
        else:
            user_prompt = user_prompt_template
        
        full_prompt = f"{user_prompt}{initial_context}\n\nИНСТРУКЦИИ ДЛЯ АНАЛИЗА:\n'''{changes_text}'''"
        
        logger.info(f"Отправка запроса к LLM: модель={self.model_name}, длина промпта={len(full_prompt)} символов")
        logger.debug(f"System prompt длина: {len(system_prompt)} символов")
        logger.debug(f"User prompt длина: {len(user_prompt)} символов")
        logger.debug(f"Changes text длина: {len(changes_text)} символов")
        
        try:
            # OpenAI SDK использует timeout из http_client, который уже установлен в 300 секунд
            response = await self.openai_client.chat.completions.create(
                model=self.model_name,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": full_prompt},
                ],
                temperature=0,
                max_tokens=16384,  # Максимальное значение для completion tokens (gpt-4o поддерживает до 16384)
                response_format={"type": "json_object"},
            )
            logger.info("Ответ от LLM получен успешно")
        except Exception as e:
            logger.error(f"Ошибка при запросе к LLM: {e}", exc_info=True)
            raise RuntimeError(
                f"Не удалось получить ответ от LLM: {str(e)}. "
                f"Возможно, документ слишком большой или произошел таймаут."
            ) from e

        content = response.choices[0].message.content if response.choices else None
        if isinstance(content, list):
            # new SDKs may return content as list of dicts
            content = "".join(
                segment.get("text", "")
                for segment in content
                if isinstance(segment, dict)
            )
        if not isinstance(content, str) or not content.strip():
            raise RuntimeError("LLM не вернул корректный JSON для парсинга инструкций")

        # Попытка очистки JSON от возможных проблем
        content_cleaned = content.strip()
        
        # Удаление markdown code blocks, если есть
        if content_cleaned.startswith("```"):
            lines = content_cleaned.split("\n")
            # Удаляем первую строку (```json или ```)
            if len(lines) > 1:
                lines = lines[1:]
            # Удаляем последнюю строку (```)
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            content_cleaned = "\n".join(lines).strip()
        
        # Попытка парсинга JSON
        try:
            parsed = json.loads(content_cleaned)
        except json.JSONDecodeError as e:
            # Логируем проблемный JSON для отладки
            error_pos = e.pos if hasattr(e, 'pos') else None
            if error_pos:
                start = max(0, error_pos - 100)
                end = min(len(content_cleaned), error_pos + 100)
                context = content_cleaned[start:end]
                logger.error(f"Ошибка парсинга JSON на позиции {error_pos}")
                logger.error(f"Контекст: ...{context}...")
                logger.debug(f"Полный ответ LLM (первые 500 символов): {content_cleaned[:500]}")
            
            # Попытка исправить распространенные проблемы
            try:
                # Удаление trailing commas
                import re
                content_fixed = re.sub(r',\s*}', '}', content_cleaned)
                content_fixed = re.sub(r',\s*]', ']', content_fixed)
                parsed = json.loads(content_fixed)
                logger.info("JSON исправлен автоматически (удалены trailing commas)")
            except json.JSONDecodeError:
                # Если не удалось исправить, пробуем извлечь JSON из текста
                try:
                    # Ищем JSON объект в тексте
                    import re
                    json_match = re.search(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', content_cleaned, re.DOTALL)
                    if json_match:
                        parsed = json.loads(json_match.group(0))
                        logger.info("JSON извлечен из текста")
                    else:
                        raise RuntimeError(
                            f"Не удалось распарсить JSON от LLM. Ошибка: {str(e)}. "
                            f"Позиция: {error_pos}. "
                            f"Попробуйте упростить инструкции или разбить их на части."
                        ) from e
                except (json.JSONDecodeError, AttributeError):
                    raise RuntimeError(
                        f"Не удалось распарсить JSON от LLM. Ошибка: {str(e)}. "
                        f"Позиция: {error_pos}. "
                        f"Ответ LLM (первые 1000 символов): {content_cleaned[:1000]}"
                    ) from e
        
        changes = parsed.get("changes", [])

        # Валидация результата
        if not isinstance(changes, list):
            raise RuntimeError(
                f"LLM вернул некорректный формат: 'changes' должен быть массивом, "
                f"получен: {type(changes).__name__}"
            )
        
        # Извлечение информации о токенах
        tokens_info = {
            "prompt_tokens": 0,
            "completion_tokens": 0,
            "total_tokens": 0
        }
        if hasattr(response, 'usage') and response.usage:
            tokens_info = {
                "prompt_tokens": response.usage.prompt_tokens or 0,
                "completion_tokens": response.usage.completion_tokens or 0,
                "total_tokens": response.usage.total_tokens or 0
            }
        
        if not changes:
            logger.warning("LLM не вернул ни одного изменения. Проверьте инструкции.")
            logger.warning(f"Длина исходного текста инструкций: {len(changes_text)} символов")
            logger.warning(f"Первые 500 символов текста: {changes_text[:500]}")
            return [], tokens_info
        
        # Проверка на возможные пропущенные инструкции
        # Подсчитываем ключевые слова, которые могут указывать на инструкции
        instruction_keywords = [
            "заменить", "исключить", "изложить", "добавить", "удалить", 
            "изменить", "в редакции", "в новой редакции", "в следующей редакции",
            "пункт", "раздел", "подпункт"
        ]
        keyword_count = sum(1 for keyword in instruction_keywords if keyword.lower() in changes_text.lower())
        logger.info(f"Найдено ключевых слов инструкций в тексте: {keyword_count}")
        logger.info(f"LLM распознал изменений: {len(changes)}")
        
        # Если ключевых слов значительно больше, чем найденных инструкций, предупреждаем
        if keyword_count > len(changes) * 2:
            logger.warning(
                f"⚠ ВНИМАНИЕ: В тексте найдено {keyword_count} ключевых слов, указывающих на инструкции, "
                f"но LLM распознал только {len(changes)} изменений. "
                f"Возможно, некоторые инструкции были пропущены. "
                f"Рекомендуется проверить документ вручную."
            )
        
        # Валидация и нормализация каждого изменения
        validated_changes = []
        for idx, change in enumerate(changes, start=1):
            if not isinstance(change, dict):
                logger.warning(f"Пропущено изменение {idx}: не является объектом")
                continue
            
            # Установка обязательных полей
            change.setdefault("change_id", f"CHG-{idx:03d}")
            change.setdefault("annotation", True)
            change.setdefault("operation", "UNKNOWN")
            change.setdefault("description", f"Изменение {idx}")
            
            # Проверка обязательных полей
            operation = change.get("operation", "").upper()
            if operation not in self.SUPPORTED_OPERATIONS:
                logger.warning(f"Пропущено изменение {idx}: неподдерживаемая операция '{operation}'")
                continue
            
            # Автоматическое определение replace_all для массовых замен
            if operation == "REPLACE_TEXT":
                target = change.get("target", {})
                description = change.get("description", "").lower()
                # Если в описании есть "по всему тексту" или match_case=false, устанавливаем replace_all
                if "по всему тексту" in description or target.get("match_case") is False:
                    target.setdefault("replace_all", True)
                    change["target"] = target
                    logger.info(f"Автоматически установлен replace_all=true для {change.get('change_id')}")
            
            validated_changes.append(change)
        
        logger.info(f"Успешно распарсено {len(validated_changes)} изменений из {len(changes)} полученных")
        logger.info(f"Использовано токенов: {tokens_info['total_tokens']} (prompt: {tokens_info['prompt_tokens']}, completion: {tokens_info['completion_tokens']})")
        return validated_changes, tokens_info

    async def process_documents(
        self,
        source_file: str,
        changes_file: str,
        session_id: str,
        progress_callback: OperationCallback = None,
        operation_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Главный сценарий: создание бэкапа, парсинг инструкций, применение изменений.
        """
        logger.info(f"Начало обработки документов: session_id={session_id}, source={source_file}, changes={changes_file}")
        
        try:
            # Получаем базовое имя файла (без пути)
            source_basename = os.path.basename(source_file)
            logger.info(f"Исходный файл: {source_basename}, полный путь: {source_file}")
            
            # Определяем директории
            # source_file может быть в /data/uploads/{username}/source/{filename}
            # или в другой структуре
            if os.path.dirname(source_file).endswith('source'):
                # Файл в подпапке source
                uploads_dir = os.path.dirname(os.path.dirname(source_file))
            else:
                uploads_dir = os.path.dirname(source_file)
            
            root_dir = os.path.dirname(uploads_dir) if not uploads_dir.endswith('uploads') else uploads_dir
            backup_dir = os.path.join(root_dir, "backups")
            os.makedirs(backup_dir, exist_ok=True)
            logger.info(f"Директория для бэкапов: {backup_dir}")

            backup_filename = os.path.splitext(source_basename)[0] + "_backup.docx"
            backup_path = os.path.join(backup_dir, backup_filename)

            logger.info(f"Создание резервной копии: {backup_path}")
            await mcp_client.copy_document(source_file, backup_path)
            logger.info("Резервная копия создана успешно")

            logger.info("Извлечение текста из файла с инструкциями")
            changes_text = await mcp_client.get_document_text(changes_file)
            logger.debug(f"Извлечено {len(changes_text)} символов инструкций")
            
            # Распознавание изменений с помощью LLM
            logger.info("Распознавание изменений с помощью LLM")
            changes, tokens_info_parse = await self._parse_changes_with_llm(changes_text, initial_changes=[])
            logger.info(f"LLM распознал {len(changes)} изменений")
            logger.info(f"Использовано токенов при парсинге: {tokens_info_parse.get('total_tokens', 0)}")
            
            # Нумерация изменений
            for idx, change in enumerate(changes, start=1):
                change["change_id"] = f"CHG-{idx:03d}"

            if not changes:
                logger.warning("Не найдено изменений для применения")
                return {
                    "session_id": session_id,
                    "total_changes": 0,
                    "successful": 0,
                    "failed": 0,
                    "changes": [],
                    "processed_filename": source_basename,
                    "backup_filename": backup_filename,
                    "warning": "Не найдено изменений для применения",
                }

            results: List[Dict[str, Any]] = []
            total = len(changes)
            
            logger.info(f"Начало применения {total} изменений")
            for idx, change in enumerate(changes, start=1):
                change_id = change.get("change_id", f"CHG-{idx:03d}")
                operation = change.get("operation", "UNKNOWN")
                logger.info(f"Обработка {change_id}: {operation}")
                
                try:
                    execution_result = await self._execute_change(
                        source_file,
                        change,
                        progress_callback=progress_callback,
                    )
                    results.append(execution_result)
                    
                    if execution_result["status"] == "SUCCESS":
                        logger.info(f"{change_id}: успешно выполнено")
                    else:
                        error_msg = execution_result.get("details", {}).get("message", "Неизвестная ошибка")
                        logger.warning(f"{change_id}: ошибка - {error_msg}")

                except Exception as exc:  # noqa: BLE001
                    logger.error(f"{change_id}: исключение при выполнении - {exc}", exc_info=True)
                    results.append({
                        "change_id": change_id,
                        "operation": operation,
                        "description": change.get("description", ""),
                        "status": "FAILED",
                        "details": {
                            "success": False,
                            "error": "EXCEPTION",
                            "message": str(exc),
                        },
                    })

                if progress_callback:
                    await progress_callback(
                        {
                            "type": "progress",
                            "data": {
                                "status": f"Выполнено {idx} из {total} изменений",
                                "progress": int(idx / max(total, 1) * 100),
                            },
                        }
                    )

            successful = sum(1 for r in results if r["status"] == "SUCCESS")
            failed = sum(1 for r in results if r["status"] == "FAILED")

            logger.info(f"Обработка завершена: успешно={successful}, ошибок={failed}")

            # Собираем информацию о токенах
            tokens_total = tokens_info_parse.get("total_tokens", 0)
            tokens_prompt = tokens_info_parse.get("prompt_tokens", 0)
            tokens_completion = tokens_info_parse.get("completion_tokens", 0)

            return {
                "session_id": session_id,
                "total_changes": total,
                "successful": successful,
                "failed": failed,
                "changes": results,
                "processed_filename": source_basename,
                "backup_filename": backup_filename,
                "tokens_used": tokens_total,
                "tokens_prompt": tokens_prompt,
                "tokens_completion": tokens_completion,
            }

        except Exception as exc:  # noqa: BLE001
            error_msg = str(exc)
            logger.error(f"Критическая ошибка при обработке документов: {error_msg}", exc_info=True)
            
            # Специальная обработка таймаутов
            if "timeout" in error_msg.lower() or "timed out" in error_msg.lower():
                error_msg = (
                    "Превышено время ожидания ответа от LLM. "
                    "Возможно, документ с инструкциями слишком большой. "
                    "Попробуйте разбить инструкции на несколько файлов или упростить их."
                )
            
            return {
                "session_id": session_id,
                "status": "FAILED",
                "error": error_msg,
                "total_changes": 0,
                "successful": 0,
                "failed": 0,
                "changes": [],
                "tokens_used": 0,
                "tokens_prompt": 0,
                "tokens_completion": 0,
            }

    async def _execute_change(
        self,
        filename: str,
        change: Dict[str, Any],
        progress_callback: OperationCallback = None,
    ) -> Dict[str, Any]:
        """
        Выполнение одного изменения в документе.
        """
        change_id = change.get("change_id", "UNKNOWN")
        operation = change.get("operation", "").upper()
        description = change.get("description", "")
        
        result: Dict[str, Any] = {
            "change_id": change_id,
            "operation": operation,
            "description": description,
            "status": "FAILED",
            "details": {},
        }

        if operation not in self.SUPPORTED_OPERATIONS:
            error_msg = f"Операция {operation} не поддерживается"
            logger.warning(f"{change_id}: {error_msg}")
            result["details"] = {
                "success": False,
                "error": "UNSUPPORTED_OPERATION",
                "message": error_msg,
            }
            return result

        try:
            logger.debug(f"{change_id}: выполнение операции {operation}")
            
            if operation == "REPLACE_TEXT":
                details = await self._handle_replace_text(filename, change)
            elif operation == "REPLACE_POINT_TEXT":
                details = await self._handle_replace_point_text(filename, change)
            elif operation == "DELETE_PARAGRAPH":
                details = await self._handle_delete_paragraph(filename, change)
            elif operation == "INSERT_PARAGRAPH":
                details = await self._handle_insert_paragraph(filename, change)
            elif operation == "INSERT_SECTION":
                details = await self._handle_insert_section(filename, change)
            elif operation == "INSERT_TABLE":
                details = await self._handle_insert_table(filename, change)
            elif operation == "ADD_COMMENT":
                details = await self._handle_add_comment(filename, change)
            else:
                error_msg = f"Операция {operation} не реализована"
                logger.warning(f"{change_id}: {error_msg}")
                details = {
                    "success": False,
                    "error": "UNSUPPORTED_OPERATION",
                    "message": error_msg,
                }
        except Exception as exc:  # noqa: BLE001
            logger.error(f"{change_id}: исключение при выполнении операции {operation}: {exc}", exc_info=True)
            details = {"success": False, "error": "EXCEPTION", "message": str(exc)}

        result["details"] = details
        result["status"] = "SUCCESS" if details.get("success") else "FAILED"

        if progress_callback:
            await progress_callback(
                {
                    "type": "operation_completed",
                    "data": {
                        "change_id": change_id,
                        "operation": operation,
                        "description": description,
                        "status": result["status"],
                        "details": details,
                    },
                }
            )

        return result

    async def _handle_replace_text(self, filename: str, change: Dict[str, Any]) -> Dict[str, Any]:
        """
        Обработка замены текста с поддержкой массовых замен.
        """
        target = change.get("target", {})
        payload = change.get("payload", {})
        target_text = target.get("text")
        new_text = payload.get("new_text")
        match_case = target.get("match_case", False)
        replace_all = target.get("replace_all", False)  # Флаг для массовых замен

        if not target_text or not new_text:
            return {
                "success": False,
                "error": "INVALID_PAYLOAD",
                "message": "Для REPLACE_TEXT необходимы target.text и payload.new_text",
            }

        # Нормализация текста для поиска (удаление лишних пробелов)
        normalized_target = " ".join(target_text.split())
        logger.debug(f"Поиск текста: '{normalized_target}' (оригинал: '{target_text}')")
        
        # Поиск всех вхождений
        matches = await mcp_client.find_text_in_document(
            filename,
            normalized_target,
            match_case=match_case,
        )
        
        # Если не найдено с нормализованным текстом, пробуем оригинальный
        if not matches and normalized_target != target_text:
            logger.debug(f"Повторный поиск с оригинальным текстом: '{target_text}'")
        matches = await mcp_client.find_text_in_document(
            filename,
            target_text,
            match_case=match_case,
        )

        if not matches:
            # Попытка найти похожий текст (для пунктов типа "36." или "36)")
            if target_text.isdigit() or (target_text.replace(".", "").replace(")", "").isdigit()):
                # Пробуем найти пункт с разными форматами
                for variant in [f"{target_text}.", f"{target_text})", f"{target_text}."]:
                    logger.debug(f"Попытка найти вариант: '{variant}'")
                    variant_matches = await mcp_client.find_text_in_document(
                        filename,
                        variant,
                        match_case=False,
                    )
                    if variant_matches:
                        matches = variant_matches
                        logger.info(f"Найдено совпадение для варианта '{variant}'")
                        break
            
            if not matches:
                logger.warning(f"Текст '{target_text}' не найден в документе")
                return {
                    "success": False,
                    "error": "TEXT_NOT_FOUND",
                    "message": f"Текст '{target_text}' не найден в документе. Попробуйте использовать более точный текст для поиска.",
                }

        # Для массовых замен или если найдено несколько вхождений
        if replace_all or len(matches) > 1 or not match_case:
            # Обрабатываем все вхождения
            doc = Document(filename)
            replaced_count = 0
            affected_paragraphs = set()

            # Проходим по всем параграфам и заменяем текст
            for idx, para in enumerate(doc.paragraphs):
                if self._replace_in_paragraph(para, target_text, new_text):
                    replaced_count += 1
                    affected_paragraphs.add(idx)

            if replaced_count == 0:
                return {
                    "success": False,
                    "error": "TEXT_NOT_FOUND_IN_PARAGRAPH",
                    "message": f"Не удалось заменить '{target_text}' в документе",
                }

            doc.save(filename)

            # Добавляем аннотацию к первому затронутому параграфу
            if change.get("annotation", True) and affected_paragraphs:
                first_para_idx = min(affected_paragraphs)
                await self._add_annotation(
                    filename,
                    first_para_idx,
                    change,
                    extra=f'"{target_text}" → "{new_text}" (заменено {replaced_count} раз)',
                )

            return {
                "success": True,
                "replacements_count": replaced_count,
                "affected_paragraphs": sorted(affected_paragraphs),
            }

        # Для единичной замены (точное совпадение)
        if len(matches) != 1:
            return {
                "success": False,
                "error": "TEXT_NOT_UNIQUE",
                "message": f"Ожидалось ровно одно совпадение, найдено: {len(matches)}. "
                           f"Используйте replace_all=true для массовых замен.",
            }

        paragraph_index = matches[0].paragraph_index
        doc = Document(filename)

        if paragraph_index >= len(doc.paragraphs):
            return {
                "success": False,
                "error": "PARAGRAPH_INDEX_OUT_OF_RANGE",
                "message": f"Неверный индекс параграфа: {paragraph_index}",
            }

        replaced = self._replace_in_paragraph(doc.paragraphs[paragraph_index], target_text, new_text)

        if not replaced:
            # Пробуем найти в других параграфах
            for para in doc.paragraphs:
                if self._replace_in_paragraph(para, target_text, new_text):
                    replaced = True
                    break

        if not replaced:
            return {
                "success": False,
                "error": "TEXT_NOT_FOUND_IN_PARAGRAPH",
                "message": f"Не удалось заменить '{target_text}' в найденном параграфе",
            }

        doc.save(filename)

        if change.get("annotation", True):
            await self._add_annotation(
                filename,
                paragraph_index,
                change,
                extra=f'"{target_text}" → "{new_text}"',
            )

        return {"success": True, "paragraph_index": paragraph_index}

    async def _handle_replace_point_text(self, filename: str, change: Dict[str, Any]) -> Dict[str, Any]:
        """
        Замена всего текста пункта/подпункта новым текстом.
        Находит начало пункта и заменяет весь его текст до следующего пункта.
        """
        target = change.get("target", {})
        payload = change.get("payload", {})
        point_start = target.get("text")  # Например, "36." или "8)"
        new_text = payload.get("new_text")
        
        if not point_start or not new_text:
            return {
                "success": False,
                "error": "INVALID_PAYLOAD",
                "message": "Для REPLACE_POINT_TEXT необходимы target.text и payload.new_text",
            }
        
        # Нормализация текста для поиска
        normalized_start = " ".join(point_start.split())
        logger.debug(f"Поиск пункта для замены: '{normalized_start}'")
        
        matches = await mcp_client.find_text_in_document(
            filename,
            normalized_start,
            match_case=False,
        )
        
        if not matches:
            # Пробуем варианты
            for variant in [f"{normalized_start.replace('.', '')}.", f"{normalized_start.replace(')', ')')}"]:
                variant_matches = await mcp_client.find_text_in_document(
                    filename,
                    variant,
                    match_case=False,
                )
                if variant_matches:
                    matches = variant_matches
                    break
        
        if not matches:
            return {
                "success": False,
                "error": "POINT_NOT_FOUND",
                "message": f"Пункт '{point_start}' не найден в документе",
            }
        
        paragraph_index = matches[0].paragraph_index
        doc = Document(filename)
        
        if paragraph_index >= len(doc.paragraphs):
            return {
                "success": False,
                "error": "PARAGRAPH_INDEX_OUT_OF_RANGE",
                "message": f"Неверный индекс параграфа: {paragraph_index}",
            }
        
        # Находим конец пункта (до следующего пункта или раздела)
        start_idx = paragraph_index
        end_idx = self._find_section_end(doc, paragraph_index)
        
        # Заменяем весь текст пункта
        # Удаляем старые параграфы пункта
        removed_texts = []
        for idx in range(start_idx, end_idx):
            if start_idx < len(doc.paragraphs):
                removed_texts.append(doc.paragraphs[start_idx].text)
                self._delete_paragraph(doc.paragraphs[start_idx])
        
        # Вставляем новый текст
        insert_after_idx = max(0, start_idx - 1)
        if insert_after_idx < len(doc.paragraphs):
            insert_after = doc.paragraphs[insert_after_idx]
            # Разбиваем новый текст на параграфы
            new_paragraphs = new_text.split('\n')
            current_para = insert_after
            for para_text in new_paragraphs:
                if para_text.strip():
                    current_para = self._insert_paragraph_after(current_para, para_text.strip())
        else:
            # Если некуда вставлять, добавляем в конец
            for para_text in new_text.split('\n'):
                if para_text.strip():
                    doc.add_paragraph(para_text.strip())
        
        doc.save(filename)
        
        if change.get("annotation", True):
            await self._add_annotation(
                filename,
                insert_after_idx,
                change,
                extra=f"Заменен пункт {point_start}",
            )
        
        return {"success": True, "paragraph_index": start_idx}

    async def _handle_delete_paragraph(self, filename: str, change: Dict[str, Any]) -> Dict[str, Any]:
        target = change.get("target", {})
        text_to_remove = target.get("text")
        match_case = target.get("match_case", False)

        if not text_to_remove:
            return {
                "success": False,
                "error": "INVALID_TARGET",
                "message": "Для DELETE_PARAGRAPH необходим target.text",
            }

        # Нормализация текста для поиска
        normalized_text = " ".join(text_to_remove.split())
        logger.debug(f"Поиск текста для удаления: '{normalized_text}' (оригинал: '{text_to_remove}')")
        
        matches = await mcp_client.find_text_in_document(
            filename,
            normalized_text,
            match_case=match_case,
        )
        
        # Если не найдено, пробуем оригинальный текст
        if not matches and normalized_text != text_to_remove:
            matches = await mcp_client.find_text_in_document(
                filename,
                text_to_remove,
                match_case=match_case,
            )
        
        # Для пунктов пробуем разные форматы
        if not matches and (text_to_remove.isdigit() or text_to_remove.replace(".", "").replace(")", "").isdigit()):
            for variant in [f"{text_to_remove}.", f"{text_to_remove})", f"{text_to_remove}."]:
                variant_matches = await mcp_client.find_text_in_document(
                    filename,
                    variant,
                    match_case=False,
                )
                if variant_matches:
                    matches = variant_matches
                    logger.info(f"Найдено совпадение для варианта '{variant}'")
                    break
        
        if not matches:
            logger.warning(f"Текст для удаления '{text_to_remove}' не найден")
            return {
                "success": False,
                "error": "TEXT_NOT_FOUND",
                "message": f"Текст '{text_to_remove}' не найден в документе",
            }

        paragraph_index = matches[0].paragraph_index
        doc = Document(filename)

        if paragraph_index >= len(doc.paragraphs):
            return {
                "success": False,
                "error": "PARAGRAPH_INDEX_OUT_OF_RANGE",
                "message": f"Неверный индекс параграфа: {paragraph_index}",
            }

        start = paragraph_index
        end = self._find_section_end(doc, paragraph_index)
        removed_preview = []

        for idx in range(start, end):
            para = doc.paragraphs[start]  # список пересчитывается после удаления
            removed_preview.append(para.text)
            self._delete_paragraph(para)

        doc.save(filename)

        if change.get("annotation", True) and start > 0:
            preview_text = " ".join(removed_preview)[:120]
            await self._add_annotation(
                filename,
                start - 1,
                change,
                extra=f"Удален раздел: {preview_text}",
            )

        return {"success": True, "paragraph_index": start}

    async def _handle_insert_paragraph(self, filename: str, change: Dict[str, Any]) -> Dict[str, Any]:
        """
        Вставка нового параграфа после указанного текста.
        """
        target = change.get("target", {})
        payload = change.get("payload", {})
        after_text = target.get("after_text")
        new_paragraph = payload.get("text")
        style = payload.get("style")

        if not after_text or not new_paragraph:
            error_msg = "Для INSERT_PARAGRAPH необходимы target.after_text и payload.text"
            logger.warning(f"{change.get('change_id', 'UNKNOWN')}: {error_msg}")
            return {
                "success": False,
                "error": "INVALID_PAYLOAD",
                "message": error_msg,
            }

        # Нормализация текста для поиска
        normalized_after = " ".join(after_text.split())
        logger.debug(f"Поиск якоря для вставки: '{normalized_after}' (оригинал: '{after_text}')")

        matches = await mcp_client.find_text_in_document(
            filename,
            normalized_after,
            match_case=target.get("match_case", False),
        )
        
        # Если не найдено, пробуем оригинальный текст
        if not matches and normalized_after != after_text:
            matches = await mcp_client.find_text_in_document(
                filename,
                after_text,
                match_case=target.get("match_case", False),
            )
        
        if not matches:
            error_msg = f"Якорь '{after_text}' не найден в документе"
            logger.warning(f"{change.get('change_id', 'UNKNOWN')}: {error_msg}")
            return {
                "success": False,
                "error": "ANCHOR_NOT_FOUND",
                "message": error_msg,
            }

        anchor_index = matches[0].paragraph_index
        doc = Document(filename)
        if anchor_index >= len(doc.paragraphs):
            return {
                "success": False,
                "error": "PARAGRAPH_INDEX_OUT_OF_RANGE",
                "message": f"Неверный индекс параграфа: {anchor_index}",
            }

        insert_after = doc.paragraphs[anchor_index]
        self._insert_paragraph_after(insert_after, new_paragraph, style)
        doc.save(filename)

        doc = Document(filename)
        insert_position = (
            self._find_paragraph_index_by_text(doc, new_paragraph, start=anchor_index)
            or anchor_index + 1
        )

        if change.get("annotation", True):
            await self._add_annotation(
                filename,
                insert_position,
                change,
                extra=f"Добавлен параграф: {new_paragraph[:120]}",
            )

        return {"success": True, "paragraph_index": insert_position}

    async def _handle_insert_section(self, filename: str, change: Dict[str, Any]) -> Dict[str, Any]:
        target = change.get("target", {})
        payload = change.get("payload", {})

        after_heading = target.get("after_heading")
        heading_text = payload.get("heading_text")
        heading_level = payload.get("heading_level", 2)
        paragraphs: List[str] = payload.get("paragraphs", [])

        if not after_heading or not heading_text:
            return {
                "success": False,
                "error": "INVALID_PAYLOAD",
                "message": "Для INSERT_SECTION необходимы target.after_heading и payload.heading_text",
            }

        matches = await mcp_client.find_text_in_document(
            filename,
            after_heading,
            match_case=target.get("match_case", False),
        )
        if not matches:
            return {"success": False, "error": "ANCHOR_NOT_FOUND"}

        anchor_index = matches[0].paragraph_index
        doc = Document(filename)
        if anchor_index >= len(doc.paragraphs):
            return {
                "success": False,
                "error": "PARAGRAPH_INDEX_OUT_OF_RANGE",
                "message": f"Неверный индекс параграфа: {anchor_index}",
            }

        insert_index = self._find_section_end(doc, anchor_index)
        insert_after = doc.paragraphs[max(insert_index - 1, anchor_index)]
        heading_style = f"Heading {heading_level}"
        new_heading = self._insert_paragraph_after(insert_after, heading_text, heading_style)
        current_para = new_heading

        for paragraph in paragraphs:
            current_para = self._insert_paragraph_after(current_para, paragraph)

        doc.save(filename)

        doc = Document(filename)
        start_index = (
            self._find_paragraph_index_by_text(
                doc, heading_text, start=insert_index, style=heading_style
            )
            or insert_index
        )

        if change.get("annotation", True):
            await self._add_annotation(
                filename,
                start_index,
                change,
                extra=f"Добавлен раздел «{heading_text}»",
            )

        return {
            "success": True,
            "start_index": start_index,
            "paragraphs_added": len(paragraphs) + 1,
        }

    async def _handle_insert_table(self, filename: str, change: Dict[str, Any]) -> Dict[str, Any]:
        """
        Вставка таблицы после указанного текста.
        """
        target = change.get("target", {})
        payload = change.get("payload", {})
        after_text = target.get("after_text")
        rows = payload.get("rows", [])
        columns = payload.get("columns")
        
        if not after_text:
            return {
                "success": False,
                "error": "INVALID_TARGET",
                "message": "Для INSERT_TABLE необходим target.after_text",
            }
        
        if not rows or not isinstance(rows, list):
            return {
                "success": False,
                "error": "INVALID_PAYLOAD",
                "message": "Для INSERT_TABLE необходим payload.rows (массив строк таблицы)",
            }
        
        # Нормализация текста для поиска
        normalized_after = " ".join(after_text.split())
        logger.debug(f"Поиск якоря для вставки таблицы: '{normalized_after}'")
        
        matches = await mcp_client.find_text_in_document(
            filename,
            normalized_after,
            match_case=target.get("match_case", False),
        )
        
        if not matches and normalized_after != after_text:
            matches = await mcp_client.find_text_in_document(
                filename,
                after_text,
                match_case=target.get("match_case", False),
            )
        
        if not matches:
            error_msg = f"Якорь '{after_text}' не найден в документе для вставки таблицы"
            logger.warning(f"{change.get('change_id', 'UNKNOWN')}: {error_msg}")
            return {
                "success": False,
                "error": "ANCHOR_NOT_FOUND",
                "message": error_msg,
            }
        
        anchor_index = matches[0].paragraph_index
        doc = Document(filename)
        
        if anchor_index >= len(doc.paragraphs):
            return {
                "success": False,
                "error": "PARAGRAPH_INDEX_OUT_OF_RANGE",
                "message": f"Неверный индекс параграфа: {anchor_index}",
            }
        
        # Определяем количество колонок
        if not columns:
            columns = max(len(row) for row in rows) if rows else 0
        
        # Вставляем таблицу через MCP
        success = await mcp_client.add_table(filename, rows, position=anchor_index + 1)
        
        if not success:
            return {
                "success": False,
                "error": "TABLE_INSERT_FAILED",
                "message": "Не удалось вставить таблицу в документ",
            }
        
        if change.get("annotation", True):
            await self._add_annotation(
                filename,
                anchor_index,
                change,
                extra=f"Добавлена таблица ({len(rows)} строк, {columns} колонок)",
            )
        
        return {
            "success": True,
            "paragraph_index": anchor_index,
            "rows_count": len(rows),
            "columns_count": columns,
        }

    async def _handle_add_comment(self, filename: str, change: Dict[str, Any]) -> Dict[str, Any]:
        target = change.get("target", {})
        payload = change.get("payload", {})

        paragraph_hint = payload.get("paragraph_hint")
        comment_text = payload.get("comment_text")

        if not paragraph_hint or not comment_text:
            return {
                "success": False,
                "error": "INVALID_PAYLOAD",
                "message": "Для ADD_COMMENT необходимы payload.paragraph_hint и payload.comment_text",
            }

        matches = await mcp_client.find_text_in_document(
            filename,
            paragraph_hint,
            match_case=target.get("match_case", False),
        )
        if not matches:
            return {"success": False, "error": "ANCHOR_NOT_FOUND"}

        paragraph_index = matches[0].paragraph_index
        comment_id = await mcp_client.add_comment(
            filename,
            paragraph_index,
            comment_text,
        )
        if not comment_id:
            return {"success": False, "error": "COMMENT_FAILED"}

        return {"success": True, "paragraph_index": paragraph_index, "comment_id": comment_id}

    async def _add_annotation(
        self,
        filename: str,
        paragraph_index: int,
        change: Dict[str, Any],
        extra: Optional[str] = None,
    ) -> None:
        comment_lines = [
            "━━━━━━━━━━━━━━━━━━━━━━━━━",
            f"[{change.get('change_id', 'CHG')}] {change.get('operation', '')}",
            "━━━━━━━━━━━━━━━━━━━━━━━━━",
            change.get("description", "Нет описания"),
        ]
        if extra:
            comment_lines.append(str(extra))
        comment_lines.append(f"Время: {datetime.now().isoformat()}")
        comment_lines.append("Статус: SUCCESS")
        comment_lines.append("━━━━━━━━━━━━━━━━━━━━━━━━━")
        annotation = "\n".join(comment_lines)

        await mcp_client.add_comment(
            filename,
            paragraph_index,
            annotation,
        )

    @staticmethod
    def _replace_in_paragraph(paragraph, old: str, new: str) -> bool:
        replaced = False

        for run in paragraph.runs:
            if old in run.text:
                run.text = run.text.replace(old, new)
                replaced = True

        if not replaced and old in paragraph.text:
            paragraph.text = paragraph.text.replace(old, new)
            replaced = True

        return replaced

    @staticmethod
    def _is_heading(paragraph: Paragraph) -> bool:
        try:
            style_name = paragraph.style.name if paragraph.style else ""
        except ValueError:
            style_name = ""
        return style_name.startswith("Heading")

    def _find_section_end(self, doc: Document, start_index: int) -> int:
        """
        Находит индекс первого параграфа после текущего раздела.
        """
        start_para = doc.paragraphs[start_index]
        if not self._is_heading(start_para):
            return start_index + 1

        for idx in range(start_index + 1, len(doc.paragraphs)):
            if self._is_heading(doc.paragraphs[idx]):
                return idx
        return len(doc.paragraphs)

    @staticmethod
    def _delete_paragraph(paragraph: Paragraph) -> None:
        p = paragraph._element  # noqa: SLF001
        parent = p.getparent()
        if parent is not None:
            parent.remove(p)

    @staticmethod
    def _insert_paragraph_after(paragraph: Paragraph, text: str = "", style: Optional[str] = None) -> Paragraph:
        new_p = OxmlElement("w:p")
        paragraph._p.addnext(new_p)  # noqa: SLF001
        new_para = Paragraph(new_p, paragraph._parent)  # noqa: SLF001
        if text:
            new_para.add_run(text)
        if style:
            # Безопасная установка стиля с проверкой наличия
            try:
                # Получаем документ из paragraph
                doc = paragraph._parent  # noqa: SLF001
                if hasattr(doc, 'styles'):
                    # Пробуем сначала указанный стиль
                    if style in doc.styles:
                        new_para.style = style
                    else:
                        # Пробуем альтернативные стили
                        fallback_styles = []
                        if "Heading" in style:
                            # Для заголовков пробуем разные уровни
                            for level in range(1, 10):
                                fallback_styles.append(f"Heading {level}")
                        fallback_styles.extend(["Normal", "Default Paragraph Font"])
                        
                        style_set = False
                        for fallback_style in fallback_styles:
                            try:
                                if fallback_style in doc.styles:
                                    new_para.style = fallback_style
                                    style_set = True
                                    logger.debug(f"Использован альтернативный стиль '{fallback_style}' вместо '{style}'")
                                    break
                            except (KeyError, ValueError, AttributeError):
                                continue
                        
                        if not style_set:
                            logger.warning(f"Не удалось установить стиль '{style}' и альтернативы, параграф будет без стиля")
            except Exception as e:
                logger.warning(f"Ошибка при установке стиля '{style}': {e}, параграф будет без стиля")
        return new_para

    def _find_paragraph_index_by_text(
        self,
        doc: Document,
        text: str,
        start: int = 0,
        style: Optional[str] = None,
    ) -> Optional[int]:
        for idx in range(start, len(doc.paragraphs)):
            para = doc.paragraphs[idx]
            if para.text != text:
                continue
            if style:
                if self._get_style_name(para) != style:
                    continue
            return idx
        return None

    @staticmethod
    def _get_style_name(paragraph: Paragraph) -> str:
        try:
            return paragraph.style.name if paragraph.style else ""
        except ValueError:
            return ""

    async def close(self) -> None:
        """
        Завершение работы агента.
        """
        if self._openai_http_client:
            await self._openai_http_client.aclose()
            self._openai_http_client = None

    @staticmethod
    def _patch_openai_httpx() -> None:
        """
        Обход несовместимости openai>=1.51.2 (ожидает httpx с параметром proxies)
        и httpx>=0.28 (параметр proxies удалён).
        """
        if "proxies" in inspect.signature(httpx.AsyncClient.__init__).parameters:
            return

        try:
            import openai._base_client as base_client  # type: ignore
        except Exception:
            return

        def strip_proxies(init):
            @wraps(init)
            def wrapper(self, *args, **kwargs):
                kwargs.pop("proxies", None)
                return init(self, *args, **kwargs)

            return wrapper

        target_inits = []

        # Default async client used inside openai sdk
        if hasattr(base_client, "_DefaultAsyncHttpxClient"):
            target_inits.append(
                ("_DefaultAsyncHttpxClient", base_client._DefaultAsyncHttpxClient)
            )
        if hasattr(base_client, "AsyncHttpxClientWrapper"):
            target_inits.append(
                ("AsyncHttpxClientWrapper", base_client.AsyncHttpxClientWrapper)
            )
        if hasattr(base_client, "AsyncAPIClient"):
            target_inits.append(("AsyncAPIClient", base_client.AsyncAPIClient))

        for _, cls in target_inits:
            init = getattr(cls, "__init__", None)
            if not callable(init):
                continue
            patched = strip_proxies(init)
            setattr(cls, "__init__", patched)


document_agent = DocumentChangeAgent()

