"""
Универсальный парсер инструкций изменений документов.
Распознает стандартные паттерны инструкций независимо от конкретного содержимого.
"""
import re
import logging
from typing import List, Dict, Any, Optional, Tuple

logger = logging.getLogger(__name__)


class ChangeInstructionParser:
    """
    Универсальный парсер инструкций изменений документов.
    Распознает стандартные паттерны инструкций независимо от конкретного содержимого:
    - Массовые замены текста
    - Удаление пунктов/разделов
    - Изменение пунктов/подпунктов
    - Добавление пунктов/разделов
    - Работа с приложениями
    
    Парсер работает с любыми документами инструкций, а не только с конкретным форматом.
    """
    
    def __init__(self):
        self.changes: List[Dict[str, Any]] = []
    
    def parse(self, text: str) -> List[Dict[str, Any]]:
        """
        Парсинг текста инструкций и извлечение изменений.
        
        Args:
            text: Текст из файла с инструкциями
            
        Returns:
            Список изменений в структурированном формате
        """
        self.changes = []
        lines = text.split('\n')
        
        i = 0
        while i < len(lines):
            line = lines[i].strip()
            if not line:
                i += 1
                continue
            
            # 1. Массовые замены "По всему тексту" (с учетом опечаток и разных кавычек)
            if 'по всему тексту' in line.lower() and 'заменить' in line.lower():
                # Более гибкий подход: извлекаем текст между кавычками вручную
                # Ищем все фрагменты в кавычках (разные типы кавычек)
                quotes_matches = list(re.finditer(r'[«"''""]([^»"''""]+)[»"''""]', line))
                
                if len(quotes_matches) >= 2:
                    # Берем первые два фрагмента в кавычках
                    old_text = quotes_matches[0].group(1).strip()
                    new_text = quotes_matches[1].group(1).strip()
                    
                    # Очищаем от лишних символов и опечаток
                    old_text = old_text.strip('«»"''"".,;:').strip()
                    new_text = new_text.strip('«»"''"".,;:').strip()
                    
                    # Универсальная обработка опечаток: очищаем от очевидных артефактов
                    # (лишние символы в конце, опечатки типа "іы›", но НЕ меняем смысл текста)
                    # Удаляем артефакты OCR/копирования в конце строк
                    old_text = re.sub(r'[›іыt\s]+$', '', old_text).strip()
                    new_text = re.sub(r'[›іыt\s]+$', '', new_text).strip()
                    
                    # Если текст слишком длинный и содержит явные опечатки в середине,
                    # пытаемся извлечь основную часть (до первого явного опечаточного символа)
                    if len(old_text) > 50 and any(c in old_text for c in '›іы'):
                        # Берем часть до первого опечаточного символа
                        match = re.search(r'^([^›іы]+)', old_text)
                        if match:
                            old_text = match.group(1).strip()
                    if len(new_text) > 50 and any(c in new_text for c in '›іы'):
                        match = re.search(r'^([^›іы]+)', new_text)
                        if match:
                            new_text = match.group(1).strip()
                    
                    if old_text and new_text and len(old_text) > 2 and len(new_text) > 2:
                        self._add_replace_all(old_text, new_text, f"Массовая замена: '{old_text}' → '{new_text}'")
                        i += 1
                        continue
                
                # Альтернативный подход: ищем паттерны с опечатками
                patterns = [
                    r'слово\s*[«"''""]([^»"''""]+)[»"''""]?.*?заменить.*?словом\s*([^»"''""\s]+)[»"''""]?',
                    r'слова\s*[«"''""]([^»"''""]+)[»"''""]?.*?заменить.*?словами\s*([^»"''""\s]+)[»"''""]?',
                ]
                
                for pattern in patterns:
                    match = re.search(pattern, line, re.IGNORECASE | re.DOTALL)
                    if match:
                        old_text = match.group(1).strip().strip('«»"''"".,;:')
                        new_text = match.group(2).strip().strip('«»"''"".,;:')
                        if old_text and new_text:
                            self._add_replace_all(old_text, new_text, f"Массовая замена: '{old_text}' → '{new_text}'")
                            i += 1
                            break
                else:
                    i += 1
                continue
            
            # 2. Удаление пункта "Пункт X исключить"
            if match := re.search(r'Пункт\s+(\d+)\s+исключить', line, re.IGNORECASE):
                point_num = match.group(1)
                self._add_delete_point(point_num)
                i += 1
                continue
            
            # 3. Удаление слов из пункта "В пункте X слова Y исключить"
            if match := re.search(r'В пункте\s+(\d+)\s+слова\s+«([^»]+)»\s+исключить', line, re.IGNORECASE):
                point_num = match.group(1)
                words_to_remove = match.group(2).strip()
                self._add_remove_words_from_point(point_num, words_to_remove)
                i += 1
                continue
            
            # 4. Изменение подпункта "Подпункт Y пункта X изложить в следующей редакции:"
            if match := re.search(r'Подпункт\s+(\d+)\)\s+пункта\s+(\d+)\s+изложить', line, re.IGNORECASE):
                subpoint_num = match.group(1)
                point_num = match.group(2)
                # Ищем новый текст подпункта
                new_text = self._extract_new_text(lines, i + 1)
                if new_text:
                    self._add_replace_subpoint(point_num, subpoint_num, new_text)
                    i = self._skip_to_next_instruction(lines, i)
                else:
                    i += 1
                continue
            
            # 5. Изменение пункта "Пункт X изложить в следующей редакции:" (с учетом опечаток)
            if match := re.search(r'Пункт\s+(\d+)[\s\-]*изложить', line, re.IGNORECASE):
                point_num = match.group(1)
                # Ищем новый текст пункта
                new_text = self._extract_new_text(lines, i + 1)
                if new_text:
                    self._add_replace_point(point_num, new_text)
                    i = self._skip_to_next_instruction(lines, i)
                else:
                    i += 1
                continue
            
            # 5a. Изменение пункта с опечатками "Пуін‹т X изложить"
            if match := re.search(r'Пу[іи]н[‹<]?т\s+(\d+)[\s\-]*изложить', line, re.IGNORECASE):
                point_num = match.group(1)
                new_text = self._extract_new_text(lines, i + 1)
                if new_text:
                    self._add_replace_point(point_num, new_text)
                    i = self._skip_to_next_instruction(lines, i)
                else:
                    i += 1
                continue
            
            # 6. Замена слова в пункте "В пункте X слово Y заменить на Z" (с учетом опечаток)
            if match := re.search(r'В пункте\s+(\d+)\s+слово\s+[«"''""]([^»"''""]+)[»"''""]?\s+заменить\s+словом\s+[«"''""]?([^»"''""]+)[»"''""]?', line, re.IGNORECASE):
                point_num = match.group(1)
                old_text = match.group(2).strip().strip('«»"''"".,;:')
                new_text = match.group(3).strip().strip('«»"''"".,;:')
                if old_text and new_text:
                    self._add_replace_in_point(point_num, old_text, new_text)
                    i += 1
                    continue
            
            # 7. Добавление пунктов "Главу X дополнить пунктами Y-Z в следующих редакциях:"
            if match := re.search(r'Главу\s+(\d+)\s+дополнить\s+пунктами\s+([\d\-]+)', line, re.IGNORECASE):
                chapter_num = match.group(1)
                points_range = match.group(2)
                new_texts = self._extract_multiple_texts(lines, i + 1)
                if new_texts:
                    self._add_insert_points(chapter_num, points_range, new_texts)
                    i = self._skip_to_next_instruction(lines, i)
                else:
                    i += 1
                continue
            
            # 7a. Добавление одного пункта "Главу X дополнить пунктом Y"
            if match := re.search(r'Главу\s+(\d+)\s+дополнить\s+пунктом\s+([\d\-]+)', line, re.IGNORECASE):
                chapter_num = match.group(1)
                point_num = match.group(2)
                new_text = self._extract_new_text(lines, i + 1)
                if new_text:
                    self._add_insert_single_point(chapter_num, point_num, new_text)
                    i = self._skip_to_next_instruction(lines, i)
                else:
                    i += 1
                continue
            
            # 8. Изменение Приложения "Приложение N.X изложить" (с учетом опечаток)
            if match := re.search(r'Приложен[ия]*\s*[N№\.]\s*(\d+)[\s\-]*изложить', line, re.IGNORECASE):
                app_num = match.group(1)
                new_text = self._extract_new_text(lines, i + 1)
                if new_text:
                    self._add_replace_appendix(app_num, new_text)
                    i = self._skip_to_next_instruction(lines, i)
                else:
                    i += 1
                continue
            
            # 8a. Изменение Приложения с опечатками "Приложенпи N.2"
            if match := re.search(r'Приложен[ияпи]*\s*[N№\.]\s*(\d+)[\s\-]*изложить', line, re.IGNORECASE):
                app_num = match.group(1)
                new_text = self._extract_new_text(lines, i + 1)
                if new_text:
                    self._add_replace_appendix(app_num, new_text)
                    i = self._skip_to_next_instruction(lines, i)
                else:
                    i += 1
                continue
            
            # 9. Добавление Приложения "Дополнить Приложением N.X" (с учетом опечаток)
            if match := re.search(r'Дополнить\s+Приложением\s*[N№\.]\s*(\d+)[\s\-]*(\d+)?', line, re.IGNORECASE):
                app_num = match.group(1)
                sub_num = match.group(2) if match.lastindex >= 2 and match.group(2) else None
                new_text = self._extract_new_text(lines, i + 1)
                if new_text:
                    self._add_insert_appendix(app_num, sub_num, new_text)
                    i = self._skip_to_next_instruction(lines, i)
                else:
                    i += 1
                continue
            
            # 10. Изменение пункта 51 "Пункт 51 изложить"
            if match := re.search(r'Пункт\s+(\d+)\s+изло[іи]?кить', line, re.IGNORECASE):
                point_num = match.group(1)
                new_text = self._extract_new_text(lines, i + 1)
                if new_text:
                    self._add_replace_point(point_num, new_text)
                    i = self._skip_to_next_instruction(lines, i)
                else:
                    i += 1
                continue
            
            i += 1
        
        logger.info(f"Распознано {len(self.changes)} изменений из текста")
        return self.changes
    
    def _add_replace_all(self, old_text: str, new_text: str, description: str):
        """Добавление массовой замены."""
        self.changes.append({
            "change_id": f"CHG-{len(self.changes) + 1:03d}",
            "description": description,
            "operation": "REPLACE_TEXT",
            "target": {
                "text": old_text,
                "match_case": False,
                "replace_all": True
            },
            "payload": {
                "new_text": new_text
            },
            "annotation": True
        })
    
    def _add_delete_point(self, point_num: str):
        """Добавление удаления пункта."""
        self.changes.append({
            "change_id": f"CHG-{len(self.changes) + 1:03d}",
            "description": f"Удаление пункта {point_num}",
            "operation": "DELETE_PARAGRAPH",
            "target": {
                "text": f"{point_num}.",
                "match_case": False
            },
            "annotation": True
        })
    
    def _add_remove_words_from_point(self, point_num: str, words: str):
        """Добавление удаления слов из пункта."""
        # Удаление слов - это замена на пустую строку
        self.changes.append({
            "change_id": f"CHG-{len(self.changes) + 1:03d}",
            "description": f"Удаление слов '{words}' из пункта {point_num}",
            "operation": "REPLACE_TEXT",
            "target": {
                "text": words,  # Ищем сами слова для удаления
                "match_case": False,
                "replace_all": False
            },
            "payload": {
                "new_text": ""  # Заменяем на пустую строку
            },
            "annotation": True
        })
    
    def _add_replace_subpoint(self, point_num: str, subpoint_num: str, new_text: str):
        """Добавление замены подпункта."""
        # Для замены подпункта ищем начало подпункта и заменяем весь его текст
        self.changes.append({
            "change_id": f"CHG-{len(self.changes) + 1:03d}",
            "description": f"Изменение подпункта {subpoint_num} пункта {point_num}",
            "operation": "REPLACE_POINT_TEXT",  # Специальная операция для замены пункта
            "target": {
                "text": f"{subpoint_num})",
                "match_case": False,
                "point_num": point_num
            },
            "payload": {
                "new_text": new_text
            },
            "annotation": True
        })
    
    def _add_replace_point(self, point_num: str, new_text: str):
        """Добавление замены пункта."""
        # Для замены пункта ищем начало пункта и заменяем весь его текст
        self.changes.append({
            "change_id": f"CHG-{len(self.changes) + 1:03d}",
            "description": f"Изменение пункта {point_num}",
            "operation": "REPLACE_POINT_TEXT",  # Специальная операция для замены пункта
            "target": {
                "text": f"{point_num}.",
                "match_case": False
            },
            "payload": {
                "new_text": new_text
            },
            "annotation": True
        })
    
    def _add_replace_in_point(self, point_num: str, old_text: str, new_text: str):
        """Добавление замены слова в пункте."""
        self.changes.append({
            "change_id": f"CHG-{len(self.changes) + 1:03d}",
            "description": f"Замена '{old_text}' на '{new_text}' в пункте {point_num}",
            "operation": "REPLACE_TEXT",
            "target": {
                "text": old_text,  # Ищем старое слово
                "match_case": False,
                "replace_all": False
            },
            "payload": {
                "new_text": new_text
            },
            "annotation": True
        })
    
    def _add_insert_points(self, chapter_num: str, points_range: str, new_texts: List[str]):
        """Добавление вставки пунктов."""
        # Парсим диапазон пунктов (например, "60-1 и 60-2" или "60-1, 60-2")
        points_list = []
        if '-' in points_range:
            # Диапазон типа "60-1 и 60-2"
            parts = re.split(r'[\sи,]+', points_range)
            for part in parts:
                part = part.strip()
                if part:
                    points_list.append(part)
        else:
            points_list = [points_range]
        
        # Если пунктов больше, чем текстов, используем индексы
        for idx, text in enumerate(new_texts):
            if idx < len(points_list):
                point_num = points_list[idx]
            else:
                # Генерируем номер на основе первого пункта
                base_num = points_list[0].split('-')[0] if points_list else "60"
                point_num = f"{base_num}-{idx + 1}"
            
            self.changes.append({
                "change_id": f"CHG-{len(self.changes) + 1:03d}",
                "description": f"Добавление пункта {point_num} в главу {chapter_num}",
                "operation": "INSERT_PARAGRAPH",
                "target": {
                    "after_text": f"{int(point_num.split('-')[0]) - 1}.",
                    "match_case": False
                },
                "payload": {
                    "text": text
                },
                "annotation": True
            })
    
    def _add_insert_single_point(self, chapter_num: str, point_num: str, new_text: str):
        """Добавление одного пункта."""
        self.changes.append({
            "change_id": f"CHG-{len(self.changes) + 1:03d}",
            "description": f"Добавление пункта {point_num} в главу {chapter_num}",
            "operation": "INSERT_PARAGRAPH",
            "target": {
                "after_text": f"{int(point_num.split('-')[0]) - 1}.",
                "match_case": False
            },
            "payload": {
                "text": new_text
            },
            "annotation": True
        })
    
    def _add_replace_appendix(self, app_num: str, new_text: str):
        """Добавление замены приложения."""
        self.changes.append({
            "change_id": f"CHG-{len(self.changes) + 1:03d}",
            "description": f"Изменение Приложения №{app_num}",
            "operation": "REPLACE_POINT_TEXT",
            "target": {
                "text": f"Приложение",
                "match_case": False
            },
            "payload": {
                "new_text": new_text
            },
            "annotation": True
        })
    
    def _add_insert_appendix(self, app_num: str, sub_num: Optional[str], new_text: str):
        """Добавление нового приложения."""
        app_name = f"Приложение №{app_num}" + (f"-{sub_num}" if sub_num else "")
        self.changes.append({
            "change_id": f"CHG-{len(self.changes) + 1:03d}",
            "description": f"Добавление {app_name}",
            "operation": "INSERT_SECTION",
            "target": {
                "after_heading": "Приложение",
                "match_case": False
            },
            "payload": {
                "heading_text": app_name,
                "heading_level": 1,
                "paragraphs": new_text.split('\n') if new_text else []
            },
            "annotation": True
        })
    
    def _extract_new_text(self, lines: List[str], start_idx: int) -> Optional[str]:
        """Извлечение нового текста после инструкции."""
        text_parts = []
        i = start_idx
        
        # Пропускаем пустые строки
        while i < len(lines) and not lines[i].strip():
            i += 1
        
        # Собираем текст до следующей инструкции
        while i < len(lines):
            line = lines[i].strip()
            
            # Проверяем, не началась ли новая инструкция
            if self._is_new_instruction(line):
                break
            
            if line:
                # Убираем кавычки в начале/конце
                line = line.strip('«»"\'')
                text_parts.append(line)
            
            i += 1
        
        result = '\n'.join(text_parts).strip()
        return result if result else None
    
    def _extract_multiple_texts(self, lines: List[str], start_idx: int) -> List[str]:
        """Извлечение нескольких текстов (для множественных пунктов)."""
        texts = []
        current_text = []
        i = start_idx
        
        while i < len(lines):
            line = lines[i].strip()
            
            if self._is_new_instruction(line):
                if current_text:
                    texts.append('\n'.join(current_text).strip())
                    current_text = []
                break
            
            # Проверяем начало нового пункта (например, "60-1.", "60-2.")
            if re.match(r'^\d+[\-\.]\d+\.', line):
                if current_text:
                    texts.append('\n'.join(current_text).strip())
                    current_text = []
                current_text.append(line)
            elif line:
                current_text.append(line)
            
            i += 1
        
        if current_text:
            texts.append('\n'.join(current_text).strip())
        
        return [t for t in texts if t]
    
    def _skip_to_next_instruction(self, lines: List[str], current_idx: int) -> int:
        """Пропуск до следующей инструкции."""
        i = current_idx + 1
        while i < len(lines):
            line = lines[i].strip()
            if self._is_new_instruction(line):
                return i
            i += 1
        return i
    
    def _is_new_instruction(self, line: str) -> bool:
        """Проверка, является ли строка началом новой инструкции."""
        if not line:
            return False
        
        patterns = [
            r'^По всему тексту',
            r'^Пункт\s+\d+',
            r'^Пу[іи]н[‹<]?т\s+\d+',  # С опечатками
            r'^В пункте\s+\d+',
            r'^Подпункт\s+\d+\)',
            r'^Главу\s+\d+',
            r'^Приложен',
            r'^Дополнить\s+Приложением',
        ]
        
        return any(re.match(pattern, line, re.IGNORECASE) for pattern in patterns)

