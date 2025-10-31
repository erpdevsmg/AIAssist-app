export interface AIAssistant {
  docNo?: string; 
  poNo?: string; 
  reqNo?: string | null;
  revisionNo?: string | null;
  poDate?: string | null;
  suppName?: string | null;
  jobName?: string | null;
  poExpenseType?: string | null;
  lcy?: number | null;
  poAmount?: number | null;
  currencyCode?: string | null;
  flag?: string | null;
  forwardedDate?: string | null;
  forwardedFrom?: string | null;
  generatedBy?: string | null;
  onWhoseDesk?: string | null;
  status?: string | null;
  remarks?: string | null;
}

// AI Assistant Types
export interface AIProvider {
  url: string;
  apiKey: string;
}

export interface AIModel {
  model: string;
}

export interface Subdivision {
  subdivisionName: string;
  subdivisionValue: string;
}

export interface AIDivision {
  divisionName: string;
  divisionValue: string;
  subdivisions?: Subdivision[];
}

export interface AIField {
  division: string;
  tName: string; // Table Name
  fName: string; // Field Name
  fDatatype: string; // Field Datatype
  fieldDesc: string; // Field Description
}

export type AIMode = 'General' | 'Read Image/PDF' | 'SQL Assistant';

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: Date;
}

export interface SQLQueryResult {
  columns: string[];
  rows: Record<string, any>[];
}

export interface SchemaSnapshot {
  database: string;
  tables: Record<string, TableSchema>;
}

export interface TableSchema {
  qualifiedName?: string;
  columns: Record<string, ColumnInfo>;
}

export interface ColumnInfo {
  type: string;
  description: string;
}

export interface AISystemPrompt {
  systemPrompt: string;
  generalPrompt?: string;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | Array<{
    type: 'text' | 'image_url';
    text?: string;
    image_url?: { url: string };
  }>;
}

export interface ChatResponse {
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
  }>;
}

export interface SQLGenerationRequest {
  sql: string;
  notes?: string;
}

