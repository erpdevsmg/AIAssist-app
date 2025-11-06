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
  PaginatedSQLQueryResult,
  SchemaSnapshot,
  AIField as FieldType,
  AIMessageLog
} from '../types/AIAssistant'; 
import { API_ENDPOINTS, PaginationParams } from '@/shared/api';
import { ApiResponse, apiClient } from '@/shared/api/client';
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


  executeSafeQuery: async (sqlQuery: string, pagination?: PaginationParams): Promise<PaginatedSQLQueryResult> => {
    try {
      const endpoint = API_ENDPOINTS.EXECUTE_SQL_QUERY;
      console.log('🔍 Executing SQL query endpoint:', endpoint);
      console.log('📝 SQL query to execute:', sqlQuery);
      
      // Build query parameters
      const params = new URLSearchParams({
        sqlQuery: sqlQuery,
      });
      
      // Add pagination parameters if provided
      if (pagination) {
        if (pagination.page !== undefined) params.append('page', pagination.page.toString());
        if (pagination.limit !== undefined) params.append('limit', pagination.limit.toString());
        if (pagination.sortBy) params.append('sortBy', pagination.sortBy);
        if (pagination.sortOrder) params.append('sortOrder', pagination.sortOrder.toUpperCase());
      }
      
      const axiosResponse = await apiClient.get(`${endpoint}?${params.toString()}`);
      const raw = axiosResponse.data;
      console.log('🔍 SQL execution raw response:', raw);
      console.log('🔍 axiosResponse.data structure:', {
        hasData: !!axiosResponse.data,
        hasTotalCount: 'totalCount' in axiosResponse.data,
        hasTotal: 'total' in axiosResponse.data,
        hasTotalPage: 'totalPage' in axiosResponse.data,
        hasTotalPages: 'totalPages' in axiosResponse.data,
        hasPagination: 'pagination' in axiosResponse.data,
        keys: Object.keys(axiosResponse.data || {}),
        fullResponse: axiosResponse.data
      });
      
      // If backend returns a plain array
      if (Array.isArray(raw)) {
        const columns = raw.length > 0 ? Object.keys(raw[0]) : [];
        const sqlResult: SQLQueryResult = {
          columns: columns,
          rows: raw.map((row: any) => {
            const rowDict: Record<string, any> = {};
            columns.forEach(col => {
              rowDict[col] = row[col];
            });
            return rowDict;
          })
        };
        
        return {
          data: sqlResult,
          success: true,
          pagination: {
            page: pagination?.page ?? 1,
            limit: pagination?.limit ?? raw.length,
            total: axiosResponse.data.totalCount ?? raw.length,
            totalPages: axiosResponse.data.totalPage ?? 1,
          },
        };
      }

      // If backend returns an object with data array (ApiResponse/PaginatedResponse)
      if (raw && Array.isArray(raw.data)) {
        const columns = raw.data.length > 0 ? Object.keys(raw.data[0]) : [];
        const sqlResult: SQLQueryResult = {
          columns: columns,
          rows: raw.data.map((row: any) => {
            const rowDict: Record<string, any> = {};
            columns.forEach(col => {
              rowDict[col] = row[col];
            });
            return rowDict;
          })
        };
        
        // Get total count from backend - check multiple possible locations
        const totalCount = axiosResponse.data.totalCount ?? 
                          axiosResponse.data.total ?? 
                          raw.pagination?.total ?? 
                          raw.total ?? 
                          raw.data.length; // Fallback to current page size only if no total available
        
        const totalPage = axiosResponse.data.totalPage ?? 
                         axiosResponse.data.totalPages ?? 
                         raw.pagination?.totalPages ?? 
                         raw.totalPages ?? 
                         Math.ceil(totalCount / (pagination?.limit ?? raw.data.length));
        
        const paginationInfo = raw.pagination ?? {
          page: pagination?.page ?? 1,
          limit: pagination?.limit ?? raw.data.length,
          total: totalCount,
          totalPages: totalPage,
        };

        return {
          data: sqlResult,
          success: true,
          pagination: paginationInfo,
        };
      }

      // Handle backend format: { Message: "Success", Data: { columns: [...], rows: [...] } }
      if (raw?.Data) {
        const totalCount = axiosResponse.data.totalCount ?? 
                          axiosResponse.data.total ?? 
                          raw.total ?? 
                          (raw.Data.rows?.length ?? 0); // Fallback to current page size only if no total available
        
        const totalPage = axiosResponse.data.totalPage ?? 
                         axiosResponse.data.totalPages ?? 
                         Math.ceil(totalCount / (pagination?.limit ?? raw.Data.rows?.length ?? 10));
        
        return {
          data: raw.Data,
          success: true,
          pagination: {
            page: pagination?.page ?? 1,
            limit: pagination?.limit ?? (raw.Data.rows?.length ?? 0),
            total: totalCount,
            totalPages: totalPage,
          },
        };
      }

      // Handle standard ApiResponse format with SQLQueryResult
      if (raw?.data && typeof raw.data === 'object' && 'columns' in raw.data) {
        return {
          data: raw.data as SQLQueryResult,
          success: true,
          pagination: raw.pagination ?? {
            page: pagination?.page ?? 1,
            limit: pagination?.limit ?? (raw.data as SQLQueryResult).rows?.length ?? 0,
            total: (raw.data as SQLQueryResult).rows?.length ?? 0,
            totalPages: 1,
          },
        };
      }

      // Fallback: Direct SQLQueryResult
      return {
        data: raw as SQLQueryResult,
        success: true,
        pagination: {
          page: pagination?.page ?? 1,
          limit: pagination?.limit ?? 1000,
          total: 0,
          totalPages: 1,
        },
      };
    } catch (error: any) {
      console.error('Error executing SQL query:', error);
      console.error('Error details:', {
        status: error?.response?.status,
        statusText: error?.response?.statusText,
        url: error?.config?.url,
        method: error?.config?.method,
        data: error?.response?.data
      });
      throw error;
    }
  },

  // Call ChatGPT API directly (for General and Read Content modes)
  callChatGPT: async (
    apiUrl: string,
    apiKey: string,
    apiModel: string,
    messages: ChatMessage[],
    temperature?: number
  ): Promise<ChatResponse> => {
    try {
      const response = await axios.post<ChatResponse>(
        apiUrl,
        {
          model: apiModel,
          messages: messages,
          temperature: temperature ?? 0.7
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
    messages: ChatMessage[],
    temperature?: number
  ): Promise<SQLGenerationRequest> => {
    try {
      const response = await axios.post<ChatResponse>(
        apiUrl,
        {
          model: apiModel,
          messages: messages,
          temperature: temperature
        },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const rawContent = response.data.choices[0]?.message?.content || '';
      console.log('Raw ChatGPT response:', rawContent);
      
      if (!rawContent || rawContent.trim() === '') {
        throw new Error('Empty response from ChatGPT API');
      }

      // First, try to extract from markdown code blocks (```sql ... ``` or ```json ... ```)
      const codeBlockRegex = /```(?:sql|json)?\s*([\s\S]*?)```/i;
      const codeBlockMatch = rawContent.match(codeBlockRegex);
      
      let extractedSQL = '';
      let extractedNotes = '';
      
      if (codeBlockMatch && codeBlockMatch[1]) {
        const codeBlockContent = codeBlockMatch[1].trim();
        console.log('Found code block content:', codeBlockContent);
        
        // Check if code block contains JSON
        if (codeBlockContent.includes('{') && codeBlockContent.includes('"sql"')) {
          // It's JSON inside the code block
          try {
            // Try to parse as JSON
            let jsonContent = codeBlockContent;
            // Remove "json" prefix if present
            jsonContent = jsonContent.replace(/^\s*json\s*/i, '').trim();
            
            // Extract JSON object if there's text before it
            const firstBrace = jsonContent.indexOf('{');
            const lastBrace = jsonContent.lastIndexOf('}');
            if (firstBrace >= 0 && lastBrace > firstBrace) {
              jsonContent = jsonContent.substring(firstBrace, lastBrace + 1);
            }
            
            const parsed = JSON.parse(jsonContent);
            console.log('Parsed JSON from code block:', parsed);
            
            // Remove parameters if present
            if (parsed.parameters) {
              delete parsed.parameters;
            }

            extractedSQL = parsed.sql || '';
            extractedNotes = parsed.notes || '';
          } catch (jsonError) {
            console.warn('Failed to parse JSON from code block, trying as SQL:', jsonError);
            // If JSON parsing fails, treat as SQL
            extractedSQL = codeBlockContent;
          }
        } else {
          // It's SQL directly in the code block
          extractedSQL = codeBlockContent;
          // Clean up - remove any leading "sql" keyword if ChatGPT added it
          extractedSQL = extractedSQL.replace(/^\s*sql\s*/i, '').trim();
        }
        
        // Extract notes/explanatory text from after the code block
        const codeBlockEnd = rawContent.indexOf('```', rawContent.indexOf('```') + 3) + 3;
        if (codeBlockEnd > 2) {
          const afterCodeBlock = rawContent.substring(codeBlockEnd).trim();
          // Only use as notes if it doesn't look like JSON and is explanatory text
          if (afterCodeBlock && !afterCodeBlock.includes('{') && !afterCodeBlock.startsWith('{') && !extractedNotes) {
            extractedNotes = afterCodeBlock;
          }
        }
        console.log('Extracted SQL from code block:', extractedSQL);
      } else {
        // Try JSON format (no code blocks)
        const cleaned = cleanModelJson(rawContent);
        console.log('Cleaned JSON:', cleaned);
        
        try {
          const parsed = JSON.parse(cleaned);
          
          // Remove parameters if present
          if (parsed.parameters) {
            delete parsed.parameters;
          }

          extractedSQL = parsed.sql || '';
          extractedNotes = parsed.notes || '';
        } catch (parseError) {
          console.warn('Failed to parse JSON, trying direct SQL extraction:', parseError);
          
          // Try to extract SQL directly from text (fallback)
          const directSqlMatch = rawContent.match(/(?:SELECT|WITH|SELECT\s+DISTINCT)[\s\S]*?(?:\n\n|\n$|```|$)/i);
          if (directSqlMatch) {
            extractedSQL = directSqlMatch[0].trim();
            // Remove code block markers if present
            extractedSQL = extractedSQL.replace(/^```(?:sql)?\s*/i, '').replace(/\s*```$/i, '').trim();
          }
        }
      }

      // Clean up SQL - remove any trailing markdown or explanatory text
      if (extractedSQL) {
        // Remove any text after SQL that looks like explanation (starts with "This query" or similar)
        const explanationStart = extractedSQL.search(/This query|This SQL|Note:|Explanation:|^```/i);
        if (explanationStart > 0) {
          extractedSQL = extractedSQL.substring(0, explanationStart).trim();
        }
        
        // Remove any trailing code block markers or markdown
        extractedSQL = extractedSQL.replace(/\s*```\s*$/, '').trim();
        
        // Remove trailing semicolons if not needed, but keep semicolons that are part of SQL
        // Don't remove semicolons as they're valid SQL syntax
        
        // Extract notes from after code block if they weren't extracted yet
        if (!extractedNotes) {
          // Look for explanatory text after the code block
          const codeBlockEndMatch = rawContent.match(/```[\s\S]*?```\s*(.+)$/is);
          if (codeBlockEndMatch && codeBlockEndMatch[1]) {
            const potentialNotes = codeBlockEndMatch[1].trim();
            // Only use if it doesn't look like code or JSON
            if (!potentialNotes.startsWith('{') && !potentialNotes.startsWith('```') && 
                (potentialNotes.toLowerCase().includes('query') || potentialNotes.toLowerCase().includes('counts') || 
                 potentialNotes.toLowerCase().includes('selects') || potentialNotes.toLowerCase().includes('note'))) {
              extractedNotes = potentialNotes;
            }
          }
        }
      }

      if (!extractedSQL || extractedSQL.trim() === '') {
        throw new Error('Generated SQL is empty. The AI model may not have understood the request.');
      }

      console.log('Final extracted SQL:', extractedSQL);
      console.log('Final extracted notes:', extractedNotes);

      return {
        sql: extractedSQL.trim(),
        notes: extractedNotes || '',
        usage: response.data.usage
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

  // Save message to AI_MessageLog table
  saveMessageLog: async (messageLog: AIMessageLog): Promise<ApiResponse<any>> => {
    try {
      const response = await api.post<any>(API_ENDPOINTS.SAVE_AI_MESSAGE_LOG, messageLog);
      return response;
    } catch (error: any) {
      // Log error but don't throw - this is a background operation
      // 401 errors are handled by the interceptor (token refresh/redirect)
      if (error?.status === 401) {
        console.warn('Authentication failed for message log. User may need to re-authenticate.');
      } else {
        console.error('Error saving message log:', error);
      }
      // Return a failed response instead of throwing
      return {
        success: false,
        message: error?.message || 'Failed to save message log',
        data: null
      };
    }
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
