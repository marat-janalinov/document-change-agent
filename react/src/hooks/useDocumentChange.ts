import { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient, type ChangeItem, type ProcessingResults } from '@/lib/api';

export interface UseDocumentChangeState {
  // Файлы
  sourceFile: string | null;
  changesFile: string | null;
  availableFiles: string[];
  sourceFiles: string[];
  changesFiles: string[];
  
  // Обработка
  sessionId: string | null;
  currentStep: 1 | 2 | 3;
  progress: number;
  statusLog: Array<{ message: string; type: 'info' | 'success' | 'error' | 'warning' }>;
  changes: ChangeItem[];
  results: ProcessingResults | null;
  
  // WebSocket
  wsConnected: boolean;
}

export function useDocumentChange() {
  const [state, setState] = useState<UseDocumentChangeState>({
    sourceFile: null,
    changesFile: null,
    availableFiles: [],
    sourceFiles: [],
    changesFiles: [],
    sessionId: null,
    currentStep: 1,
    progress: 0,
    statusLog: [{ message: 'Инициализация...', type: 'info' }],
    changes: [],
    results: null,
    wsConnected: false,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Загрузка списка файлов
  const fetchFiles = useCallback(async () => {
    try {
      // Получаем файлы для обоих типов
      const [sourceFiles, changesFiles] = await Promise.all([
        apiClient.getFiles('source'),
        apiClient.getFiles('changes'),
      ]);
      // Разделяем файлы по типам
      const sourceFilesList = sourceFiles.uploads || [];
      const changesFilesList = changesFiles.uploads || [];
      
      console.log('[useDocumentChange] Получены файлы:', {
        source: sourceFilesList.length,
        changes: changesFilesList.length,
        sourceFiles: sourceFilesList,
        changesFiles: changesFilesList,
      });
      
      // Объединяем списки файлов для обратной совместимости
      const allFiles = [...sourceFilesList, ...changesFilesList];
      setState((prev) => ({ 
        ...prev, 
        availableFiles: allFiles,
        sourceFiles: sourceFilesList,
        changesFiles: changesFilesList,
      }));
    } catch (error) {
      console.error('Ошибка получения списка файлов:', error);
    }
  }, []);

  // Установка файлов
  const setSourceFile = useCallback((filename: string | null) => {
    setState((prev) => ({ ...prev, sourceFile: filename }));
  }, []);

  const setChangesFile = useCallback((filename: string | null) => {
    setState((prev) => ({ ...prev, changesFile: filename }));
  }, []);

  // Добавление лога
  const addLog = useCallback((message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
    setState((prev) => ({
      ...prev,
      statusLog: [...prev.statusLog, { message, type }],
    }));
  }, []);

  // Переключение шага
  const setStep = useCallback((step: 1 | 2 | 3) => {
    setState((prev) => ({ ...prev, currentStep: step }));
  }, []);

  // Подключение WebSocket
  const connectWebSocket = useCallback((sessionId: string) => {
    if (wsRef.current) {
      wsRef.current.close();
    }

    const wsUrl = apiClient.getWebSocketUrl(sessionId);
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setState((prev) => ({ ...prev, wsConnected: true }));
      addLog('✓ Real-time соединение установлено', 'success');
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        handleWebSocketMessage(message);
      } catch (error) {
        console.error('Ошибка парсинга WebSocket сообщения:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket ошибка:', error);
      addLog('✗ Ошибка WebSocket соединения', 'error');
    };

    ws.onclose = () => {
      setState((prev) => ({ ...prev, wsConnected: false }));
    };

    wsRef.current = ws;
  }, [addLog]);

  // Обработка сообщений WebSocket
  const handleWebSocketMessage = useCallback((message: any) => {
    switch (message.type) {
      case 'progress':
        if (message.data?.progress !== undefined) {
          setState((prev) => ({ ...prev, progress: message.data.progress }));
        }
        if (message.data?.status) {
          addLog(message.data.status);
        }
        break;

      case 'operation_completed':
        setState((prev) => ({
          ...prev,
          changes: [...prev.changes, message.data],
        }));
        const changeStatus = message.data.status?.toLowerCase() || 'info';
        addLog(
          `${message.data.change_id} • ${message.data.operation} — ${message.data.status}`,
          changeStatus === 'success' ? 'success' : changeStatus === 'error' ? 'error' : 'info'
        );
        break;

      case 'completed':
        if (message.data) {
          setState((prev) => ({
            ...prev,
            results: message.data,
            progress: 100,
          }));
          addLog('✓ Обработка завершена', 'success');
          setTimeout(() => setStep(3), 500);
        }
        break;

      case 'error':
        addLog(`✗ Ошибка: ${message.data?.error || 'Неизвестная ошибка'}`, 'error');
        break;
    }
  }, [addLog, setStep]);

  // Polling статуса
  const startPolling = useCallback((sessionId: string) => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    pollingIntervalRef.current = setInterval(async () => {
      try {
        const status = await apiClient.getSessionStatus(sessionId);
        
        if (status.status === 'completed') {
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          if (status.results) {
            setState((prev) => ({
              ...prev,
              results: status.results!,
              progress: 100,
            }));
            addLog('✓ Обработка завершена', 'success');
            setTimeout(() => setStep(3), 500);
          }
        } else if (status.status === 'failed') {
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          addLog(`✗ Ошибка: ${status.error || 'Неизвестная ошибка'}`, 'error');
        } else if (status.progress !== undefined) {
          setState((prev) => ({ ...prev, progress: status.progress! }));
        }
      } catch (error) {
        console.error('Ошибка polling:', error);
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
      }
    }, 2000);
  }, [addLog, setStep]);

  // Запуск обработки
  const startProcessing = useCallback(async () => {
    if (!state.sourceFile || !state.changesFile) {
      addLog('✗ Укажите файлы исходника и изменений', 'error');
      return;
    }

    try {
      setStep(2);
      setState((prev) => ({
        ...prev,
        changes: [],
        statusLog: [{ message: 'Подготовка к обработке...', type: 'info' }],
        progress: 0,
      }));

      const response = await apiClient.processDocuments(state.sourceFile, state.changesFile);
      
      setState((prev) => ({ ...prev, sessionId: response.session_id }));
      addLog('✓ Обработка запущена', 'success');
      addLog(`Session ID: ${response.session_id}`);

      connectWebSocket(response.session_id);
      startPolling(response.session_id);
    } catch (error: any) {
      console.error('Ошибка запуска:', error);
      addLog(`✗ Ошибка запуска обработки: ${error.message}`, 'error');
    }
  }, [state.sourceFile, state.changesFile, setStep, addLog, connectWebSocket, startPolling]);

  // Сброс к началу
  const reset = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    setState((prev) => ({
      ...prev,
      sessionId: null,
      currentStep: 1,
      progress: 0,
      statusLog: [{ message: 'Инициализация...', type: 'info' }],
      changes: [],
      results: null,
      wsConnected: false,
    }));
    fetchFiles();
  }, [fetchFiles]);

  // Инициализация
  useEffect(() => {
    fetchFiles();
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [fetchFiles]);

  return {
    ...state,
    setSourceFile,
    setChangesFile,
    setStep,
    startProcessing,
    reset,
    fetchFiles,
    addLog,
  };
}

