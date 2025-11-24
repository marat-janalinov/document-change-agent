import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ProcessingResults } from '@/lib/api';
import { DocxEditor } from './DocxEditor';

interface ResultsStepProps {
  results: ProcessingResults;
  onReset: () => void;
  sourceFilename?: string;
  changesFilename?: string;
}

export function ResultsStep({ results, onReset, sourceFilename, changesFilename }: ResultsStepProps) {
  const [processedFilename, setProcessedFilename] = useState(results?.processed_filename || sourceFilename || '');
  const [error, setError] = useState<string | null>(null);

  // Обновляем processedFilename если results изменились
  useEffect(() => {
    if (results?.processed_filename) {
      setProcessedFilename(results.processed_filename);
    } else if (sourceFilename) {
      setProcessedFilename(sourceFilename);
    }
  }, [results?.processed_filename, sourceFilename]);

  if (!results) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-muted-foreground">
              Результаты обработки не найдены
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">
        <CardHeader>
          <CardTitle className="text-2xl">✓ Обработка завершена</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-4xl font-bold mb-2">{results.total_changes || 0}</div>
              <div className="text-sm opacity-90">Всего изменений</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold mb-2 text-green-300">{results.successful || 0}</div>
              <div className="text-sm opacity-90">Успешно</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold mb-2 text-red-300">{results.failed || 0}</div>
              <div className="text-sm opacity-90">Ошибок</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="text-destructive">Ошибка: {error}</div>
          </CardContent>
        </Card>
      )}

      {/* Окна с содержимым файлов */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Левое окно: содержимое обработанного файла */}
        {processedFilename ? (
          <DocxEditor
            filename={processedFilename}
            title="Содержимое обработанного файла"
            fileType="source"
            onSave={(newFilename) => setProcessedFilename(newFilename)}
          />
        ) : (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center text-muted-foreground">
                Обработанный файл не найден
              </div>
            </CardContent>
          </Card>
        )}

        {/* Правое окно: содержимое файла с инструкциями */}
        {changesFilename ? (
          <DocxEditor
            filename={changesFilename}
            title="Содержимое файла с инструкциями"
            fileType="changes"
          />
        ) : (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center text-muted-foreground">
                Файл с инструкциями не указан
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="flex justify-center">
        <Button onClick={onReset} variant="secondary" size="lg">
          🔄 Начать новую обработку
        </Button>
      </div>
    </div>
  );
}

