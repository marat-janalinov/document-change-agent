import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, Download, FileText, Languages } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

interface TranslationResult {
  translatedFile: string;
  originalFilename: string;
  targetLanguage: string;
  sourceLanguage: string;
}

const OnlineTranslator: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sourceLanguage, setSourceLanguage] = useState<string>('ru');
  const [targetLanguage, setTargetLanguage] = useState<string>('kz');
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationResult, setTranslationResult] = useState<TranslationResult | null>(null);
  const { toast } = useToast();
  const { token } = useAuth();

  const languageOptions = [
    { value: 'ru', label: 'Русский' },
    { value: 'kz', label: 'Казахский' },
  ];

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type !== 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        toast({
          title: "Неподдерживаемый формат",
          description: "Пожалуйста, выберите файл в формате .docx",
          variant: "destructive",
        });
        return;
      }
      setSelectedFile(file);
      setTranslationResult(null);
    }
  };

  const handleTranslate = async () => {
    if (!selectedFile) {
      toast({
        title: "Файл не выбран",
        description: "Пожалуйста, выберите файл для перевода",
        variant: "destructive",
      });
      return;
    }

    if (sourceLanguage === targetLanguage) {
      toast({
        title: "Одинаковые языки",
        description: "Исходный и целевой языки должны отличаться",
        variant: "destructive",
      });
      return;
    }

    setIsTranslating(true);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('source_language', sourceLanguage);
      formData.append('target_language', targetLanguage);

      const headers: HeadersInit = {};
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch('/api/translate-document', {
        method: 'POST',
        headers,
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Ошибка при переводе документа');
      }

      const result = await response.json();
      setTranslationResult(result);

      toast({
        title: "Перевод завершен",
        description: `Документ успешно переведен с ${getLanguageName(sourceLanguage)} на ${getLanguageName(targetLanguage)}`,
      });
    } catch (error) {
      console.error('Translation error:', error);
      toast({
        title: "Ошибка перевода",
        description: error instanceof Error ? error.message : "Произошла ошибка при переводе документа",
        variant: "destructive",
      });
    } finally {
      setIsTranslating(false);
    }
  };

  const handleDownload = async () => {
    if (!translationResult) return;

    try {
      const headers: HeadersInit = {};
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(`/api/download-translated/${translationResult.translatedFile}`, {
        headers,
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Ошибка при скачивании файла');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `translated_${translationResult.originalFilename}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Файл скачан",
        description: "Переведенный документ успешно скачан",
      });
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: "Ошибка скачивания",
        description: "Не удалось скачать переведенный файл",
        variant: "destructive",
      });
    }
  };

  const getLanguageName = (code: string): string => {
    const language = languageOptions.find(lang => lang.value === code);
    return language ? language.label : code;
  };

  const swapLanguages = () => {
    const temp = sourceLanguage;
    setSourceLanguage(targetLanguage);
    setTargetLanguage(temp);
    setTranslationResult(null);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Languages className="h-8 w-8 text-blue-600" />
        <h1 className="text-3xl font-bold">Онлайн-переводчик</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Перевод документов
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Выбор файла */}
          <div className="space-y-2">
            <Label htmlFor="file-upload">Выберите документ для перевода</Label>
            <div className="flex items-center gap-4">
              <Input
                id="file-upload"
                type="file"
                accept=".docx"
                onChange={handleFileSelect}
                className="flex-1"
              />
              {selectedFile && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <FileText className="h-4 w-4" />
                  {selectedFile.name}
                </div>
              )}
            </div>
            <p className="text-sm text-gray-500">
              Поддерживаются только файлы в формате .docx
            </p>
          </div>

          {/* Выбор языков */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="space-y-2">
              <Label>Исходный язык</Label>
              <Select value={sourceLanguage} onValueChange={setSourceLanguage}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {languageOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={swapLanguages}
                className="px-3"
                title="Поменять языки местами"
              >
                ⇄
              </Button>
            </div>

            <div className="space-y-2">
              <Label>Целевой язык</Label>
              <Select value={targetLanguage} onValueChange={setTargetLanguage}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {languageOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Кнопка перевода */}
          <div className="flex justify-center">
            <Button
              onClick={handleTranslate}
              disabled={!selectedFile || isTranslating || sourceLanguage === targetLanguage}
              className="px-8"
            >
              {isTranslating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Переводим...
                </>
              ) : (
                <>
                  <Languages className="h-4 w-4 mr-2" />
                  Перевести документ
                </>
              )}
            </Button>
          </div>

          {/* Результат перевода */}
          {translationResult && (
            <Card className="bg-green-50 border-green-200">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="font-medium text-green-800">
                      Перевод завершен успешно!
                    </p>
                    <p className="text-sm text-green-600">
                      Документ переведен с {getLanguageName(translationResult.sourceLanguage)} на {getLanguageName(translationResult.targetLanguage)}
                    </p>
                    <p className="text-xs text-gray-500">
                      Файл: {translationResult.originalFilename}
                    </p>
                  </div>
                  <Button onClick={handleDownload} className="bg-green-600 hover:bg-green-700">
                    <Download className="h-4 w-4 mr-2" />
                    Скачать
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      {/* Информация о переводчике */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Информация</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
              <p>Поддерживаются переводы между русским и казахским языками в обоих направлениях</p>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
              <p>Принимаются только файлы в формате Microsoft Word (.docx)</p>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
              <p>Перевод выполняется с сохранением форматирования документа</p>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
              <p>После перевода вы можете скачать готовый документ</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default OnlineTranslator;
