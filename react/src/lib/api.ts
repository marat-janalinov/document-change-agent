// В продакшене используем относительный путь (проксируется через nginx)
// В разработке используем прямой URL к backend
const API_BASE_URL = import.meta.env.VITE_API_URL || 
  (import.meta.env.DEV ? 'http://localhost:8000' : '');

export interface UploadResponse {
  filename: string;
  original_filename: string;
  size: number;
}

export interface FileListResponse {
  uploads: string[];
}

export interface ProcessDocumentsRequest {
  source_filename: string;
  changes_filename: string;
}

export interface ProcessDocumentsResponse {
  session_id: string;
}

export interface SessionStatus {
  status: 'processing' | 'completed' | 'failed';
  progress?: number;
  results?: ProcessingResults;
  error?: string;
}

export interface ProcessingResults {
  total_changes: number;
  successful: number;
  failed: number;
  processed_filename: string;
  backup_filename: string;
}

export interface ChangeItem {
  change_id: string;
  operation: string;
  status: 'success' | 'error' | 'pending';
  description?: string;
  details?: any;
}

export interface CheckInstructionsResponse {
  filename: string;
  file_size: number;
  total_changes: number;
  parser_changes?: number;  // Опционально, так как парсер отключен
  llm_changes?: number;  // Опционально
  changes: ChangeItem[];
  summary: {
    by_operation: Record<string, number>;
    mass_replacements: Array<{ old: string; new: string }>;
    point_changes: any[];
    deletions: any[];
    insertions: any[];
  };
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem('auth_token');
    const headers: HeadersInit = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  async uploadFile(file: File, fileType: 'source' | 'changes' | 'check'): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    // Преобразуем 'check' в 'changes' для backend
    const backendFileType = fileType === 'check' ? 'changes' : fileType;
    formData.append('file_type', backendFileType);

    const headers = this.getAuthHeaders();
    console.log('[API] Загрузка файла:', {
      filename: file.name,
      fileType: backendFileType,
      hasToken: !!headers['Authorization']
    });

    const response = await fetch(`${this.baseUrl}/api/upload-file`, {
      method: 'POST',
      headers: headers,
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(errorData.detail || `Ошибка загрузки файла: ${response.statusText}`);
    }

    return response.json();
  }

  async getFiles(fileType?: 'source' | 'changes'): Promise<FileListResponse> {
    let url = `${this.baseUrl}/api/files`;
    if (fileType) {
      const separator = url.includes('?') ? '&' : '?';
      url += `${separator}file_type=${encodeURIComponent(fileType)}`;
    }
    const response = await fetch(url, {
      headers: this.getAuthHeaders(),
    });
    if (!response.ok) {
      throw new Error(`Ошибка получения списка файлов: ${response.statusText}`);
    }
    return response.json();
  }

  async generateTestFiles(): Promise<{ files: { source: string; changes: string } }> {
    const response = await fetch(`${this.baseUrl}/api/generate-test-files`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Ошибка генерации тестовых файлов: ${response.statusText}`);
    }

    return response.json();
  }

  async processDocuments(
    sourceFilename: string,
    changesFilename: string
  ): Promise<ProcessDocumentsResponse> {
    const response = await fetch(`${this.baseUrl}/api/process-documents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders(),
      },
      body: JSON.stringify({
        source_filename: sourceFilename,
        changes_filename: changesFilename,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ошибка запуска обработки: ${response.statusText}`);
    }

    return response.json();
  }

  async getSessionStatus(sessionId: string): Promise<SessionStatus> {
    const response = await fetch(`${this.baseUrl}/api/session/${sessionId}/status`, {
      headers: this.getAuthHeaders(),
    });
    if (!response.ok) {
      throw new Error(`Ошибка получения статуса: ${response.statusText}`);
    }
    return response.json();
  }

  async checkInstructions(filename: string): Promise<CheckInstructionsResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 минут

    try {
      const response = await fetch(
        `${this.baseUrl}/api/check-instructions?filename=${encodeURIComponent(filename)}`,
        {
          method: 'POST',
          headers: this.getAuthHeaders(),
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: response.statusText }));
        throw new Error(errorData.detail || `Ошибка ${response.status}: ${response.statusText}`);
      }

      return response.json();
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Превышено время ожидания ответа. Проверка может занять до 5 минут для больших файлов.');
      }
      throw error;
    }
  }

  getDownloadUrl(filename: string, fileType?: 'source' | 'changes'): string {
    let url = `${this.baseUrl}/api/download/${encodeURIComponent(filename)}`;
    if (fileType) {
      const separator = url.includes('?') ? '&' : '?';
      url += `${separator}file_type=${encodeURIComponent(fileType)}`;
    }
    return url;
  }

  getExportCheckResultsUrl(filename: string): string {
    return `${this.baseUrl}/api/export-check-results?filename=${encodeURIComponent(filename)}`;
  }

  getWebSocketUrl(sessionId: string): string {
    // Используем тот же протокол и хост, что и текущая страница
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    return `${protocol}//${host}/ws/${sessionId}`;
  }

  // Аутентификация
  async login(username: string, password: string): Promise<{ access_token: string; user: any }> {
    const response = await fetch(`${this.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(error.detail || 'Ошибка входа');
    }

    return response.json();
  }

  async getCurrentUser(token: string): Promise<any> {
    const url = `${this.baseUrl}/api/auth/me`;
    console.log('[API] Запрос getCurrentUser:', url);
    console.log('[API] Токен:', token ? `${token.substring(0, 20)}...` : 'НЕТ');
    
    const response = await fetch(url, {
      method: 'GET',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
    });

    console.log('[API] Ответ getCurrentUser:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[API] Ошибка getCurrentUser:', response.status, errorText);
      throw new Error(`Ошибка получения данных пользователя: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    console.log('[API] Данные пользователя получены:', data);
    return data;
  }

  // Управление пользователями (только для администраторов)
  async getUsers(token: string): Promise<any[]> {
    const response = await fetch(`${this.baseUrl}/api/auth/users`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      throw new Error('Ошибка получения списка пользователей');
    }

    return response.json();
  }

  async createUser(token: string, userData: {
    email: string;
    username: string;
    password: string;
    role: string;
    tags?: string[];
  }): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/auth/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(userData),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(error.detail || 'Ошибка создания пользователя');
    }

    return response.json();
  }

  async updateUser(token: string, userId: number, userData: {
    email?: string;
    username?: string;
    role?: string;
    status?: string;
    tags?: string[];
  }): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/auth/users/${userId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(userData),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(error.detail || 'Ошибка обновления пользователя');
    }

    return response.json();
  }

  async deleteUser(token: string, userId: number): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/auth/users/${userId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(error.detail || 'Ошибка удаления пользователя');
    }
  }

  // Получение текста документа
  async getDocumentText(filename: string): Promise<{
    filename: string;
    text: string;
    length: number;
  }> {
    const response = await fetch(
      `${this.baseUrl}/api/document-text/${encodeURIComponent(filename)}`,
      {
        headers: this.getAuthHeaders(),
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(error.detail || 'Ошибка получения текста документа');
    }

    return response.json();
  }

  // Получение логов операций
  async getOperationLogs(params?: {
    limit?: number;
    offset?: number;
    operation_type?: string;
    user_id?: number;
  }): Promise<{
    total: number;
    limit: number;
    offset: number;
    logs: Array<{
      id: number;
      operation_id: string;
      operation_type: string;
      user_id: number | null;
      username: string | null;
      source_filename: string | null;
      changes_filename: string | null;
      tokens_used: number;
      tokens_prompt: number;
      tokens_completion: number;
      total_changes: number;
      status: string;
      error_message: string | null;
      created_at: string | null;
      completed_at: string | null;
    }>;
  }> {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());
    if (params?.operation_type) queryParams.append('operation_type', params.operation_type);
    if (params?.user_id) queryParams.append('user_id', params.user_id.toString());

    const response = await fetch(
      `${this.baseUrl}/api/operation-logs?${queryParams.toString()}`,
      {
        headers: this.getAuthHeaders(),
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(error.detail || 'Ошибка получения логов');
    }

    return response.json();
  }

  // НОВЫЙ ФУНКЦИОНАЛ: Получение полного лога операции
  async getFullOperationLog(operation_id: string): Promise<any> {
    const response = await fetch(
      `${this.baseUrl}/api/operation-logs/${operation_id}/full`,
      {
        headers: this.getAuthHeaders(),
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(error.detail || 'Ошибка получения полного лога');
    }

    return response.json();
  }

  // Управление промптами
  async getPrompts(): Promise<any[]> {
    const response = await fetch(`${this.baseUrl}/api/prompts/`, {
      headers: this.getAuthHeaders(),
    });
    if (!response.ok) {
      throw new Error(`Ошибка получения промптов: ${response.statusText}`);
    }
    return response.json();
  }

  async getPrompt(filename: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/prompts/${encodeURIComponent(filename)}`, {
      headers: this.getAuthHeaders(),
    });
    if (!response.ok) {
      throw new Error(`Ошибка получения промпта: ${response.statusText}`);
    }
    return response.json();
  }

  async createPrompt(prompt: { filename: string; name: string; category: string; content: string }): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/prompts/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders(),
      },
      body: JSON.stringify(prompt),
    });
    if (!response.ok) {
      throw new Error(`Ошибка создания промпта: ${response.statusText}`);
    }
    return response.json();
  }

  async updatePrompt(filename: string, prompt: { name?: string; category?: string; content?: string; is_active?: boolean }): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/prompts/${encodeURIComponent(filename)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders(),
      },
      body: JSON.stringify(prompt),
    });
    if (!response.ok) {
      throw new Error(`Ошибка обновления промпта: ${response.statusText}`);
    }
    return response.json();
  }

  async deletePrompt(filename: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/prompts/${encodeURIComponent(filename)}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders(),
    });
    if (!response.ok) {
      throw new Error(`Ошибка удаления промпта: ${response.statusText}`);
    }
  }

  // Удаление файла
  async deleteFile(filename: string, fileType?: 'source' | 'changes'): Promise<void> {
    let url = `${this.baseUrl}/api/files/${encodeURIComponent(filename)}`;
    if (fileType) {
      url += `?file_type=${encodeURIComponent(fileType)}`;
    }
    const response = await fetch(url, {
      method: 'DELETE',
      headers: this.getAuthHeaders(),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(errorData.detail || 'Ошибка удаления файла');
    }
  }
}

export const apiClient = new ApiClient();

