import { api } from '@/shared/api';
import { 
  AIProvider, 
  AIModel, 
  AIDivision, 
  AIField, 
  AISystemPrompt,
  ChatMessage,
  ChatResponse,
  SQLGenerationRequest,
  SQLQueryResult,
  SchemaSnapshot,
  AIField as FieldType
} from '../types/AIAssistant'; 
import { API_ENDPOINTS } from '@/shared/api';
import { ApiResponse } from '@/shared/api/client';
import axios from 'axios';


export const AIAssistantService = {
  // Get AI Provider (URL & API Key)
  getAIProvider: async (): Promise<ApiResponse<AIProvider>> => {
    try {
      const response = await api.get<AIProvider>(API_ENDPOINTS.GET_AI_PROVIDER);
      return response;
    } catch (error) {
      console.error('Error fetching AI provider:', error);
      throw error;
    }
  },

  // Get AI Model
  getAIModel: async (): Promise<ApiResponse<AIModel>> => {
    try {
      const response = await api.get<AIModel>(API_ENDPOINTS.GET_AI_MODEL);
      return response;
    } catch (error) {
      console.error('Error fetching AI model:', error);
      throw error;
    }
  },

  // Get AI Divisions (with subdivisions)
  getAIDivisions: async (): Promise<ApiResponse<AIDivision[]>> => {
    try {
      const response = await api.get<AIDivision[]>(API_ENDPOINTS.GET_AI_DIVISIONS);
      return response;
    } catch (error) {
      console.error('Error fetching AI divisions:', error);
      throw error;
    }
  },

  // Get AI Fields for a specific division
  getAIFields: async (divisionName: string): Promise<ApiResponse<AIField[]>> => {
    try {
      const response = await api.get<AIField[]>(`${API_ENDPOINTS.GET_AI_FIELDS}/${divisionName}`);
      return response;
    } catch (error) {
      console.error('Error fetching AI fields:', error);
      throw error;
    }
  },

  // Get System Prompt for a specific division
  getAIDivisionsSystemPrompt: async (divisionName: string): Promise<ApiResponse<AISystemPrompt>> => {
    try {
      const response = await api.get<AISystemPrompt>(`${API_ENDPOINTS.GET_AI_DIVISIONS_SYSTEM_PROMPT}/${divisionName}`);
      return response;
    } catch (error) {
      console.error('Error fetching system prompt:', error);
      throw error;
    }
  },

  // Execute SQL query safely
  executeSafeQuery: async (sqlQuery: string): Promise<ApiResponse<SQLQueryResult>> => {
    try {
      const response = await api.post<SQLQueryResult>(API_ENDPOINTS.EXECUTE_SQL_QUERY, { sql: sqlQuery });
      return response;
    } catch (error) {
      console.error('Error executing SQL query:', error);
      throw error;
    }
  },

  // Call ChatGPT API directly (for General and Read Content modes)
  callChatGPT: async (
    apiUrl: string,
    apiKey: string,
    apiModel: string,
    messages: ChatMessage[]
  ): Promise<ChatResponse> => {
    try {
      const response = await axios.post<ChatResponse>(
        apiUrl,
        {
          model: apiModel,
          messages: messages,
          temperature: 0.7
        },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      return response.data;
    } catch (error: any) {
      console.error('Error calling ChatGPT:', error);
      throw new Error(`API Error (${error.response?.status || 'unknown'}): ${error.response?.data?.message || error.message}`);
    }
  },

  // Generate SQL query using ChatGPT with schema context
  generateSQLQuery: async (
    apiUrl: string,
    apiKey: string,
    apiModel: string,
    messages: ChatMessage[]
  ): Promise<SQLGenerationRequest> => {
    try {
      const response = await axios.post<ChatResponse>(
        apiUrl,
        {
          model: apiModel,
          messages: messages
        },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const rawContent = response.data.choices[0]?.message?.content || '';
      const cleaned = cleanModelJson(rawContent);
      const parsed = JSON.parse(cleaned);

      // Remove parameters if present
      if (parsed.parameters) {
        delete parsed.parameters;
      }

      return {
        sql: parsed.sql || '',
        notes: parsed.notes || ''
      };
    } catch (error: any) {
      console.error('Error generating SQL query:', error);
      throw new Error(`API Error (${error.response?.status || 'unknown'}): ${error.response?.data?.message || error.message}`);
    }
  },

  // Build schema from AI Fields
  buildSchemaFromFields: (fields: FieldType[], divisionName: string): SchemaSnapshot => {
    const schema: SchemaSnapshot = {
      database: 'AI',
      tables: {}
    };

    // Filter by division
    const divisionFields = fields.filter(f => f.division === divisionName);
    if (divisionFields.length === 0) {
      return schema;
    }

    // Group by table name
    const tableGroups = divisionFields.reduce((acc, field) => {
      const tableName = field.tName;
      if (!acc[tableName]) {
        acc[tableName] = [];
      }
      acc[tableName].push(field);
      return acc;
    }, {} as Record<string, FieldType[]>);

    // Build schema structure
    Object.entries(tableGroups).forEach(([tableName, tableFields]) => {
      const columns: Record<string, { type: string; description: string }> = {};
      
      tableFields.forEach(field => {
        columns[field.fName] = {
          type: field.fDatatype,
          description: field.fieldDesc
        };
      });

      schema.tables[tableName] = {
        columns
      };
    });

    return schema;
  },
};

// Helper function to clean JSON from model response
function cleanModelJson(input: string): string {
  if (!input || !input.trim()) return '{}';

  let s = input.trim();
  // Remove code blocks
  s = s.replace(/^\s*```(?:json)?\s*/i, '');
  s = s.replace(/\s*```$/i, '');
  s = s.replace(/^\s*json\s*[:\-]?\s*/i, '');

  // Extract JSON object
  const firstIdx = s.indexOf('{');
  const lastIdx = s.lastIndexOf('}');
  if (firstIdx < 0 || lastIdx <= firstIdx) return '{}';
  s = s.substring(firstIdx, lastIdx + 1);

  // Parse and validate
  try {
    const parsed = JSON.parse(s);
    // Keep only allowed keys
    const allowedKeys = ['sql', 'notes'];
    const cleaned: any = {};
    allowedKeys.forEach(key => {
      if (parsed[key] !== undefined) {
        cleaned[key] = parsed[key];
      }
    });
    return JSON.stringify(cleaned);
  } catch (error) {
    console.error('Error parsing JSON:', error);
    return '{}';
  }
}

// SQL validation function
export function validateSQL(sql: string): { valid: boolean; error?: string } {
  if (!sql || !sql.trim()) {
    return { valid: false, error: 'SQL is empty.' };
  }

  const sqlUpper = sql.toUpperCase();

  // Check for dangerous keywords
  const dangerousKeywords = /\b(INSERT|UPDATE|DELETE|MERGE|ALTER|DROP|TRUNCATE|EXEC|CREATE|GRANT|REVOKE|XP_|SP_)\b/i;
  if (dangerousKeywords.test(sql)) {
    return { valid: false, error: 'Rejected: non-read-only keyword found in SQL (INSERT/UPDATE/DELETE/etc.).' };
  }

  // Check for system tables
  const metadataTables = /\b(sys\.|INFORMATION_SCHEMA)\b/i;
  if (metadataTables.test(sql)) {
    return { valid: false, error: 'Rejected: system tables (sys./INFORMATION_SCHEMA) are not allowed.' };
  }

  // Check for SELECT *
  if (sqlUpper.includes('SELECT *')) {
    return { valid: false, error: 'Rejected: SELECT * not allowed. Please list columns explicitly.' };
  }

  return { valid: true };
}
