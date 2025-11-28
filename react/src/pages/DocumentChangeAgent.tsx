import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileUpload } from '@/components/document-change/FileUpload';
import { ProcessingStep } from '@/components/document-change/ProcessingStep';
import { ResultsStep } from '@/components/document-change/ResultsStep';
import { InstructionCheck } from '@/components/document-change/InstructionCheck';
import { FileManagement } from '@/components/document-change/FileManagement';
import OnlineTranslator from '@/components/document-change/OnlineTranslator';
import { useDocumentChange } from '@/hooks/useDocumentChange';
import { apiClient } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { FileText, RefreshCw, Play, CheckCircle2, FileSearch, FolderOpen, Languages } from 'lucide-react';
import { HeaderVariant1 } from '@/components/layout/HeaderVariant1';
import { OperationLogs } from '@/components/document-change/OperationLogs';
import { useApp } from '@/contexts/AppContext';

export default function DocumentChangeAgent() {
  console.log('[DocumentChangeAgent] Компонент монтируется');
  
  const { currentRole } = useApp();
  const isOperator = currentRole === 'executive';
  const isSecurityOperator = currentRole === 'security';
  
  const {
    sourceFile,
    changesFile,
    availableFiles,
    sourceFiles,
    changesFiles,
    currentStep,
    progress,
    statusLog,
    changes,
    results,
    setSourceFile,
    setChangesFile,
    startProcessing,
    reset,
    fetchFiles,
  } = useDocumentChange();
  
  console.log('[DocumentChangeAgent] Состояние:', {
    sourceFile,
    changesFile,
    currentStep,
    hasAvailableFiles: !!availableFiles?.length
  });
  
  // Визуальный индикатор, что компонент рендерится
  console.log('[DocumentChangeAgent] Начало рендеринга JSX');

  const [isGenerating, setIsGenerating] = useState(false);
  const [language, setLanguage] = useState<'ru' | 'kk' | 'en'>('ru');

  const handleGenerateTestFiles = async () => {
    setIsGenerating(true);
    try {
      const data = await apiClient.generateTestFiles();
      setSourceFile(data.files.source);
      setChangesFile(data.files.changes);
      await fetchFiles();
      toast({
        title: 'Успешно',
        description: 'Тестовые файлы сгенерированы',
      });
    } catch (error: any) {
      toast({
        title: 'Ошибка',
        description: error.message || 'Не удалось сгенерировать тестовые файлы',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const canStartProcessing = Boolean(sourceFile && changesFile);

  console.log('[DocumentChangeAgent] Возвращаем JSX');
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/5 to-primary/10 relative overflow-hidden">
      <HeaderVariant1 />
      <div className="flex items-center justify-center p-8 min-h-[calc(100vh-7rem)]">
        <div className="w-full max-w-6xl relative z-10 animate-fade-in">
          <div className="backdrop-blur-xl bg-card/80 rounded-3xl p-8 border border-border/50 shadow-2xl space-y-6">

            <Tabs defaultValue="main" className="space-y-6">
              <TabsList className={`grid w-full ${(isOperator || isSecurityOperator) ? 'grid-cols-5' : 'grid-cols-4'} bg-background/50 backdrop-blur-sm`}>
                <TabsTrigger value="main" className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Применение изменений
                </TabsTrigger>
                <TabsTrigger value="check" className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Проверка инструкций
                </TabsTrigger>
                <TabsTrigger value="files" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Управление файлами
                </TabsTrigger>
                {(isOperator || isSecurityOperator) && (
                  <TabsTrigger value="logs" className="flex items-center gap-2">
                    <FileSearch className="h-4 w-4" />
                    Логи операций
                  </TabsTrigger>
                )}
                <TabsTrigger value="translator" className="flex items-center gap-2">
                  <Languages className="h-4 w-4" />
                  Онлайн-переводчик
                </TabsTrigger>
              </TabsList>

              <TabsContent value="check" className="space-y-6">
                <Card className="bg-background/50 backdrop-blur-sm border-border/50">
                  <CardContent className="pt-6">
                    <InstructionCheck />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="files" className="space-y-6">
                <Card className="bg-background/50 backdrop-blur-sm border-border/50">
                  <CardContent className="pt-6">
                    <FileManagement />
                  </CardContent>
                </Card>
              </TabsContent>

              {(isOperator || isSecurityOperator) && (
                <TabsContent value="logs" className="space-y-6">
                  <Card className="bg-background/50 backdrop-blur-sm border-border/50">
                    <CardContent className="pt-6">
                      <OperationLogs />
                    </CardContent>
                  </Card>
                </TabsContent>
              )}

              <TabsContent value="translator" className="space-y-6">
                <Card className="bg-background/50 backdrop-blur-sm border-border/50">
                  <CardContent className="pt-6">
                    <OnlineTranslator />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="main" className="space-y-6">
                {/* Навигация по шагам */}
                <Card className="bg-background/50 backdrop-blur-sm border-border/50">
                  <CardContent className="pt-6">
                    <div className="flex justify-around items-center">
                      {[1, 2, 3].map((step) => (
                        <div
                          key={step}
                          className={`flex items-center gap-3 ${
                            currentStep === step ? 'opacity-100' : 'opacity-50'
                          }`}
                        >
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${
                              currentStep === step
                                ? 'bg-gradient-to-br from-primary to-primary/80'
                                : 'bg-muted-foreground'
                            }`}
                          >
                            {step}
                          </div>
                          <span className="font-medium hidden sm:block">
                            {step === 1 ? 'Загрузка файлов' : step === 2 ? 'Обработка' : 'Результаты'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Шаг 1: Загрузка файлов */}
                {currentStep === 1 && (
                  <div className="space-y-6">
                    <Card className="bg-primary/5 border-primary/20 backdrop-blur-sm">
                      <CardContent className="pt-6">
                        <div className="text-center space-y-2">
                          <Button
                            onClick={handleGenerateTestFiles}
                            disabled={isGenerating}
                            variant="outline"
                            size="lg"
                            className="bg-background/50 backdrop-blur-sm"
                          >
                            {isGenerating ? (
                              <>
                                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                Генерация...
                              </>
                            ) : (
                              <>
                                <FileText className="h-4 w-4 mr-2" />
                                Сгенерировать тестовые файлы
                              </>
                            )}
                          </Button>
                          <p className="text-sm text-muted-foreground">
                            Создаст пример документа с инструкциями изменений
                          </p>
                        </div>
                      </CardContent>
                    </Card>

                           <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                             <FileUpload
                               title="📄 Исходный документ"
                               fileType="source"
                               selectedFile={sourceFile}
                               availableFiles={availableFiles}
                               files={sourceFiles}
                               onFileSelect={setSourceFile}
                               onFileUpload={setSourceFile}
                               onFilesUpdate={fetchFiles}
                             />
 
                             <FileUpload
                               title="📋 Файл с инструкциями"
                               fileType="changes"
                               selectedFile={changesFile}
                               availableFiles={availableFiles}
                               files={changesFiles}
                               onFileSelect={setChangesFile}
                               onFileUpload={setChangesFile}
                               onFilesUpdate={fetchFiles}
                             />
                           </div>

                    <div className="flex justify-center">
                      <Button
                        onClick={startProcessing}
                        disabled={!canStartProcessing}
                        size="lg"
                        className="min-w-[200px] bg-gradient-to-r from-primary via-secondary to-primary bg-[length:200%_100%] hover:bg-right-bottom transition-all duration-500 text-lg font-semibold shadow-lg rounded-xl"
                      >
                        <Play className="h-4 w-4 mr-2" />
                        Начать обработку
                      </Button>
                    </div>
                  </div>
                )}

                {/* Шаг 2: Обработка */}
                {currentStep === 2 && (
                  <Card className="bg-background/50 backdrop-blur-sm border-border/50">
                    <CardContent className="pt-6">
                      <ProcessingStep progress={progress} statusLog={statusLog} changes={changes} />
                    </CardContent>
                  </Card>
                )}

                {/* Шаг 3: Результаты */}
                {currentStep === 3 && results && (
                  <Card className="bg-background/50 backdrop-blur-sm border-border/50">
                    <CardContent className="pt-6">
                      <ResultsStep 
                        results={results} 
                        onReset={reset}
                        sourceFilename={sourceFile || undefined}
                        changesFilename={changesFile || undefined}
                      />
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}
