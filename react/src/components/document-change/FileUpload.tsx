import { useState, useRef, DragEvent } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, FileText } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { toast } from '@/hooks/use-toast';

interface FileUploadProps {
  title: string;
  description?: string;
  fileType: 'source' | 'changes';
  selectedFile: string | null;
  availableFiles: string[]; // Все файлы для обратной совместимости
  files?: string[]; // Файлы конкретного типа (приоритет)
  onFileSelect: (filename: string | null) => void;
  onFileUpload: (filename: string) => void;
  onFilesUpdate: () => void;
}

export function FileUpload({
  title,
  description,
  fileType,
  selectedFile,
  availableFiles,
  files,
  onFileSelect,
  onFileUpload,
  onFilesUpdate,
}: FileUploadProps) {
  // Используем files если передан, иначе используем все availableFiles (для обратной совместимости)
  const displayFiles = files || availableFiles;
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      // Передаем fileType для сохранения в правильную подпапку
      const response = await apiClient.uploadFile(file, fileType);
      onFileUpload(response.filename);
      onFilesUpdate();
      toast({
        title: 'Успешно',
        description: `Файл ${response.original_filename} загружен в папку ${fileType}`,
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          {title}
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
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

        <Select value={selectedFile || undefined} onValueChange={(value) => onFileSelect(value || null)}>
          <SelectTrigger>
            <SelectValue placeholder={`— выберите файл из папки ${fileType} —`} />
          </SelectTrigger>
          <SelectContent>
            {displayFiles
              .slice()
              .sort((a, b) => a.localeCompare(b))
              .map((filename) => (
                <SelectItem key={filename} value={filename}>
                  {filename}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  );
}

