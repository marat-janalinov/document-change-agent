import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Loader2, Save, Download, Edit2, Eye, Bold, Italic, Underline, List, ListOrdered, AlignLeft, AlignCenter, AlignRight, Search, Replace, FileText, ZoomIn, ZoomOut, MoreVertical } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { apiClient } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import mammoth from 'mammoth';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';

interface DocxEditorProps {
  filename: string;
  title: string;
  fileType?: 'source' | 'changes' | 'processed';
  onSave?: (filename: string) => void;
}

export function DocxEditor({ filename, title, fileType = 'processed', onSave }: DocxEditorProps) {
  const [content, setContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [replaceQuery, setReplaceQuery] = useState<string>('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isReplaceOpen, setIsReplaceOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<number[]>([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState<number>(-1);
  const [searchDialogPosition, setSearchDialogPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDraggingSearch, setIsDraggingSearch] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const searchDialogRef = useRef<HTMLDivElement>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const editorRef = useRef<HTMLDivElement>(null);
  const originalContentRef = useRef<string>('');
  const isInitializedRef = useRef<boolean>(false);
  const searchMarkersRef = useRef<HTMLElement[]>([]);

  // Загрузка файла и конвертация в HTML
  useEffect(() => {
    const loadDocument = async () => {
      if (!filename) {
        setIsLoading(false);
        setContent('<p>Имя файла не указано</p>');
        return;
      }

      setIsLoading(true);
      setContent('');
      isInitializedRef.current = false;
      
      try {
        // Получаем файл через API
        // Используем fileType для указания папки: source или changes
        const downloadFileType = fileType === 'processed' ? 'source' : fileType;
        const fileUrl = apiClient.getDownloadUrl(filename, downloadFileType);
        console.log('[DocxEditor] Загрузка файла:', { filename, fileType, downloadFileType, fileUrl });
        
        const response = await fetch(fileUrl, {
          headers: apiClient.getAuthHeaders(),
        });

        console.log('[DocxEditor] Ответ сервера:', { 
          status: response.status, 
          statusText: response.statusText,
          ok: response.ok 
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => '');
          console.error('[DocxEditor] Ошибка ответа:', errorText);
          throw new Error(
            `Не удалось загрузить файл: ${response.status} ${response.statusText}. ${errorText || ''}`
          );
        }

        const arrayBuffer = await response.arrayBuffer();
        console.log('[DocxEditor] Файл загружен, размер:', arrayBuffer.byteLength, 'байт');
        
        // Конвертируем .docx в HTML используя mammoth
        const result = await mammoth.convertToHtml({ arrayBuffer });
        const htmlContent = result.value;
        
        console.log('[DocxEditor] Конвертация завершена, длина HTML:', htmlContent.length);
        
        setContent(htmlContent);
        originalContentRef.current = htmlContent;
        setHasChanges(false);
      } catch (error: any) {
        console.error('[DocxEditor] Ошибка загрузки документа:', error);
        const errorMessage = error.message || 'Не удалось загрузить документ';
        toast({
          title: 'Ошибка загрузки',
          description: errorMessage,
          variant: 'destructive',
        });
        setContent(`<p style="color: red;">Ошибка загрузки документа: ${errorMessage}</p>`);
        isInitializedRef.current = false;
      } finally {
        setIsLoading(false);
      }
    };

    if (filename) {
      loadDocument();
    }
  }, [filename]);

  // Сохранение и восстановление позиции курсора
  const saveCursorPosition = () => {
    if (!editorRef.current) return null;
    
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;
    
    const range = selection.getRangeAt(0);
    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(editorRef.current);
    preCaretRange.setEnd(range.endContainer, range.endOffset);
    
    return {
      start: preCaretRange.toString().length,
      end: preCaretRange.toString().length,
    };
  };

  const restoreCursorPosition = (savedPos: { start: number; end: number } | null) => {
    if (!editorRef.current || !savedPos) return;
    
    try {
      const selection = window.getSelection();
      if (!selection) return;
      
      const range = document.createRange();
      let charCount = 0;
      let nodeStack = [editorRef.current];
      let node: Node | undefined;
      let foundStart = false;
      let stop = false;
      
      while (!stop && (node = nodeStack.pop())) {
        if (node.nodeType === Node.TEXT_NODE) {
          const nextCharCount = charCount + (node.textContent?.length || 0);
          if (!foundStart && savedPos.start >= charCount && savedPos.start <= nextCharCount) {
            range.setStart(node, savedPos.start - charCount);
            foundStart = true;
          }
          if (foundStart && savedPos.end >= charCount && savedPos.end <= nextCharCount) {
            range.setEnd(node, savedPos.end - charCount);
            stop = true;
          }
          charCount = nextCharCount;
        } else {
          let i = node.childNodes.length;
          while (i--) {
            nodeStack.push(node.childNodes[i]);
          }
        }
      }
      
      selection.removeAllRanges();
      selection.addRange(range);
    } catch (e) {
      console.error('Ошибка восстановления позиции курсора:', e);
    }
  };

  // Обработка изменений в редакторе
  const handleContentChange = () => {
    if (editorRef.current) {
      const newContent = editorRef.current.innerHTML;
      setContent(newContent);
      setHasChanges(newContent !== originalContentRef.current);
    }
  };

  // Управление contentEditable через useEffect
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.contentEditable = isEditing ? 'true' : 'false';
      if (isEditing) {
        // Фокусируемся на элементе при включении редактирования
        setTimeout(() => {
          if (editorRef.current) {
            editorRef.current.focus();
          }
        }, 0);
      }
    }
  }, [isEditing]);

  // Инициализация содержимого при первой загрузке или изменении filename
  useEffect(() => {
    if (!editorRef.current || !content) return;
    
    try {
      if (!isInitializedRef.current) {
        editorRef.current.innerHTML = content;
        isInitializedRef.current = true;
      } else if (!isEditing) {
        // Обновляем содержимое только если не в режиме редактирования
        // (чтобы не потерять изменения пользователя)
        const currentContent = editorRef.current.innerHTML;
        if (currentContent !== content && content.trim()) {
          editorRef.current.innerHTML = content;
        }
      }
    } catch (error) {
      console.error('[DocxEditor] Ошибка инициализации содержимого:', error);
      // Не падаем, просто логируем ошибку
    }
  }, [content, isEditing]);
  
  // Сброс флага инициализации при изменении filename
  useEffect(() => {
    isInitializedRef.current = false;
  }, [filename]);

  // Функции форматирования текста
  const execCommand = (command: string, value: string | boolean = false) => {
    if (!editorRef.current || !isEditing) return;
    
    editorRef.current.focus();
    document.execCommand(command, false, value.toString());
    handleContentChange();
  };

  const formatBold = () => execCommand('bold');
  const formatItalic = () => execCommand('italic');
  const formatUnderline = () => execCommand('underline');
  const formatUnorderedList = () => execCommand('insertUnorderedList');
  const formatOrderedList = () => execCommand('insertOrderedList');
  const formatAlignLeft = () => execCommand('justifyLeft');
  const formatAlignCenter = () => execCommand('justifyCenter');
  const formatAlignRight = () => execCommand('justifyRight');

  // Функции поиска и замены
  const highlightSearchResults = (query: string) => {
    if (!editorRef.current) {
      setSearchResults([]);
      return;
    }

    if (!query.trim()) {
      // Удаляем все маркеры подсветки
      const marks = editorRef.current.querySelectorAll('mark.search-result');
      marks.forEach(mark => {
        const parent = mark.parentNode;
        if (parent) {
          parent.replaceChild(document.createTextNode(mark.textContent || ''), mark);
          parent.normalize();
        }
      });
      setSearchResults([]);
      setCurrentSearchIndex(-1);
      return;
    }

    // Сначала удаляем старые маркеры
    const oldMarks = editorRef.current.querySelectorAll('mark.search-result');
    oldMarks.forEach(mark => {
      const parent = mark.parentNode;
      if (parent) {
        parent.replaceChild(document.createTextNode(mark.textContent || ''), mark);
        parent.normalize();
      }
    });

    const text = editorRef.current.innerText || '';
    const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const matches = [...text.matchAll(regex)];
    
    if (matches.length === 0) {
      setSearchResults([]);
      setCurrentSearchIndex(-1);
      toast({
        title: 'Поиск',
        description: 'Ничего не найдено',
      });
      return;
    }

    setSearchResults(matches.map(m => m.index || 0));
    setCurrentSearchIndex(0);
    
    // Подсветка результатов (только для просмотра, не в режиме редактирования)
    if (!isEditing) {
      const walker = document.createTreeWalker(
        editorRef.current,
        NodeFilter.SHOW_TEXT,
        null
      );
      
      const textNodes: Text[] = [];
      let node: Node | null;
      while (node = walker.nextNode()) {
        textNodes.push(node as Text);
      }
      
      textNodes.forEach(textNode => {
        const text = textNode.textContent || '';
        const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        if (regex.test(text)) {
          const fragment = document.createDocumentFragment();
          let lastIndex = 0;
          let match;
          
          regex.lastIndex = 0; // Сброс regex
          while ((match = regex.exec(text)) !== null) {
            if (match.index > lastIndex) {
              fragment.appendChild(document.createTextNode(text.substring(lastIndex, match.index)));
            }
            const mark = document.createElement('mark');
            mark.className = 'bg-yellow-200 search-result';
            mark.textContent = match[0];
            fragment.appendChild(mark);
            lastIndex = match.index + match[0].length;
          }
          
          if (lastIndex < text.length) {
            fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
          }
          
          textNode.parentNode?.replaceChild(fragment, textNode);
        }
      });
    }
    
    // Прокручиваем к первому результату
    scrollToSearchResult(0);
  };

  const scrollToSearchResult = (index: number) => {
    if (!editorRef.current || searchResults.length === 0) return;
    
    const markers = editorRef.current.querySelectorAll('.search-result');
    if (markers.length > index) {
      markers[index].scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      // Выделяем найденный текст
      const range = document.createRange();
      range.selectNodeContents(markers[index] as Node);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
  };

  // Обработка изменения текста в поле поиска (без выполнения поиска)
  const handleSearchInputChange = (query: string) => {
    setSearchQuery(query);
    // НЕ выполняем поиск при вводе - только обновляем значение поля
  };

  // Обработчики для перетаскивания окна поиска
  const handleSearchDialogMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // Не начинаем перетаскивание если кликнули на интерактивный элемент
    const target = e.target as HTMLElement;
    if (target.closest('button, input, textarea, a, [role="button"]')) {
      return;
    }
    
    // Устанавливаем начальную позицию если её ещё нет
    if (!searchDialogPosition && searchDialogRef.current) {
      const rect = searchDialogRef.current.getBoundingClientRect();
      setSearchDialogPosition({
        x: rect.left,
        y: rect.top,
      });
    }
    
    setIsDraggingSearch(true);
    const currentPos = searchDialogPosition || { x: 0, y: 0 };
    setDragStart({
      x: e.clientX - currentPos.x,
      y: e.clientY - currentPos.y,
    });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingSearch && dragStart) {
        setSearchDialogPosition({
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y,
        });
      }
    };

    const handleMouseUp = () => {
      setIsDraggingSearch(false);
      setDragStart(null);
    };

    if (isDraggingSearch) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingSearch, dragStart]);

  // Сброс позиции при закрытии диалога
  useEffect(() => {
    if (!isSearchOpen) {
      setSearchDialogPosition(null);
    } else if (!searchDialogPosition) {
      // При первом открытии центрируем диалог (Radix UI по умолчанию центрирует, но нам нужно это для transform: none)
      if (searchDialogRef.current) {
        const rect = searchDialogRef.current.getBoundingClientRect();
        setSearchDialogPosition({
          x: window.innerWidth / 2 - rect.width / 2,
          y: window.innerHeight / 2 - rect.height / 2,
        });
      }
    }
  }, [isSearchOpen, searchDialogPosition]);

  // Выполнение поиска по нажатию кнопки "Найти"
  const handleSearch = () => {
    if (!searchQuery.trim()) {
      // Если поле пустое, очищаем результаты поиска
      highlightSearchResults('');
      return;
    }
    highlightSearchResults(searchQuery);
  };

  const handleNextResult = () => {
    if (searchResults.length === 0) return;
    const nextIndex = (currentSearchIndex + 1) % searchResults.length;
    setCurrentSearchIndex(nextIndex);
    scrollToSearchResult(nextIndex);
  };

  const handlePrevResult = () => {
    if (searchResults.length === 0) return;
    const prevIndex = (currentSearchIndex - 1 + searchResults.length) % searchResults.length;
    setCurrentSearchIndex(prevIndex);
    scrollToSearchResult(prevIndex);
  };

  const handleReplace = () => {
    if (!editorRef.current || !isEditing || !searchQuery.trim() || !replaceQuery.trim()) return;
    
    try {
      editorRef.current.focus();
      // Используем document.execCommand для замены выделенного текста
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        if (range.toString().toLowerCase() === searchQuery.toLowerCase()) {
          range.deleteContents();
          range.insertNode(document.createTextNode(replaceQuery));
          handleContentChange();
          toast({
            title: 'Замена выполнена',
            description: 'Текст успешно заменен',
          });
          // Ищем следующее вхождение
          handleNextResult();
        } else {
          toast({
            title: 'Внимание',
            description: 'Выделите текст для замены или используйте "Заменить все"',
          });
        }
      }
    } catch (error: any) {
      console.error('Ошибка замены:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось выполнить замену',
        variant: 'destructive',
      });
    }
  };

  const handleReplaceAll = () => {
    if (!editorRef.current || !isEditing || !searchQuery.trim() || !replaceQuery.trim()) return;
    
    try {
      const html = editorRef.current.innerHTML;
      const regex = new RegExp(searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      const matches = html.match(regex);
      const count = matches ? matches.length : 0;
      
      if (count > 0) {
        const newHtml = html.replace(regex, replaceQuery);
        editorRef.current.innerHTML = newHtml;
        handleContentChange();
        setSearchResults([]);
        setCurrentSearchIndex(-1);
        toast({
          title: 'Замена выполнена',
          description: `Заменено вхождений: ${count}`,
        });
      } else {
        toast({
          title: 'Внимание',
          description: 'Текст для замены не найден',
        });
      }
    } catch (error: any) {
      console.error('Ошибка замены всех:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось выполнить замену',
        variant: 'destructive',
      });
    }
  };

  // Функции масштабирования
  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 10, 200));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 10, 50));
  };

  const handleZoomReset = () => {
    setZoomLevel(100);
  };

  // Переключение режима редактирования
  const toggleEdit = () => {
    if (!editorRef.current) return;
    
    if (isEditing) {
      // Выключаем редактирование - сохраняем изменения
      handleContentChange();
      setIsEditing(false);
    } else {
      // Включаем редактирование - сохраняем текущую позицию курсора
      const savedPos = saveCursorPosition();
      setIsEditing(true);
      
      // Восстанавливаем позицию курсора после обновления DOM
      setTimeout(() => {
        if (editorRef.current) {
          editorRef.current.focus();
          restoreCursorPosition(savedPos);
        }
      }, 0);
    }
  };

  // Сохранение документа обратно в .docx
  const handleSave = async () => {
    if (!editorRef.current || !hasChanges) {
      toast({
        title: 'Нет изменений',
        description: 'Документ не был изменен',
      });
      return;
    }

    try {
      setIsLoading(true);
      
      // Парсим HTML и создаем новый документ используя docx
      const htmlContent = editorRef.current.innerHTML;
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlContent, 'text/html');
      
      // Извлекаем текст и структуру из HTML
      const paragraphs: Paragraph[] = [];
      
      // Функция для извлечения текста из элемента с учетом форматирования
      const extractTextRuns = (element: Element): TextRun[] => {
        const runs: TextRun[] = [];
        const processNode = (node: Node): void => {
          if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent?.trim();
            if (text) {
              runs.push(new TextRun(text));
            }
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as Element;
            const tagName = el.tagName.toLowerCase();
            
            // Обрабатываем форматирование
            if (tagName === 'strong' || tagName === 'b') {
              const text = el.textContent?.trim();
              if (text) {
                runs.push(new TextRun({ text, bold: true }));
              }
            } else if (tagName === 'em' || tagName === 'i') {
              const text = el.textContent?.trim();
              if (text) {
                runs.push(new TextRun({ text, italics: true }));
              }
            } else if (tagName === 'u') {
              const text = el.textContent?.trim();
              if (text) {
                runs.push(new TextRun({ text, underline: {} }));
              }
            } else {
              // Рекурсивно обрабатываем дочерние элементы
              Array.from(el.childNodes).forEach(processNode);
            }
          }
        };
        
        Array.from(element.childNodes).forEach(processNode);
        return runs.length > 0 ? runs : [new TextRun('')];
      };
      
      // Обрабатываем body документа
      const body = doc.body;
      if (body) {
        const processElement = (element: Element): void => {
          const tagName = element.tagName.toLowerCase();
          
          if (tagName === 'p') {
            const runs = extractTextRuns(element);
            if (runs.length > 0) {
              paragraphs.push(
                new Paragraph({
                  children: runs,
                  spacing: { after: 200 },
                })
              );
            }
          } else if (tagName === 'h1' || tagName === 'h2' || tagName === 'h3' || tagName === 'h4' || tagName === 'h5' || tagName === 'h6') {
            const text = element.textContent?.trim();
            if (text) {
              const headingLevel = 
                tagName === 'h1' ? HeadingLevel.HEADING_1 :
                tagName === 'h2' ? HeadingLevel.HEADING_2 :
                tagName === 'h3' ? HeadingLevel.HEADING_3 :
                tagName === 'h4' ? HeadingLevel.HEADING_4 :
                tagName === 'h5' ? HeadingLevel.HEADING_5 :
                HeadingLevel.HEADING_6;
              
              paragraphs.push(
                new Paragraph({
                  heading: headingLevel,
                  children: [new TextRun(text)],
                  spacing: { after: 200 },
                })
              );
            }
          } else if (tagName === 'br') {
            paragraphs.push(
              new Paragraph({
                children: [new TextRun('')],
                spacing: { after: 200 },
              })
            );
          } else if (tagName === 'div' || tagName === 'span') {
            // Обрабатываем div и span как обычный текст
            const runs = extractTextRuns(element);
            if (runs.length > 0) {
              paragraphs.push(
                new Paragraph({
                  children: runs,
                  spacing: { after: 200 },
                })
              );
            }
          } else {
            // Рекурсивно обрабатываем дочерние элементы
            Array.from(element.children).forEach(processElement);
          }
        };
        
        // Обрабатываем все дочерние элементы body
        Array.from(body.children).forEach(processElement);
        
        // Если нет элементов, обрабатываем текстовые узлы
        if (paragraphs.length === 0) {
          const text = body.textContent?.trim();
          if (text) {
            paragraphs.push(
              new Paragraph({
                children: [new TextRun(text)],
                spacing: { after: 200 },
              })
            );
          }
        }
      }

      // Если нет параграфов, создаем один пустой
      if (paragraphs.length === 0) {
        paragraphs.push(
          new Paragraph({
            children: [new TextRun('Пустой документ')],
          })
        );
      }

      // Создаем новый документ
      const docxDocument = new Document({
        sections: [
          {
            properties: {},
            children: paragraphs,
          },
        ],
      });

      // Генерируем .docx файл
      const blob = await Packer.toBlob(docxDocument);
      
      // Создаем FormData для загрузки
      const formData = new FormData();
      const editedFilename = `edited_${filename}`;
      formData.append('file', blob, editedFilename);
      formData.append('file_type', fileType);

      // Загружаем на сервер
      const uploadResponse = await apiClient.uploadFile(
        new File([blob], editedFilename, { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }),
        fileType
      );

      originalContentRef.current = htmlContent;
      setHasChanges(false);
      
      toast({
        title: 'Успешно',
        description: `Документ сохранен как ${uploadResponse.filename}`,
      });

      if (onSave) {
        onSave(uploadResponse.filename);
      }
    } catch (error: any) {
      console.error('Ошибка сохранения документа:', error);
      toast({
        title: 'Ошибка сохранения',
        description: error.message || 'Не удалось сохранить документ',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Скачивание документа
  const handleDownload = async () => {
    try {
      // Используем fileType для указания папки: source или changes
      const downloadFileType = fileType === 'processed' ? 'source' : fileType;
      const fileUrl = apiClient.getDownloadUrl(filename, downloadFileType);
      const response = await fetch(fileUrl, {
        headers: apiClient.getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error('Не удалось скачать файл');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      toast({
        title: 'Ошибка',
        description: error.message || 'Не удалось скачать файл',
        variant: 'destructive',
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-lg">{title}</CardTitle>
          <div className="flex gap-1 flex-wrap">
            <Button
              variant={isEditing ? 'default' : 'outline'}
              size="sm"
              onClick={toggleEdit}
              disabled={isLoading}
              title={isEditing ? 'Просмотр' : 'Редактировать'}
              className="h-8 px-2"
            >
              {isEditing ? (
                <Eye className="h-4 w-4" />
              ) : (
                <Edit2 className="h-4 w-4" />
              )}
            </Button>
            {isEditing && hasChanges && (
              <Button
                variant="default"
                size="sm"
                onClick={handleSave}
                disabled={isLoading}
                title="Сохранить"
                className="h-8 px-2"
              >
                <Save className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              disabled={isLoading}
              title="Скачать"
              className="h-8 px-2"
            >
              <Download className="h-4 w-4" />
            </Button>
            <Dialog open={isSearchOpen} onOpenChange={setIsSearchOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isLoading}
                  title="Поиск"
                  className="h-8 px-2"
                >
                  <Search className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent
                ref={searchDialogRef}
                style={
                  searchDialogPosition
                    ? {
                        position: 'fixed',
                        left: `${searchDialogPosition.x}px`,
                        top: `${searchDialogPosition.y}px`,
                        transform: 'none',
                        margin: 0,
                      }
                    : undefined
                }
                className={searchDialogPosition ? 'cursor-move' : ''}
              >
                <DialogHeader
                  onMouseDown={handleSearchDialogMouseDown}
                  className="cursor-move select-none"
                >
                  <DialogTitle>Поиск в документе</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Введите текст для поиска..."
                      value={searchQuery}
                      onChange={(e) => handleSearchInputChange(e.target.value)}
                      onKeyDown={(e) => {
                        // Поиск выполняется только по нажатию кнопки "Найти", не при нажатии Enter
                        if (e.key === 'Enter' && e.shiftKey) {
                          e.preventDefault();
                          handlePrevResult();
                        }
                      }}
                      className="flex-1"
                    />
                    <Button
                      onClick={handleSearch}
                      disabled={!searchQuery.trim()}
                      variant="default"
                    >
                      Найти
                    </Button>
                  </div>
                  {searchResults.length > 0 && (
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>Найдено: {searchResults.length}</span>
                      <div className="flex gap-2 items-center">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handlePrevResult}
                          disabled={searchResults.length === 0}
                        >
                          ← Предыдущее
                        </Button>
                        <span className="min-w-[60px] text-center">{currentSearchIndex + 1} / {searchResults.length}</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleNextResult}
                          disabled={searchResults.length === 0}
                        >
                          Следующее →
                        </Button>
                      </div>
                    </div>
                  )}
                  {searchQuery.trim() && searchResults.length === 0 && (
                    <div className="text-sm text-muted-foreground">
                      Ничего не найдено
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
            <Dialog open={isReplaceOpen} onOpenChange={setIsReplaceOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isLoading}
                  title="Найти и заменить"
                  className="h-8 px-2"
                >
                  <Replace className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Найти и заменить</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Найти:</label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Введите текст для поиска..."
                        value={searchQuery}
                        onChange={(e) => handleSearchInputChange(e.target.value)}
                        // Поиск выполняется только по нажатию кнопки "Найти", не при нажатии Enter
                        className="flex-1"
                      />
                      <Button
                        onClick={handleSearch}
                        disabled={!searchQuery.trim()}
                        variant="default"
                        size="sm"
                      >
                        Найти
                      </Button>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Заменить на:</label>
                    <Input
                      placeholder="Введите текст для замены..."
                      value={replaceQuery}
                      onChange={(e) => setReplaceQuery(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleReplace}
                      disabled={!searchQuery.trim() || !replaceQuery.trim()}
                    >
                      Заменить
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleReplaceAll}
                      disabled={!searchQuery.trim() || !replaceQuery.trim()}
                    >
                      Заменить все
                    </Button>
                  </div>
                  {searchResults.length > 0 && (
                    <div className="text-sm text-muted-foreground">
                      Найдено: {searchResults.length} вхождений
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
            <div className="flex items-center gap-1 border rounded-md">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleZoomOut}
                disabled={zoomLevel <= 50}
                className="h-8 w-8 p-0"
                title="Уменьшить"
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="text-xs px-1 min-w-[50px] text-center">{zoomLevel}%</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleZoomIn}
                disabled={zoomLevel >= 200}
                className="h-8 w-8 p-0"
                title="Увеличить"
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Панель форматирования */}
        {isEditing && (
          <div className="mb-2 p-2 border rounded-md bg-muted/50 flex flex-wrap gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={formatBold}
              title="Жирный (Ctrl+B)"
              className="h-8 w-8 p-0"
            >
              <Bold className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={formatItalic}
              title="Курсив (Ctrl+I)"
              className="h-8 w-8 p-0"
            >
              <Italic className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={formatUnderline}
              title="Подчеркивание (Ctrl+U)"
              className="h-8 w-8 p-0"
            >
              <Underline className="h-4 w-4" />
            </Button>
            <Separator orientation="vertical" className="h-6 mx-1" />
            <Button
              variant="ghost"
              size="sm"
              onClick={formatUnorderedList}
              title="Маркированный список"
              className="h-8 w-8 p-0"
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={formatOrderedList}
              title="Нумерованный список"
              className="h-8 w-8 p-0"
            >
              <ListOrdered className="h-4 w-4" />
            </Button>
            <Separator orientation="vertical" className="h-6 mx-1" />
            <Button
              variant="ghost"
              size="sm"
              onClick={formatAlignLeft}
              title="Выравнивание по левому краю"
              className="h-8 w-8 p-0"
            >
              <AlignLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={formatAlignCenter}
              title="Выравнивание по центру"
              className="h-8 w-8 p-0"
            >
              <AlignCenter className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={formatAlignRight}
              title="Выравнивание по правому краю"
              className="h-8 w-8 p-0"
            >
              <AlignRight className="h-4 w-4" />
            </Button>
          </div>
        )}
        
        <div 
          className="border rounded-md bg-white min-h-[500px] max-h-[600px] overflow-auto"
          style={{ zoom: `${zoomLevel}%` }}
        >
          {isLoading ? (
            <div className="flex items-center justify-center h-[500px]">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : content ? (
            <div
              ref={editorRef}
              className={`p-6 prose prose-sm max-w-none ${
                isEditing 
                  ? 'outline outline-2 outline-primary outline-offset-2' 
                  : ''
              }`}
              onInput={handleContentChange}
              onBlur={handleContentChange}
              suppressContentEditableWarning={true}
              style={{
                minHeight: '500px',
                fontFamily: 'inherit',
              }}
            />
          ) : (
            <div className="flex items-center justify-center h-[500px]">
              <div className="text-center text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Документ пуст или не загружен</p>
              </div>
            </div>
          )}
        </div>
        {hasChanges && !isEditing && (
          <div className="mt-2 text-sm text-muted-foreground">
            ⚠️ Есть несохраненные изменения
          </div>
        )}
      </CardContent>
    </Card>
  );
}

