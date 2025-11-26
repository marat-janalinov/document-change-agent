import { useState, useRef, useEffect, DragEvent } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Upload, FileText, Search, Download, RefreshCw, Loader2 } from 'lucide-react';
import { apiClient, type CheckInstructionsResponse } from '@/lib/api';
import { toast } from '@/hooks/use-toast';

export function InstructionCheck() {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [availableFiles, setAvailableFiles] = useState<string[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [checkResults, setCheckResults] = useState<CheckInstructionsResponse | null>(null);
  const [processedFileText, setProcessedFileText] = useState<string | null>(null);
  const [changesFileText, setChangesFileText] = useState<string | null>(null);
  const [isLoadingTexts, setIsLoadingTexts] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchFiles = async () => {
    try {
      // Для проверки инструкций используем только файлы из папки changes
      const data = await apiClient.getFiles('changes');
      setAvailableFiles(data.uploads || []);
    } catch (error) {
      console.error('Ошибка получения списка файлов:', error);
    }
  };

  const handleFileSelect = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.docx')) {
      toast({
        title: 'Ошибка',
        description: 'Поддерживаются только .docx файлы',
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);
    try {
      const response = await apiClient.uploadFile(file, 'changes');
      setSelectedFile(response.filename);
      await fetchFiles();
      toast({
        title: 'Успешно',
        description: `Файл ${response.original_filename} загружен`,
      });
    } catch (error: any) {
      toast({
        title: 'Ошибка загрузки',
        description: error.message || 'Не удалось загрузить файл',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleCheck = async () => {
    if (!selectedFile) {
      toast({
        title: 'Ошибка',
        description: 'Выберите файл для проверки',
        variant: 'destructive',
      });
      return;
    }

    setIsChecking(true);
    setCheckResults(null);

    try {
      const results = await apiClient.checkInstructions(selectedFile);
      setCheckResults(results);
      
      // Загружаем тексты файлов после завершения проверки
      setIsLoadingTexts(true);
      try {
        // Загружаем текст файла с инструкциями
        const changesTextData = await apiClient.getDocumentText(selectedFile);
        setChangesFileText(changesTextData.text);
        
        // Если есть обработанный файл, загружаем его тоже
        // (пока оставляем пустым, так как проверка не создает обработанный файл)
        setProcessedFileText(null);
      } catch (textError: any) {
        console.error('Ошибка загрузки текстов файлов:', textError);
        // Не показываем ошибку пользователю, так как основная проверка прошла успешно
      } finally {
        setIsLoadingTexts(false);
      }
      
      toast({
        title: 'Проверка завершена',
        description: `Найдено ${results.total_changes} инструкций`,
      });
    } catch (error: any) {
      toast({
        title: 'Ошибка проверки',
        description: error.message || 'Не удалось проверить файл',
        variant: 'destructive',
      });
    } finally {
      setIsChecking(false);
    }
  };

  const handleExport = () => {
    if (!selectedFile) return;
    const url = apiClient.getExportCheckResultsUrl(selectedFile);
    window.open(url, '_blank');
  };

  const handleReset = () => {
    setSelectedFile(null);
    setCheckResults(null);
    setProcessedFileText(null);
    setChangesFileText(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Загрузка файлов при монтировании
  useEffect(() => {
    fetchFiles();
  }, []);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Проверка файла на наличие инструкций
          </CardTitle>
          <CardDescription>
            Загрузите файл для проверки наличия инструкций по изменению документов
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
              isDragging
                ? 'border-primary bg-primary/5'
                : 'border-muted-foreground/25 hover:border-primary/50'
            } ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".docx"
              className="hidden"
              onChange={handleInputChange}
              disabled={isUploading}
            />
            <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-sm font-medium mb-2">
              {isUploading ? 'Загрузка...' : 'Перетащите файл или нажмите'}
            </p>
            <p className="text-xs text-muted-foreground">Поддерживается: .docx</p>
          </div>

          {selectedFile && (
            <div className="p-3 bg-muted rounded-md text-sm">
              <span className="font-medium">Выбран:</span> {selectedFile}
            </div>
          )}

          <Select value={selectedFile || undefined} onValueChange={(value) => setSelectedFile(value || null)}>
            <SelectTrigger>
              <SelectValue placeholder="— выберите файл —" />
            </SelectTrigger>
            <SelectContent>
              {availableFiles
                .slice()
                .sort((a, b) => a.localeCompare(b))
                .map((filename) => (
                  <SelectItem key={filename} value={filename}>
                    {filename}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>

          <Button
            onClick={handleCheck}
            disabled={!selectedFile || isChecking}
            className="w-full"
            size="lg"
          >
            {isChecking ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Проверка...
              </>
            ) : (
              <>
                <Search className="h-4 w-4 mr-2" />
                Проверить файл
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {checkResults && (
        <Card>
          <CardHeader>
            <CardTitle>Результаты проверки</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-3xl font-bold mb-1">{checkResults.total_changes}</div>
              <div className="text-sm text-muted-foreground">Всего инструкций найдено</div>
            </div>

            {Object.keys(checkResults.summary.by_operation).length > 0 && (
              <div>
                <h4 className="font-semibold mb-2">По типам операций:</h4>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(checkResults.summary.by_operation).map(([op, count]) => (
                    <span key={op} className="px-3 py-1 bg-primary/10 text-primary rounded-md text-sm">
                      {op}: {count}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {checkResults.summary.mass_replacements.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2">Массовые замены:</h4>
                <div className="space-y-2">
                  {checkResults.summary.mass_replacements.map((mr, idx) => (
                    <div key={idx} className="p-2 bg-muted rounded text-sm">
                      &quot;{mr.old?.substring(0, 50)}
                      {mr.old && mr.old.length > 50 ? '...' : ''}&quot; → &quot;
                      {mr.new?.substring(0, 50)}
                      {mr.new && mr.new.length > 50 ? '...' : ''}&quot;
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h4 className="font-semibold mb-2">Детальный список изменений:</h4>
              <ScrollArea className="h-[400px] border rounded-md p-4">
                <div className="font-mono text-sm space-y-3">
                  {checkResults.changes.map((change, idx) => {
                    const changeId = change.change_id || `CHG-${String(idx + 1).padStart(3, '0')}`;
                    const operation = change.operation || 'UNKNOWN';
                    return (
                      <div key={idx} className="border-b pb-3 last:border-0">
                        <div className="font-semibold mb-1">
                          {idx + 1}. {changeId}: {operation}
                        </div>
                        {change.description && (
                          <div className="text-muted-foreground mb-1">
                            <div className="flex items-start gap-2">
                              <span className="font-medium shrink-0">Описание:</span>
                              <span className="break-words">{change.description}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleExport} variant="outline" className="flex-1">
                <Download className="h-4 w-4 mr-2" />
                Экспортировать в текстовый файл
              </Button>
              <Button onClick={handleReset} variant="outline" className="flex-1">
                <RefreshCw className="h-4 w-4 mr-2" />
                Новая проверка
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Окна с содержимым файлов после завершения проверки */}
      {checkResults && (processedFileText !== null || changesFileText !== null) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Левое окно: содержимое обработанного файла */}
          {processedFileText !== null && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Содержимое обработанного файла</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px] border rounded-md p-4">
                  <div className="font-mono text-sm whitespace-pre-wrap">
                    {isLoadingTexts ? (
                      <div className="flex items-center justify-center h-full">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : (
                      processedFileText || 'Файл не найден'
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {/* Правое окно: содержимое файла с инструкциями */}
          {changesFileText !== null && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Содержимое файла с инструкциями</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px] border rounded-md p-4">
                  <div className="font-mono text-sm whitespace-pre-wrap">
                    {isLoadingTexts ? (
                      <div className="flex items-center justify-center h-full">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : (
                      changesFileText || 'Файл не найден'
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

