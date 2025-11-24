export type Role = 'executive' | 'admin' | 'security';

export type Language = 'ru' | 'kz' | 'en';

export interface User {
  id: string;
  email: string;
  role: Role;
  status: 'active' | 'blocked';
  createdAt: string;
  tags?: string[];
}

export interface ChatMessage {
  id: string;
  chatId: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  attachments?: FileAttachment[];
  sources?: Source[];
  metadata?: MessageMetadata;
}

export interface FileAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  status: 'queued' | 'uploading' | 'analyzing' | 'done' | 'error';
  progress?: number;
  url?: string;
}

export interface Source {
  id: string;
  title: string;
  type: 'document' | 'table' | 'glossary';
  excerpt: string;
  page?: number;
}

export interface MessageMetadata {
  dataVersion: string;
  processingTime: number;
  confidence: number;
}

export interface Chat {
  id: string;
  title: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  isPinned: boolean;
  hasFiles: boolean;
  messageCount: number;
}

export interface GlossaryTerm {
  id: string;
  term: string;
  definition: string;
  tags: string[];
  updatedAt: string;
  updatedBy: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userEmail: string;
  action: string;
  resource: string;
  result: 'success' | 'error' | 'denied';
  traceId: string;
  details?: Record<string, any>;
}

export interface AIPromptTemplate {
  id: string;
  name: string;
  description: string;
  template: string;
  category: string;
  isActive: boolean;
  updatedAt: string;
}

export interface SecurityPolicy {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  type: 'file_restriction' | 'size_limit' | 'access_control';
  config: Record<string, any>;
}
