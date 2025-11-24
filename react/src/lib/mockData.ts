import { User, Chat, ChatMessage, GlossaryTerm, AuditLog, AIPromptTemplate, SecurityPolicy } from '@/types';

export const mockUsers: User[] = [
  {
    id: 'u_001',
    email: 'director@apx.kz',
    role: 'executive',
    status: 'active',
    createdAt: '2024-01-15T10:00:00Z',
    tags: ['руководитель', 'аналитика']
  },
  {
    id: 'u_002',
    email: 'admin@apx.kz',
    role: 'admin',
    status: 'active',
    createdAt: '2024-01-15T10:00:00Z',
    tags: ['администратор']
  },
  {
    id: 'u_003',
    email: 'ib@apx.kz',
    role: 'security',
    status: 'active',
    createdAt: '2024-01-15T10:00:00Z',
    tags: ['информационная безопасность']
  }
];

export const mockChats: Chat[] = [
  {
    id: 'c_001',
    title: 'Анализ бизнес-плана Q3',
    userId: 'u_001',
    createdAt: '2025-10-01T14:30:00Z',
    updatedAt: '2025-10-01T15:45:00Z',
    isPinned: true,
    hasFiles: true,
    messageCount: 5
  },
  {
    id: 'c_002',
    title: 'Финансовая устойчивость компании',
    userId: 'u_001',
    createdAt: '2025-09-28T09:15:00Z',
    updatedAt: '2025-09-28T10:30:00Z',
    isPinned: false,
    hasFiles: false,
    messageCount: 3
  },
  {
    id: 'c_003',
    title: 'Анализ рисков проекта',
    userId: 'u_001',
    createdAt: '2025-09-25T16:00:00Z',
    updatedAt: '2025-09-25T16:45:00Z',
    isPinned: false,
    hasFiles: true,
    messageCount: 4
  }
];

export const mockMessages: ChatMessage[] = [
  {
    id: 'm_001',
    chatId: 'c_001',
    role: 'user',
    content: 'Подготовь краткий анализ бизнес-плана',
    timestamp: '2025-10-01T14:30:00Z',
    attachments: [
      {
        id: 'a_001',
        name: 'bizplan_Q3.pdf',
        type: 'application/pdf',
        size: 2458624,
        status: 'done',
        progress: 100
      }
    ]
  },
  {
    id: 'm_002',
    chatId: 'c_001',
    role: 'assistant',
    content: '**Краткое резюме:** Бизнес-план на Q3 предусматривает увеличение выручки на 15% за счет расширения продуктовой линейки и выхода на новые рынки.\n\n**Чек-лист полноты:**\n✓ Финансовые показатели\n✓ Анализ рынка\n✗ Детализация рисков (требуется дополнение)',
    timestamp: '2025-10-01T14:31:30Z',
    sources: [
      {
        id: 's_001',
        title: 'bizplan_Q3.pdf',
        type: 'document',
        excerpt: 'Целевой показатель роста выручки составляет 15%...',
        page: 3
      }
    ],
    metadata: {
      dataVersion: 'КХД v1.4, 01.10.2025',
      processingTime: 1.5,
      confidence: 0.92
    }
  }
];

export const mockGlossary: GlossaryTerm[] = [
  {
    id: 'g_001',
    term: 'Риск',
    definition: 'Возможность возникновения события, которое может оказать негативное влияние на достижение целей организации',
    tags: ['управление рисками', 'аналитика'],
    updatedAt: '2025-09-15T12:00:00Z',
    updatedBy: 'admin@apx.kz'
  },
  {
    id: 'g_002',
    term: 'Лимит',
    definition: 'Установленное ограничение на объем операций, сумму кредитования или размер позиции',
    tags: ['финансы', 'контроль'],
    updatedAt: '2025-09-10T10:30:00Z',
    updatedBy: 'admin@apx.kz'
  }
];

export const mockAuditLogs: AuditLog[] = [
  {
    id: 'log_001',
    timestamp: '2025-10-01T14:30:15Z',
    userId: 'u_001',
    userEmail: 'director@apx.kz',
    action: 'file_upload',
    resource: 'bizplan_Q3.pdf',
    result: 'success',
    traceId: 'tr_a1b2c3d4',
    details: { fileSize: 2458624, mimeType: 'application/pdf' }
  },
  {
    id: 'log_002',
    timestamp: '2025-10-01T14:31:30Z',
    userId: 'u_001',
    userEmail: 'director@apx.kz',
    action: 'prompt_use',
    resource: 'chat_c_001',
    result: 'success',
    traceId: 'tr_e5f6g7h8'
  }
];

export const mockPrompts: AIPromptTemplate[] = [
  {
    id: 'p_001',
    name: 'Краткий анализ документов',
    description: 'Создание краткого резюме и ключевых выводов из документа',
    template: 'Проанализируй документ и предоставь: 1) Краткое резюме (2-3 предложения), 2) Ключевые выводы, 3) Рекомендации',
    category: 'Аналитика',
    isActive: true,
    updatedAt: '2025-09-20T12:00:00Z'
  },
  {
    id: 'p_002',
    name: 'Анализ рисков',
    description: 'Выявление и оценка потенциальных рисков',
    template: 'Проведи анализ рисков на основе предоставленных данных',
    category: 'Управление рисками',
    isActive: true,
    updatedAt: '2025-09-18T10:30:00Z'
  }
];

export const mockPolicies: SecurityPolicy[] = [
  {
    id: 'pol_001',
    name: 'Запрет исполняемых файлов',
    description: 'Блокировка загрузки .exe, .bat, .cmd файлов',
    isActive: true,
    type: 'file_restriction',
    config: { blockedExtensions: ['.exe', '.bat', '.cmd', '.ps1'] }
  },
  {
    id: 'pol_002',
    name: 'Лимит размера файла',
    description: 'Максимальный размер загружаемого файла 25 МБ',
    isActive: true,
    type: 'size_limit',
    config: { maxSizeBytes: 26214400 }
  }
];
