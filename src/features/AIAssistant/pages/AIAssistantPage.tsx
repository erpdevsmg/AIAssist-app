import { useState, useEffect, useRef } from 'react';
import { 
  Send, 
  X, 
  Trash2, 
  Loader2,
  AlertCircle,
  User as UserIcon,
  Bot,
  Search,
  Paperclip,
  FileText,
  Download,
  Copy,
} from 'lucide-react';
import { Layout } from '@/shared/ui/Layout';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { AIAssistantService } from '../api/AIAssistantService';
import { userService } from '@/shared/api';
import type { User } from '@/shared/api';
import { 
  AIMode, 
  ConversationMessage, 
  SQLQueryResult, 
  ChatMessage,
  AIMessageLog
} from '../types/AIAssistant';
import { validateSQL } from '../api/AIAssistantService';

export function AIAssistantPage() {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Loading & Error States
  const [loading, setLoading] = useState(false);
  const [_loadingSchema, setLoadingSchema] = useState(false); // Schema loading state (set but not currently used in UI)
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // User & Authentication
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const isAJIMUser = currentUser?.userID?.toUpperCase() === 'AJIM';

  // ChatGPT API Configuration
  const [apiUrl, setApiUrl] = useState<string>('');
  const [apiKey, setApiKey] = useState<string>('');
  const [apiModel, setApiModel] = useState<string>('');
  const [apiTemperature, setApiTemperature] = useState<number | undefined>(undefined);

  // Dark Mode State
  const [isDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('darkMode');
      if (stored !== null) return stored === 'true';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  // File Attachment State (for Read Image/PDF mode)
  const [attachedFiles, setAttachedFiles] = useState<Array<{
    file: File;
    preview: string;
    type: 'image' | 'pdf';
  }>>([]);

  // SQL Assistant Mode - Schema & Context
  const [sqlMessages, setSqlMessages] = useState<ChatMessage[] | null>(null);
  const [currentDivisionForSQL, setCurrentDivisionForSQL] = useState<string | null>(null);

  // Update dark mode class on document
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('darkMode', 'true');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('darkMode', 'false');
    }
  }, [isDarkMode]);

  // Load current user
  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const response = await userService.getCurrentUser(controller.signal);
        let userData: User | null = null;
        if (response?.data) {
          userData = response.data;
        } else if (response && typeof response === 'object' && 'userName' in response) {
          userData = response as unknown as User;
        }
        console.log('Current user:', userData);
        setCurrentUser(userData);
      } catch (e: any) {
        console.error('Error fetching user:', e);
        setCurrentUser(null);
      }
    })();
    return () => {
      controller.abort();
    };
  }, []);

  // Form state
  const [mode, setMode] = useState<AIMode>('SQL Assistant');
  const [selectedDivision, setSelectedDivision] = useState<string>(''); // Stores division value
  const [selectedSubdivisionKey, setSelectedSubdivisionKey] = useState<string>(''); // Stores unique key for display
  const [question, setQuestion] = useState('');
  const [conversation, setConversation] = useState<ConversationMessage[]>([]);
  const [sqlResults, setSqlResults] = useState<SQLQueryResult | null>(null);
  const [showResultsModal, setShowResultsModal] = useState(false);
  
  // Conversation tracking for message logging
  const [conversationId, setConversationId] = useState<string>(() => {
    // Generate a GUID format conversation ID on component mount
    return generateGuid();
  });
  const [turnIndex, setTurnIndex] = useState(0);
  
  // Helper function to generate GUID
  function generateGuid(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
  
  // Store SQL results per message index for inline display
  const [messageResults, setMessageResults] = useState<Map<number, SQLQueryResult>>(new Map());
  const [messagePagination, setMessagePagination] = useState<Map<number, { 
    totalItems: number; 
    totalPages: number; 
    currentPage: number; 
    pageSize: number; 
    sortBy: string; 
    sortOrder: 'asc' | 'desc' 
  }>>(new Map());
  
  // Pagination state for SQL results (global - for backward compatibility)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10); // Default to 10 records per page
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [sortBy, setSortBy] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Effect to attach pending SQL results to the latest assistant message
  useEffect(() => {
    if (mode === 'SQL Assistant' && (window as any).__pendingSQLResult && conversation.length > 0) {
      const pendingResult = (window as any).__pendingSQLResult;
      const lastMessage = conversation[conversation.length - 1];
      
      if (lastMessage && lastMessage.role === 'assistant') {
        const contentUpper = lastMessage.content.trim().toUpperCase();
        const looksLikeSQL = contentUpper.startsWith('SELECT') || contentUpper.startsWith('WITH') || 
                            (contentUpper.includes('SELECT') && contentUpper.includes('FROM'));
        
        if (looksLikeSQL) {
          const assistantMessageIndex = conversation.length - 1;
          
          // Check if results are already stored for this index
          if (!messageResults.has(assistantMessageIndex)) {
            setMessageResults(prev => {
              const newMap = new Map(prev);
              newMap.set(assistantMessageIndex, pendingResult.data);
              return newMap;
            });
            
            setMessagePagination(prev => {
              const newMap = new Map(prev);
              newMap.set(assistantMessageIndex, pendingResult.pagination);
              return newMap;
            });
            
            // Clear pending result
            delete (window as any).__pendingSQLResult;
          }
        }
      }
    }
  }, [conversation, mode, messageResults]);

  // Data state
  // Flat list of subdivisions with division as value
  const [subdivisionOptions, setSubdivisionOptions] = useState<Array<{ label: string; value: string; division: string; uniqueKey: string }>>([]);
  const [subdivisionSearch, setSubdivisionSearch] = useState('');

  // Load initial data
  useEffect(() => {
    const initialize = async () => {
      try {
        setInitializing(true);
        setError(null);
        
        // Load AI Provider (URL & API Key)
        try {
          const providerResponse: any = await AIAssistantService.getAIProvider();
          
          // Backend returns: { data: [{ aI_URL: '...', aI_API_KEY: '...' }] }
          let providerData: any = null;
          
          // Check if response.data is an array with provider data
          if (providerResponse?.data && Array.isArray(providerResponse.data) && providerResponse.data.length > 0) {
            providerData = providerResponse.data[0];
          }
          // Check if response.data has Data property (backend format)
          else if (providerResponse?.data && (providerResponse.data as any).Data && Array.isArray((providerResponse.data as any).Data) && (providerResponse.data as any).Data.length > 0) {
            providerData = (providerResponse.data as any).Data[0];
          }
          
          if (providerData) {
            // Backend uses aI_URL and aI_API_KEY (with lowercase aI_ prefix)
            // Extract directly from providerData
            const url = providerData.aI_URL || providerData.AI_URL || providerData.url || providerData.Url;
            const apiKeyValue = providerData.aI_API_KEY || providerData.AI_API_KEY || providerData.apiKey || providerData.ApiKey;
            
            // Set URL and API Key
            if (url) {
              setApiUrl(url);
            }
            
            if (apiKeyValue) {
              setApiKey(apiKeyValue);
            }
          }
        } catch (providerError: any) {
          // Only show error for actual API failures (not 404 which might be acceptable)
          if (providerError?.response?.status && providerError.response.status !== 404) {
            const errorMsg = providerError?.message || 'Unknown error';
            setError(`Failed to load AI Provider: ${errorMsg}`);
          } else {
            // 404 or network error - just warn, don't block the app
            console.warn('AI Provider endpoint not found or not configured. Please configure it in backend settings.');
          }
          // Continue loading other data even if provider fails
        }

        // Load AI Model
        try {
          const modelResponse: any = await AIAssistantService.getAIModel();
          
          // Backend returns: { data: [{ aI_Model: 'gpt-4o' }] }
          let modelData: any = null;
          
          // Check if response.data is an array with model data
          if (modelResponse?.data && Array.isArray(modelResponse.data) && modelResponse.data.length > 0) {
            modelData = modelResponse.data[0];
          }
          // Check if response.data has Data property (backend format)
          else if (modelResponse?.data && (modelResponse.data as any).Data && Array.isArray((modelResponse.data as any).Data) && (modelResponse.data as any).Data.length > 0) {
            modelData = (modelResponse.data as any).Data[0];
          }
          
          if (modelData) {
            // Backend uses aI_Model (with lowercase aI_ prefix)
            // Try multiple property name variations
            const model = modelData.aI_Model || modelData.AI_Model || modelData.model || modelData.Model;
            
            if (model) {
              setApiModel(model);
            }
            
            // Extract temperature from model data (similar to model extraction)
            const temperature = modelData.aI_Temperature || modelData.AI_Temperature || 
                               modelData.temperature || modelData.Temperature;
            
            if (temperature !== undefined && temperature !== null) {
              setApiTemperature(typeof temperature === 'number' ? temperature : parseFloat(temperature));
            }
          }
        } catch (modelError: any) {
          // Only show error for actual API failures (not 404 which might be acceptable)
          if (modelError?.response?.status && modelError.response.status !== 404) {
            const errorMsg = modelError?.message || 'Unknown error';
            setError(prev => prev || `Failed to load AI Model: ${errorMsg}`);
          } else {
            // 404 or network error - just warn, don't block the app
            console.warn('AI Model endpoint not found or not configured. Please configure it in backend settings.');
          }
        }
        
        // Load divisions (this is more critical for SQL mode)
        try {
          const divisionsResponse = await AIAssistantService.getAIDivisions();
          
          // Handle different response formats
          // Backend returns: { Message: "Success", Data: [...] }
          // Data is an array of objects with { Division, SubDivision }
          let divisionsData: any[] = [];
          
          // Check if response has Data property (from backend response)
          if (divisionsResponse?.data && (divisionsResponse.data as any).Data && Array.isArray((divisionsResponse.data as any).Data)) {
            divisionsData = (divisionsResponse.data as any).Data;
          }
          // Check if response has success flag and data
          else if (divisionsResponse && divisionsResponse.success && divisionsResponse.data && Array.isArray(divisionsResponse.data)) {
            divisionsData = divisionsResponse.data;
          } 
          // Handle response without success flag but with data array
          else if (divisionsResponse && divisionsResponse.data && Array.isArray(divisionsResponse.data)) {
            divisionsData = divisionsResponse.data;
          }
          // Handle direct array response
          else if (Array.isArray(divisionsResponse)) {
            divisionsData = divisionsResponse;
          }
          
          if (divisionsData && divisionsData.length > 0) {
            const flatSubdivisions: Array<{ label: string; value: string; division: string; uniqueKey: string }> = [];
            
            divisionsData.forEach((item: any, index: number) => {
              const division = item.Division || item.division || '';
              const subdivision = item.SubDivision || item.subDivision || item.subdivision || '';
              
              if (subdivision) {
                const uniqueKey = `${division}_${subdivision}_${index}`;
                flatSubdivisions.push({
                  label: subdivision, // Display subdivision name
                  value: division, // Store division as value
                  division: division,
                  uniqueKey: uniqueKey
                });
              }
            });
            
            setSubdivisionOptions(flatSubdivisions);
            
            // Auto-select first subdivision option if available
            if (flatSubdivisions.length > 0) {
              const firstOption = flatSubdivisions[0];
              setSelectedDivision(firstOption.value); // This is the division value
              setSelectedSubdivisionKey(firstOption.uniqueKey); // For display
              }
          } else {
            if (mode === 'SQL Assistant') {
              setError('No divisions available. Please check backend configuration.');
            }
          }
        } catch (divisionsError: any) {
          console.error('Error loading divisions:', divisionsError);
          // Show error if in SQL Assistant mode, otherwise just warn
          if (mode === 'SQL Assistant') {
            const errorMsg = divisionsError?.response?.status === 404
              ? 'Divisions endpoint not found. Please check backend configuration.'
              : divisionsError?.message || 'Failed to load divisions';
            setError(`Failed to load divisions: ${errorMsg}`);
          } else {
            console.warn('Divisions failed to load but not needed for current mode');
          }
        }

        // Always set initializing to false after all operations complete
        setInitializing(false);
      } catch (error) {
        console.error('Failed to initialize AI Assistant:', error);
        setError('Failed to initialize AI Assistant');
        setInitializing(false);
      }
    };

    initialize();
  }, []);

  // Load AI fields and system prompt when division changes (persistent schema context like VB.NET)
  useEffect(() => {
    if (!selectedDivision) {
      // Reset SQL messages when division is cleared
      setSqlMessages(null);
      setCurrentDivisionForSQL(null);
      setError(null); // Clear any errors
      return;
    }

    // Clear error and reset SQL messages if division changed
    if (currentDivisionForSQL !== null && currentDivisionForSQL !== selectedDivision) {
      setSqlMessages(null);
      setCurrentDivisionForSQL(null);
      setError(null); // Clear previous error when switching divisions
    }

    const loadDivisionData = async () => {
      try {
        setLoadingSchema(true);
        setError(null); // Clear any previous errors when starting to load new division
        
        // Load AI fields for the selected division
        // Backend returns: { Message: "Success", Data: List<AIFieldDto> }
        const fieldsResponse: any = await AIAssistantService.getAIFields(selectedDivision);
        
        // Handle backend format: { Message: "Success", Data: [...] }
        let fields: any[] = [];
        if (fieldsResponse?.Data && Array.isArray(fieldsResponse.Data)) {
          fields = fieldsResponse.Data;
        } else if (fieldsResponse?.data && Array.isArray(fieldsResponse.data)) {
          fields = fieldsResponse.data;
        } else if (Array.isArray(fieldsResponse)) {
          fields = fieldsResponse;
        }
        
        // Load system prompt for the selected division
        // Backend returns: { Message: "Success", Data: { SystemPrompt: "...", GeneralPrompt: "..." } }
        const promptResponse: any = await AIAssistantService.getAIDivisionsSystemPrompt(selectedDivision);
        let loadedSystemPrompt = '';
        let generalPrompt = '';
        
        // Handle backend format: { Message: "Success", Data: { SystemPrompt: "...", GeneralPrompt: "..." } }
        let promptData = null;
        if (promptResponse?.Data) {
          promptData = promptResponse.Data;
        } else if (promptResponse?.data) {
          promptData = promptResponse.data;
        } else if (promptResponse?.SystemPrompt || promptResponse?.systemPrompt) {
          promptData = promptResponse;
        }
        
        if (promptData) {
          loadedSystemPrompt = promptData.SystemPrompt || promptData.systemPrompt || '';
          generalPrompt = promptData.GeneralPrompt || promptData.generalPrompt || '';
          
          // Append GeneralPrompt to SystemPrompt if it exists (like VB.NET does)
          if (generalPrompt && generalPrompt.trim() !== '') {
            loadedSystemPrompt += ' ' + generalPrompt;
          }
        }

        // Build persistent SQL messages with schema context (like VB.NET LoadSchemaFromDatabaseWithPrompt)
        if (fields.length > 0) {
          const schema = AIAssistantService.buildSchemaFromFields(fields, selectedDivision);
          
          // Build system prompt with schema
          let sqlSystemPrompt = loadedSystemPrompt || 'You are a SQL query generator. Generate valid SQL SELECT queries based on the database schema provided.';
          
          if (Object.keys(schema.tables).length > 0) {
            const schemaText = JSON.stringify(schema, null, 2);
            sqlSystemPrompt += `\n\nDatabase Schema:\n${schemaText}\n\nGenerate SQL queries using only the tables and columns defined in this schema. Return your response as JSON with "sql" and "notes" fields.`;
            
            // Initialize/Update persistent SQL messages (like VB.NET sqlMessages)
            const initialMessages: ChatMessage[] = [
              {
                role: 'system',
                content: sqlSystemPrompt
              },
              {
                role: 'user',
                content: 'Use this schema for all future SQL queries.'
              }
            ];

            setSqlMessages(initialMessages);
            setCurrentDivisionForSQL(selectedDivision);
          } else {
            // Schema has no tables - show warning
            setError(`No schema fields available from database for AI fields for division '${selectedDivision}'.`);
          }
        } else {
          // No fields loaded - show error
          setError(`No schema fields available from database for AI fields for division '${selectedDivision}'.`);
        }

        setLoadingSchema(false);
      } catch (error) {
        console.error('Error loading division data:', error);
        setError('Failed to load division data');
        setLoadingSchema(false);
      }
    };

    loadDivisionData();
  }, [selectedDivision]); // Only depend on selectedDivision to avoid infinite loops

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation]);

  // Handle file selection for Read Image/PDF mode
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const newFiles: Array<{ file: File; preview: string; type: 'image' | 'pdf' }> = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileType = file.type;

      // Check if it's an image
      if (fileType.startsWith('image/')) {
        const preview = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.readAsDataURL(file);
        });
        newFiles.push({ file, preview, type: 'image' });
      }
      // Check if it's a PDF
      else if (fileType === 'application/pdf') {
        // For PDF, we'll show a placeholder preview
        const preview = 'data:image/svg+xml;base64,' + btoa(`
          <svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
            <rect width="200" height="200" fill="#f3f4f6"/>
            <text x="100" y="100" text-anchor="middle" font-family="Arial" font-size="14" fill="#6b7280">PDF Document</text>
          </svg>
        `);
        newFiles.push({ file, preview, type: 'pdf' });
      } else {
        setError(`Unsupported file type: ${fileType}. Please select images (JPG, PNG, GIF, WEBP) or PDF files.`);
        continue;
      }
    }

    setAttachedFiles(prev => [...prev, ...newFiles]);
    // Reset input
    event.target.value = '';
  };

  // Remove attached file
  const handleRemoveFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Convert image file to base64 for ChatGPT vision API
  const convertImageToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data URL prefix, keep only base64 data
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Handle asking a question
  const handleAskQuestion = async () => {
    if (!question.trim() && mode !== 'Read Image/PDF') return;
    if (mode === 'Read Image/PDF' && attachedFiles.length === 0 && !question.trim()) {
      setError('Please attach an image or PDF file, or enter a question.');
      return;
    }
    if (mode === 'SQL Assistant' && !selectedDivision) {
      setError('Please select a division first');
      return;
    }

    // Check if API credentials are available
    if (!apiUrl || !apiKey || !apiModel) {
      setError('AI Provider is not configured. Please check backend settings.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // For Read Image/PDF mode with files, create message with images
      let userMessageContent: string | Array<{type: 'text' | 'image_url'; text?: string; image_url?: {url: string}}>;
      
      if (mode === 'Read Image/PDF' && attachedFiles.length > 0) {
        // Build content array with text and images
        const contentArray: Array<{type: 'text' | 'image_url'; text?: string; image_url?: {url: string}}> = [];
        
        // Add text question if provided
        if (question.trim()) {
          contentArray.push({
            type: 'text',
            text: question.trim()
          });
        } else {
          // Default prompt if no question provided
          contentArray.push({
            type: 'text',
            text: 'Please read and describe the content of this image/document in detail.'
          });
        }

        // Add images
        for (const attachedFile of attachedFiles) {
          if (attachedFile.type === 'image') {
            try {
              const base64 = await convertImageToBase64(attachedFile.file);
              // ChatGPT vision API expects data URL format
              const mimeType = attachedFile.file.type || 'image/jpeg';
              const dataUrl = `data:${mimeType};base64,${base64}`;
              
              contentArray.push({
                type: 'image_url',
                image_url: { url: dataUrl }
              });
            } catch (error) {
              console.error('Error converting image to base64:', error);
              setError('Failed to process image file. Please try again.');
              setLoading(false);
              return;
            }
          } else if (attachedFile.type === 'pdf') {
            // Note: ChatGPT vision API doesn't directly support PDFs
            // We would need to convert PDF pages to images first
            // For now, show an error
            setError('PDF files need to be converted to images. This feature will be enhanced soon.');
            setLoading(false);
            return;
          }
        }
        
        userMessageContent = contentArray;
      } else {
        // Regular text message
        userMessageContent = question;
      }

      // Add user message to conversation (display version for conversation history)
      // For messages with images, show a text representation in the conversation
      let displayContent: string;
      if (typeof userMessageContent === 'string') {
        displayContent = userMessageContent;
      } else {
        // Build display text from content array
        const textParts: string[] = [];
        let imageIndex = 0;
        for (const item of userMessageContent) {
          if (item.type === 'text' && item.text) {
            textParts.push(item.text);
          } else if (item.type === 'image_url') {
            const fileName = attachedFiles[imageIndex]?.file?.name || 'image';
            textParts.push(`[Image: ${fileName}]`);
            imageIndex++;
          }
        }
        displayContent = textParts.join('\n');
      }

      const userMessage: ConversationMessage = {
        role: 'user',
        content: displayContent,
        timestamp: new Date()
      };
      
      // Increment turn index for user message
      const currentTurnIndex = turnIndex;
      setTurnIndex(prev => prev + 1);
      
      // Save user message to database
      try {
        const userMessageLog: AIMessageLog = {
          conversationId: conversationId,
          turnIndex: currentTurnIndex,
          role: 'user',
          content: displayContent,
          createdUtc: new Date().toISOString(),
          taskType: mode,
          // appUserHash will be set by backend from authenticated user
          orgId: mode === 'SQL Assistant' ? (selectedDivision || undefined) : undefined,
          responseOk: true
        };
        // Save message log silently (non-blocking background operation)
        AIAssistantService.saveMessageLog(userMessageLog).catch(err => {
          // Silently handle errors - message logging is non-critical
          // 401 errors are handled by the API interceptor (token refresh/redirect)
          if (err?.status !== 401) {
            console.warn('Failed to save user message log:', err);
          }
        });
      } catch (logError) {
        console.error('Error preparing user message log:', logError);
      }
      
      // Add user message to conversation immediately
      const updatedConversation = [...conversation, userMessage];
      setConversation(updatedConversation);
      

      // Convert conversation history to ChatGPT message format
      const chatMessages = updatedConversation.map((msg, idx) => {
        // For the last message (current one) with images, use the content array format
        if (idx === updatedConversation.length - 1 && mode === 'Read Image/PDF' && attachedFiles.length > 0) {
          return {
            role: 'user' as const,
            content: userMessageContent
          };
        }
        return {
          role: (msg.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
          content: typeof msg.content === 'string' ? msg.content : msg.content
        };
      });

      let aiResponseContent = '';

      if (mode === 'SQL Assistant') {
        // Clear previous SQL results when starting a new query
        setSqlResults(null);
        
        // Ensure schema context is loaded (like VB.NET checks sqlMessages)
        if (!sqlMessages || currentDivisionForSQL !== selectedDivision) {
          setError('Schema not loaded. Please wait for schema to load or select a division again.');
          setLoading(false);
          return;
        }
        
        // For SQL Assistant mode, generate SQL query using persistent schema context
        try {
          // Use persistent SQL messages and add current user question (like VB.NET GenerateSQLQuery)
          const messagesForAPI: ChatMessage[] = [
            ...sqlMessages, // System prompt + schema already included
            ...chatMessages // Add conversation history
          ];
          
          // Track start time for latency measurement
          const sqlStartTime = Date.now();
          const sqlResponse = await AIAssistantService.generateSQLQuery(
            apiUrl,
            apiKey,
            apiModel,
            messagesForAPI,
            apiTemperature
          );
          const sqlLatency = Date.now() - sqlStartTime;
          // Store SQL latency, response, and temperature for logging
          (window as any).__sqlLatency = sqlLatency;
          (window as any).__lastSQLResponse = sqlResponse;
          (window as any).__sqlTemperature = apiTemperature;
          
          if (!sqlResponse.sql || sqlResponse.sql.trim() === '') {
            throw new Error('Generated SQL is empty. The AI model may not have understood the request or schema.');
          }
          
          // Validate SQL before execution (like VB.NET ValidateSql)
          const validation = validateSQL(sqlResponse.sql);
          if (!validation.valid) {
            setError(validation.error || 'SQL validation failed');
            setLoading(false);
            return;
          }
          
          // Show SQL query only for AJIM user, show notes/explanations for others
          if (isAJIMUser) {
            aiResponseContent = sqlResponse.sql;
          } else {
            // For non-AJIM users, show ChatGPT's notes/explanations instead of SQL
            aiResponseContent = sqlResponse.notes || 'SQL query has been generated and executed successfully.';
          }
          
          // Add assistant response to persistent SQL messages (like VB.NET adds to sqlMessages)
          if (sqlMessages) {
            setSqlMessages([
              ...sqlMessages,
              ...chatMessages, // User question
              {
          role: 'assistant',
                content: sqlResponse.sql
              }
            ]);
          }
          
          // Execute the SQL query and populate results
          try {
            const cleanSQL = sqlResponse.sql.trim();
            
            // Close modal first to ensure it can reopen with new data
            setShowResultsModal(false);
            
            // Reset pagination when executing new query
            const initialPage = 1;
            const initialPageSize = 10; // Default to 10 records per page
            setCurrentPage(initialPage);
            
            const executionResponse = await AIAssistantService.executeSafeQuery(cleanSQL, {
              page: initialPage,
              limit: initialPageSize,
              sortBy: sortBy || undefined,
              sortOrder: sortOrder
            });
            
            if (executionResponse.success && executionResponse.data) {
                // Store results temporarily - we'll attach them to the assistant message after it's added
                // Store the SQL query and results so we can match them later
                const pendingResult = {
                  sqlQuery: cleanSQL,
                  data: executionResponse.data,
                  pagination: 'pagination' in executionResponse && executionResponse.pagination
                    ? {
                        totalItems: executionResponse.pagination.total || executionResponse.data.rows?.length || 0,
                        totalPages: executionResponse.pagination.totalPages || 1,
                        currentPage: executionResponse.pagination.page || 1,
                        pageSize: executionResponse.pagination.limit || initialPageSize,
                        sortBy: sortBy || '',
                        sortOrder: sortOrder
                      }
                    : {
                        // If no pagination metadata, use rows length as total (will be corrected on first page change)
                        totalItems: executionResponse.data.rows?.length || 0,
                        totalPages: 1,
                        currentPage: 1,
                        pageSize: initialPageSize,
                        sortBy: sortBy || '',
                        sortOrder: sortOrder
                      }
                };
                // Store in a ref or state that we can access when adding the message
                // We'll use a temporary storage and then move it to messageResults after conversation updates
                (window as any).__pendingSQLResult = pendingResult;
                
                // Update global state for backward compatibility
                setSqlResults(executionResponse.data);
                if ('pagination' in executionResponse && executionResponse.pagination) {
                  setTotalItems(executionResponse.pagination.total || 0);
                  setTotalPages(executionResponse.pagination.totalPages || 1);
                  setCurrentPage(executionResponse.pagination.page || 1);
                } else {
                  setTotalItems(executionResponse.data.rows?.length || 0);
                  setTotalPages(1);
                }
                
                if (executionResponse.data.rows.length === 0) {
                  setSuccessMessage('Query executed successfully, but returned no data.');
                  setTimeout(() => setSuccessMessage(null), 3000);
                }
            } else {
              setError('SQL query executed but returned no results.');
            }
          } catch (execError: any) {
            // Check if it's a 404 - endpoint might not exist
            if (execError?.response?.status === 404) {
              const errorMsg = `SQL execution endpoint not found (404). Endpoint: '/Desk/ExecuteSafeQuery'. Please verify this endpoint exists in your backend.`;
              setError(errorMsg);
            } else {
              // Don't throw - we still want to show the generated SQL even if execution fails
              const errorMsg = execError?.response?.data?.message || execError?.message || 'Unknown error';
              setError(`Generated SQL but failed to execute: ${errorMsg}`);
            }
          }
        } catch (sqlError: any) {
          throw sqlError;
        }
      } else {
        // For General and Read Image/PDF modes, use regular ChatGPT
        try {
          // Track start time for latency measurement
          const chatStartTime = Date.now();
          const chatResponse = await AIAssistantService.callChatGPT(
            apiUrl,
            apiKey,
            apiModel,
            chatMessages,
            apiTemperature
          );
          const chatLatency = Date.now() - chatStartTime;
          aiResponseContent = chatResponse.choices[0]?.message?.content || 'No response received from AI.';
          
          // Store response data for logging
          (window as any).__lastChatResponse = {
            response: chatResponse,
            latency: chatLatency,
            model: apiModel,
            temperature: apiTemperature ?? 0.7
          };
        } catch (chatError: any) {
          throw chatError;
        }
      }

      const aiResponse: ConversationMessage = {
        role: 'assistant',
        content: aiResponseContent,
          timestamp: new Date()
        };

      // Update conversation - use updatedConversation (which includes the user message) instead of conversation
      // The assistant message will be at updatedConversation.length
      const finalConversation = [...updatedConversation, aiResponse];
      const assistantMessageIndex = updatedConversation.length; // This is where the new message will be
      
      setConversation(finalConversation);
      
      // If this is a SQL query response and we have pending results, attach them to this message index
      // Use setTimeout to ensure state updates are processed
      if (mode === 'SQL Assistant' && (window as any).__pendingSQLResult) {
        const pendingResult = (window as any).__pendingSQLResult;
        
        // Use setTimeout to ensure conversation state has updated before storing results
        setTimeout(() => {
          // Store results using the assistant message index
          setMessageResults(prev => {
            const newMap = new Map(prev);
            newMap.set(assistantMessageIndex, pendingResult.data);
            return newMap;
          });
          
          setMessagePagination(prev => {
            const newMap = new Map(prev);
            newMap.set(assistantMessageIndex, pendingResult.pagination);
            return newMap;
          });
          
          // Clear pending result
          delete (window as any).__pendingSQLResult;
        }, 50);
      }
      
      // Save assistant message to database
      try {
        const lastResponse = (window as any).__lastChatResponse || {};
        const sqlResponse = (window as any).__lastSQLResponse;
        const sqlTemperature = (window as any).__sqlTemperature;
        
        // Determine temperature: use from response if available, otherwise use stored SQL temperature or API temperature
        let messageTemperature: number | undefined = undefined;
        if (mode === 'SQL Assistant') {
          messageTemperature = sqlTemperature ?? apiTemperature;
        } else {
          messageTemperature = lastResponse.temperature ?? apiTemperature ?? 0.7;
        }
        
        // Check if SQL was executed
        const pendingResult = (window as any).__pendingSQLResult;
        
        // Build complete tool_calls_json - full SQL response as-is
        let toolCallsData: any = null;
        if (mode === 'SQL Assistant' && sqlResponse) {
          toolCallsData = {
            sqlResponse: sqlResponse, // Full SQL response including sql, notes, usage
            executionResult: pendingResult ? {
              rowCount: pendingResult.data?.rows?.length || 0,
              columnCount: pendingResult.data?.columns?.length || 0,
              columns: pendingResult.data?.columns || [],
              pagination: pendingResult.pagination
            } : null
          };
        } else if (mode === 'Read Image/PDF' && attachedFiles.length > 0) {
          toolCallsData = {
            attachments: attachedFiles.map(f => ({
              fileName: f.file.name,
              fileType: f.type,
              fileSize: f.file.size
            }))
          };
        }
        
        // Build complete derived_json with all metadata
        const derivedData: any = {
          mode: mode,
          responseLength: aiResponseContent.length,
          timestamp: new Date().toISOString()
        };
        
        if (mode === 'SQL Assistant') {
          derivedData.division = selectedDivision;
          derivedData.subdivisionKey = selectedSubdivisionKey;
          derivedData.sqlGenerated = !!sqlResponse;
          derivedData.sqlExecuted = !!pendingResult;
          
          if (pendingResult) {
            derivedData.queryResults = {
              rowsReturned: pendingResult.data?.rows?.length || 0,
              columnsReturned: pendingResult.data?.columns?.length || 0,
              totalItems: pendingResult.pagination?.totalItems || 0,
              currentPage: pendingResult.pagination?.currentPage || 1,
              pageSize: pendingResult.pagination?.pageSize || 10
            };
          }
        } else if (mode === 'Read Image/PDF') {
          derivedData.filesProcessed = attachedFiles.length;
          if (attachedFiles.length > 0) {
            derivedData.fileDetails = attachedFiles.map(f => ({
              name: f.file.name,
              type: f.type,
              size: f.file.size
            }));
          }
        }
        
        const assistantMessageLog: AIMessageLog = {
          conversationId: conversationId,
          turnIndex: turnIndex,
          role: 'assistant',
          content: aiResponseContent,
          createdUtc: new Date().toISOString(),
          model: apiModel,
          temperature: messageTemperature,
          latencyMs: lastResponse.latency || (window as any).__sqlLatency,
          tokensPrompt: lastResponse.response?.usage?.prompt_tokens || sqlResponse?.usage?.prompt_tokens,
          tokensCompletion: lastResponse.response?.usage?.completion_tokens || sqlResponse?.usage?.completion_tokens,
          tokensTotal: lastResponse.response?.usage?.total_tokens || sqlResponse?.usage?.total_tokens,
          taskType: mode,
          // appUserHash will be set by backend from authenticated user
          orgId: mode === 'SQL Assistant' ? (selectedDivision || undefined) : undefined,
          responseOk: true,
          derivedJson: JSON.stringify(derivedData),
          toolCallsJson: toolCallsData ? JSON.stringify(toolCallsData) : undefined
        };
        // Save message log silently (non-blocking background operation)
        AIAssistantService.saveMessageLog(assistantMessageLog).catch(err => {
          // Silently handle errors - message logging is non-critical
          // 401 errors are handled by the API interceptor (token refresh/redirect)
          if (err?.status !== 401) {
            console.warn('Failed to save assistant message log:', err);
          }
        });
        // Clear stored response data
        delete (window as any).__lastChatResponse;
        delete (window as any).__lastSQLResponse;
        delete (window as any).__sqlLatency;
        delete (window as any).__sqlTemperature;
      } catch (logError) {
        console.error('Error preparing assistant message log:', logError);
      }
      
      setQuestion('');
      setAttachedFiles([]); // Clear attached files after sending
      setLoading(false);
    } catch (error: any) {
      console.error('Error getting AI response:', error);
      const errorMessage = error?.message || 'Failed to get AI response. Please try again.';
      setError(errorMessage);
      
      // Save error to database
      try {
        // Prepare derived_json for error message
        const errorDerivedData: any = {
          mode: mode,
          errorSource: error?.response?.config?.url || 'unknown',
          errorStatus: error?.response?.status || null
        };
        if (mode === 'SQL Assistant' && selectedDivision) {
          errorDerivedData.division = selectedDivision;
        }
        
        const errorMessageLog: AIMessageLog = {
          conversationId: conversationId,
          turnIndex: turnIndex,
          role: 'assistant',
          content: errorMessage,
          createdUtc: new Date().toISOString(),
          model: apiModel,
          taskType: mode,
          // appUserHash will be set by backend from authenticated user
          orgId: mode === 'SQL Assistant' ? (selectedDivision || undefined) : undefined,
          responseOk: false,
          errorType: error?.response?.status ? `HTTP_${error.response.status}` : error?.name || 'UnknownError',
          derivedJson: JSON.stringify(errorDerivedData)
        };
        // Save message log silently (non-blocking background operation)
        AIAssistantService.saveMessageLog(errorMessageLog).catch(err => {
          // Silently handle errors - message logging is non-critical
          // 401 errors are handled by the API interceptor (token refresh/redirect)
          if (err?.status !== 401) {
            console.warn('Failed to save error message log:', err);
          }
        });
      } catch (logError) {
        console.error('Error preparing error message log:', logError);
      }
      
      setLoading(false);
    }
  };

  // Handle clear (like VB.NET btnClearConversation_Click)
  const handleClear = () => {
    if (confirm('Do you want to clear the conversation history, schema memory and chat bubbles?')) {
    setConversation([]);
    setSqlResults(null);
    setQuestion('');
    setError(null);
    setSuccessMessage(null);
      setAttachedFiles([]);
      setMessageResults(new Map());
      setMessagePagination(new Map());
      
      // Clear persistent SQL messages and schema context (like VB.NET clears sqlMessages)
      setSqlMessages(null);
      setCurrentDivisionForSQL(null);
      setSelectedDivision('');
      setSelectedSubdivisionKey('');
      
      // Reset conversation tracking for new conversation
      setConversationId(generateGuid());
      setTurnIndex(0);
      
      // Notify user (like VB.NET adds "Cleared" message)
      setSuccessMessage('Cleared conversation & schema memory. Please select a Division again.');
      setTimeout(() => setSuccessMessage(null), 5000);
    }
  };


  // Handle pagination change for SQL results (per message)
  const handleMessagePageChange = async (assistantMessageIndex: number, newPage: number) => {
    if (loading) return;
    
    setLoading(true);
    
    try {
      // The assistant message index is the same as the one we're paginating
      // The SQL query is in this assistant message
      const assistantMessage = conversation[assistantMessageIndex];
      if (!assistantMessage || assistantMessage.role !== 'assistant') {
        setLoading(false);
        return;
      }
      
      const sqlQuery = assistantMessage.content.trim();
      const msgPagination = messagePagination.get(assistantMessageIndex);
      
      const executionResponse = await AIAssistantService.executeSafeQuery(sqlQuery, {
        page: newPage,
        limit: msgPagination?.pageSize || pageSize,
        sortBy: msgPagination?.sortBy || undefined,
        sortOrder: msgPagination?.sortOrder || 'asc'
      });
      
      if (executionResponse.success && executionResponse.data) {
        // Update results for this assistant message
        setMessageResults(prev => {
          const newMap = new Map(prev);
          newMap.set(assistantMessageIndex, executionResponse.data);
          return newMap;
        });
        
        // Update pagination for this message
        // Preserve previous totalItems if backend doesn't provide it (use current page rows length as fallback only if no previous total)
        const previousTotal = msgPagination?.totalItems || 0;
        const paginationInfo = 'pagination' in executionResponse && executionResponse.pagination
          ? {
              totalItems: executionResponse.pagination.total || previousTotal || executionResponse.data.rows?.length || 0,
              totalPages: executionResponse.pagination.totalPages || 1,
              currentPage: executionResponse.pagination.page || 1,
              pageSize: executionResponse.pagination.limit || (msgPagination?.pageSize || pageSize),
              sortBy: msgPagination?.sortBy || '',
              sortOrder: msgPagination?.sortOrder || 'asc'
            }
          : {
              totalItems: previousTotal || executionResponse.data.rows?.length || 0,
              totalPages: Math.ceil((previousTotal || executionResponse.data.rows?.length || 0) / (msgPagination?.pageSize || pageSize)),
              currentPage: 1,
              pageSize: msgPagination?.pageSize || pageSize,
              sortBy: msgPagination?.sortBy || '',
              sortOrder: msgPagination?.sortOrder || 'asc'
            };
        
        setMessagePagination(prev => {
          const newMap = new Map(prev);
          newMap.set(assistantMessageIndex, paginationInfo);
          return newMap;
        });
      }
    } catch (error: any) {
      console.error('Error changing page:', error);
      setError('Failed to load page');
    } finally {
      setLoading(false);
    }
  };

  // Handle sort change for SQL results (per message)
  const handleMessageSortChange = async (assistantMessageIndex: number, column: string, newSortOrder: 'asc' | 'desc') => {
    if (loading) return;
    
    setLoading(true);
    
    try {
      // The assistant message index is the same as the one we're sorting
      // The SQL query is in this assistant message
      const assistantMessage = conversation[assistantMessageIndex];
      if (!assistantMessage || assistantMessage.role !== 'assistant') {
        setLoading(false);
        return;
      }
      
      const sqlQuery = assistantMessage.content.trim();
      const msgPagination = messagePagination.get(assistantMessageIndex);
      
      const executionResponse = await AIAssistantService.executeSafeQuery(sqlQuery, {
        page: 1,
        limit: msgPagination?.pageSize || pageSize,
        sortBy: column,
        sortOrder: newSortOrder
      });
      
      if (executionResponse.success && executionResponse.data) {
        // Update results for this assistant message
        setMessageResults(prev => {
          const newMap = new Map(prev);
          newMap.set(assistantMessageIndex, executionResponse.data);
          return newMap;
        });
        
        // Update pagination for this message
        // Preserve previous totalItems if backend doesn't provide it
        const previousTotal = msgPagination?.totalItems || 0;
        const paginationInfo = 'pagination' in executionResponse && executionResponse.pagination
          ? {
              totalItems: executionResponse.pagination.total || previousTotal || executionResponse.data.rows?.length || 0,
              totalPages: executionResponse.pagination.totalPages || 1,
              currentPage: 1,
              pageSize: executionResponse.pagination.limit || (msgPagination?.pageSize || pageSize),
              sortBy: column,
              sortOrder: newSortOrder
            }
          : {
              totalItems: previousTotal || executionResponse.data.rows?.length || 0,
              totalPages: Math.ceil((previousTotal || executionResponse.data.rows?.length || 0) / (msgPagination?.pageSize || pageSize)),
              currentPage: 1,
              pageSize: msgPagination?.pageSize || pageSize,
              sortBy: column,
              sortOrder: newSortOrder
            };
        
        setMessagePagination(prev => {
          const newMap = new Map(prev);
          newMap.set(assistantMessageIndex, paginationInfo);
          return newMap;
        });
      }
    } catch (error: any) {
      console.error('Error sorting:', error);
      setError('Failed to sort results');
    } finally {
      setLoading(false);
    }
  };

  // Handle page size change for SQL results (per message)
  const handleMessagePageSizeChange = async (assistantMessageIndex: number, newPageSize: number) => {
    if (loading) return;
    
    setLoading(true);
    
    try {
      // The assistant message index is the same as the one we're paginating
      // The SQL query is in this assistant message
      const assistantMessage = conversation[assistantMessageIndex];
      if (!assistantMessage || assistantMessage.role !== 'assistant') {
        setLoading(false);
        return;
      }
      
      const sqlQuery = assistantMessage.content.trim();
      const msgPagination = messagePagination.get(assistantMessageIndex);
      
      // Execute query with new page size, starting from page 1
      const executionResponse = await AIAssistantService.executeSafeQuery(sqlQuery, {
        page: 1, // Always reset to page 1 when changing page size
        limit: newPageSize,
        sortBy: msgPagination?.sortBy || undefined,
        sortOrder: msgPagination?.sortOrder || 'asc'
      });
      
      if (executionResponse.success && executionResponse.data) {
        // Update results for this assistant message
        setMessageResults(prev => {
          const newMap = new Map(prev);
          newMap.set(assistantMessageIndex, executionResponse.data);
          return newMap;
        });
        
        // Update pagination for this message with new page size
        // Preserve previous totalItems if backend doesn't provide it
        const previousTotal = msgPagination?.totalItems || 0;
        const paginationInfo = 'pagination' in executionResponse && executionResponse.pagination
          ? {
              totalItems: executionResponse.pagination.total || previousTotal || executionResponse.data.rows?.length || 0,
              totalPages: executionResponse.pagination.totalPages || 1,
              currentPage: 1, // Reset to page 1
              pageSize: executionResponse.pagination.limit || newPageSize,
              sortBy: msgPagination?.sortBy || '',
              sortOrder: msgPagination?.sortOrder || 'asc'
            }
          : {
              totalItems: previousTotal || executionResponse.data.rows?.length || 0,
              totalPages: Math.ceil((previousTotal || executionResponse.data.rows?.length || 0) / newPageSize),
              currentPage: 1,
              pageSize: newPageSize,
              sortBy: msgPagination?.sortBy || '',
              sortOrder: msgPagination?.sortOrder || 'asc'
            };
        
        setMessagePagination(prev => {
          const newMap = new Map(prev);
          newMap.set(assistantMessageIndex, paginationInfo);
          return newMap;
        });
      }
    } catch (error: any) {
      console.error('Error changing page size:', error);
      setError('Failed to change page size');
    } finally {
      setLoading(false);
    }
  };

  // Handle pagination change for SQL results (global - for backward compatibility)
  const handlePageChange = async (newPage: number) => {
    if (!sqlResults || loading) return;
    
    setCurrentPage(newPage);
    setLoading(true);
    
    try {
      // Get the last SQL query from conversation
      const lastSQLMessage = conversation.filter(msg => msg.role === 'assistant').pop();
      if (!lastSQLMessage) return;
      
      const executionResponse = await AIAssistantService.executeSafeQuery(lastSQLMessage.content, {
        page: newPage,
        limit: pageSize,
        sortBy: sortBy || undefined,
        sortOrder: sortOrder
      });
      
      if (executionResponse.success && executionResponse.data) {
        setSqlResults(executionResponse.data);
        if ('pagination' in executionResponse && executionResponse.pagination) {
          setTotalItems(executionResponse.pagination.total || 0);
          setTotalPages(executionResponse.pagination.totalPages || 1);
        }
        setShowResultsModal(true);
      }
    } catch (error: any) {
      console.error('Error changing page:', error);
      setError('Failed to load page');
    } finally {
      setLoading(false);
    }
  };

  // Handle sort change for SQL results
  const handleSortChange = async (column: string) => {
    if (!sqlResults || loading) return;
    
    const newSortOrder = sortBy === column && sortOrder === 'asc' ? 'desc' : 'asc';
    setSortBy(column);
    setSortOrder(newSortOrder);
    setCurrentPage(1); // Reset to first page when sorting
    
    setLoading(true);
    
    try {
      // Get the last SQL query from conversation
      const lastSQLMessage = conversation.filter(msg => msg.role === 'assistant').pop();
      if (!lastSQLMessage) return;
      
      const executionResponse = await AIAssistantService.executeSafeQuery(lastSQLMessage.content, {
        page: 1,
        limit: pageSize,
        sortBy: column,
        sortOrder: newSortOrder
      });
      
      if (executionResponse.success && executionResponse.data) {
        setSqlResults(executionResponse.data);
        if ('pagination' in executionResponse && executionResponse.pagination) {
          setTotalItems(executionResponse.pagination.total || 0);
          setTotalPages(executionResponse.pagination.totalPages || 1);
        }
        setShowResultsModal(true);
      }
    } catch (error: any) {
      console.error('Error sorting:', error);
      setError('Failed to sort results');
    } finally {
      setLoading(false);
    }
  };

  // Handle key press in input
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAskQuestion();
    }
  };

  // Export current page to CSV
  const exportCurrentPageToCSV = (columns: string[], rows: Record<string, any>[], filename: string = 'export.csv') => {
    // Create CSV header
    const csvHeader = columns.join(',');
    
    // Create CSV rows
    const csvRows = rows.map(row => 
      columns.map(col => {
        const value = row[col];
        // Escape quotes and wrap in quotes if contains comma, newline, or quote
        const stringValue = value === null || value === undefined ? '' : String(value);
        if (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      }).join(',')
    );
    
    // Combine header and rows
    const csvContent = [csvHeader, ...csvRows].join('\n');
    
    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setSuccessMessage(`Exported ${rows.length} rows from current page`);
    setTimeout(() => setSuccessMessage(null), 2000);
  };

  // Export full table data to CSV (fetches all data from server)
  const exportAllDataToCSV = async (sqlQuery: string, filename: string = 'export.csv') => {
    try {
      setLoading(true);
      
      // Fetch all data without pagination (high limit)
      const fullDataResponse = await AIAssistantService.executeSafeQuery(sqlQuery, {
        page: 1,
        limit: 999999, // Very high limit to get all data
        sortBy: undefined,
        sortOrder: 'asc'
      });
      
      if (!fullDataResponse.success || !fullDataResponse.data) {
        setError('Failed to fetch full data for export');
        return;
      }
      
      const { columns, rows } = fullDataResponse.data;
      
      // Create CSV header
      const csvHeader = columns.join(',');
      
      // Create CSV rows
      const csvRows = rows.map(row => 
        columns.map(col => {
          const value = row[col];
          // Escape quotes and wrap in quotes if contains comma, newline, or quote
          const stringValue = value === null || value === undefined ? '' : String(value);
          if (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')) {
            return `"${stringValue.replace(/"/g, '""')}"`;
          }
          return stringValue;
        }).join(',')
      );
      
      // Combine header and rows
      const csvContent = [csvHeader, ...csvRows].join('\n');
      
      // Create blob and download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setSuccessMessage(`Exported all ${rows.length} rows to ${filename}`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('Failed to export:', err);
      setError('Failed to export data');
      setTimeout(() => setError(null), 2000);
    } finally {
      setLoading(false);
    }
  };

  // Copy current page data to clipboard
  const copyCurrentPageToClipboard = async (columns: string[], rows: Record<string, any>[]) => {
    // Create tab-separated text (works well for Excel paste)
    const header = columns.join('\t');
    const rowsText = rows.map(row => 
      columns.map(col => row[col] ?? '').join('\t')
    ).join('\n');
    
    const textToCopy = `${header}\n${rowsText}`;
    
    try {
      await navigator.clipboard.writeText(textToCopy);
      setSuccessMessage(`Copied ${rows.length} rows from current page to clipboard!`);
      setTimeout(() => setSuccessMessage(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      setError('Failed to copy to clipboard');
      setTimeout(() => setError(null), 2000);
    }
  };

  // Copy all data to clipboard (fetches full data from server)
  const copyAllDataToClipboard = async (sqlQuery: string) => {
    try {
      setLoading(true);
      
      // Fetch all data without pagination
      const fullDataResponse = await AIAssistantService.executeSafeQuery(sqlQuery, {
        page: 1,
        limit: 999999,
        sortBy: undefined,
        sortOrder: 'asc'
      });
      
      if (!fullDataResponse.success || !fullDataResponse.data) {
        setError('Failed to fetch full data');
        return;
      }
      
      const { columns, rows } = fullDataResponse.data;
      
      // Create tab-separated text (works well for Excel paste)
      const header = columns.join('\t');
      const rowsText = rows.map(row => 
        columns.map(col => row[col] ?? '').join('\t')
      ).join('\n');
      
      const textToCopy = `${header}\n${rowsText}`;
      
      await navigator.clipboard.writeText(textToCopy);
      setSuccessMessage(`Copied all ${rows.length} rows to clipboard!`);
      setTimeout(() => setSuccessMessage(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      setError('Failed to copy to clipboard');
      setTimeout(() => setError(null), 2000);
    } finally {
      setLoading(false);
    }
  };

  if (initializing) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
          <div className="relative">
            <div className="absolute inset-0 bg-blue-500/20 dark:bg-blue-400/20 rounded-full blur-xl animate-pulse"></div>
            <Loader2 className="w-12 h-12 animate-spin text-blue-600 dark:text-blue-400 relative z-10" />
          </div>
          <span className="mt-4 text-gray-700 dark:text-gray-300 font-medium">Loading AI Assistant...</span>
        </div>
      </Layout>
    );
  }

  // Filter subdivisions based on search
  const filteredSubdivisions = subdivisionOptions.filter(option =>
    option.label.toLowerCase().includes(subdivisionSearch.toLowerCase())
  );

  return (
    <Layout>
      <div className="flex flex-col h-[calc(100vh-8rem)] max-w-6xl mx-auto bg-gradient-to-b from-white via-white to-gray-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 shadow-xl rounded-t-2xl overflow-hidden">

          {/* Status Messages */}
          {successMessage && (
          <div className="mx-4 mt-4 bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/30 dark:to-amber-900/30 border-l-4 border-yellow-400 dark:border-yellow-500 rounded-r-lg p-4 flex items-center shadow-md animate-in slide-in-from-top-2 duration-300">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-yellow-400/20 dark:bg-yellow-500/20 flex items-center justify-center mr-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
            </div>
            <span className="text-yellow-800 dark:text-yellow-200 text-sm font-medium">{successMessage}</span>
            </div>
          )}

          {error && (
          <div className="mx-4 mt-4 bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-900/30 dark:to-rose-900/30 border-l-4 border-red-400 dark:border-red-500 rounded-r-lg p-4 flex items-center shadow-md animate-in slide-in-from-top-2 duration-300">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-red-400/20 dark:bg-red-500/20 flex items-center justify-center mr-3">
              <X className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
              <span className="text-red-800 dark:text-red-200 text-sm font-medium">{error}</span>
            </div>
          )}

        {/* Controls Bar - Top */}
        <div className="p-2 border-b bg-gradient-to-r from-gray-50 via-white to-gray-50 dark:from-gray-800 dark:via-gray-800 dark:to-gray-800 border-gray-200 dark:border-gray-700 flex items-center gap-4 flex-wrap shadow-sm">
          {/* Mode Selection */}
          <div className="flex items-center gap-3">
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Mode:</label>
            <div className="flex gap-2 bg-white dark:bg-gray-700/50 p-1 rounded-lg border border-gray-200 dark:border-gray-600 shadow-inner">
              {(['General', 'Read Image/PDF', 'SQL Assistant'] as AIMode[]).map((m) => (
                <label
                  key={m}
                  className={`relative flex items-center cursor-pointer text-sm px-4 py-1.5 rounded-md transition-all duration-200 ${
                    mode === m
                      ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md scale-105'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
                  }`}
                >
                  <input
                    type="radio"
                    name="mode"
                    value={m}
                    checked={mode === m}
                    onChange={() => setMode(m)}
                    className="sr-only"
                  />
                  <span className="font-medium">{m === 'SQL Assistant' ? 'ERP Assistant' : m}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Subdivision Selection with Search (shows subdivision name but stores division value) */}
          {mode === 'SQL Assistant' && (
            <div className="flex items-center gap-3">
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Division:</label>
              {subdivisionOptions.length === 0 ? (
                <div className="text-sm text-red-600 dark:text-red-400 bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-900/30 dark:to-rose-900/30 px-4 py-2 rounded-lg border border-red-200 dark:border-red-800 shadow-sm">
            <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Loading subdivisions...</span>
                  </div>
                </div>
              ) : (
                <div className="relative">
              <Select
                    value={selectedSubdivisionKey || ''}
                    onValueChange={(uniqueKey) => {
                      const selectedOption = subdivisionOptions.find(opt => opt.uniqueKey === uniqueKey);
                      if (selectedOption) {
                        setSelectedDivision(selectedOption.value); // Store division value
                        setSelectedSubdivisionKey(selectedOption.uniqueKey); // Store for display
                        setSubdivisionSearch(''); // Clear search on selection
                      }
                }}
              >
                    <SelectTrigger className="w-56 h-9 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-blue-500 focus:ring-offset-0 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none transition-colors">
                      <SelectValue placeholder="Select Subdivision">
                        {selectedSubdivisionKey 
                          ? subdivisionOptions.find(opt => opt.uniqueKey === selectedSubdivisionKey)?.label
                          : 'Select Subdivision'}
                      </SelectValue>
                </SelectTrigger>
                    <SelectContent position="popper" className="z-50 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 shadow-lg max-h-[300px]">
                      {/* Search Input */}
                      <div className="p-2 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800">
                        <div className="relative">
                          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
                          <input
                            type="text"
                            placeholder="Search subdivisions..."
                            value={subdivisionSearch}
                            onChange={(e) => setSubdivisionSearch(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                            className="w-full pl-8 pr-8 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                            autoFocus
                          />
                          {subdivisionSearch && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSubdivisionSearch('');
                              }}
                              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                      
                      {/* Filtered Options */}
                      <div className="max-h-[250px] overflow-y-auto">
                        {filteredSubdivisions.length > 0 ? (
                          filteredSubdivisions.map((option) => (
                      <SelectItem
                              key={option.uniqueKey}
                              value={option.uniqueKey}
                              className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 focus:bg-gray-100 dark:focus:bg-gray-700"
                      >
                              {option.label}
                      </SelectItem>
                          ))
                        ) : (
                          <div className="px-2 py-3 text-sm text-gray-500 dark:text-gray-400 text-center">
                            No matching subdivisions found
                          </div>
                        )}
                      </div>
                  </SelectContent>
                </Select>
                </div>
              )}
            </div>
          )}

          <div className="ml-auto">
            <button
              onClick={handleClear}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg border border-red-200 dark:border-red-800 shadow-sm hover:shadow-md transition-all duration-200 hover:scale-105"
            >
              <Trash2 className="w-4 h-4" />
              Clear
            </button>
          </div>
        </div>

        {/* Conversation Area - ChatGPT Style */}
        <div className="flex-1 overflow-y-auto bg-gradient-to-b from-white via-gray-50/50 to-white dark:from-gray-900 dark:via-gray-900 dark:to-gray-900">
            {conversation.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center max-w-md px-6">
                <div className="relative mb-6">
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full blur-2xl opacity-20 animate-pulse"></div>
                  <Bot className="w-20 h-20 text-blue-500 dark:text-blue-400 mx-auto relative z-10" />
                </div>
                <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  How can I help you today?
                </h3>
                {/* <p className="text-gray-500 dark:text-gray-400 text-sm">Ask me anything, upload a file, or generate SQL queries</p>
                <div className="mt-6 flex flex-wrap gap-2 justify-center">
                  <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-xs font-medium">General Assistant</span>
                  <span className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full text-xs font-medium">Image/PDF Reader</span>
                  <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full text-xs font-medium">SQL Generator</span>
                </div> */}
              </div>
              </div>
            ) : (
            <div className="pb-4">
                {conversation.map((message, index) => {
                  // Check if this is a schema loaded message (system notification)
                  const isSchemaMessage = message.role === 'assistant' && 
                    message.content.includes('Schema loaded for division');
                  
                  return (
                  <div key={index} className="w-full">
                    {/* Message Row */}
                    <div
                  className={`flex gap-2 px-4 py-2 transition-all duration-200 hover:bg-opacity-80 ${
                      message.role === 'user'
                      ? 'bg-gradient-to-r from-gray-50 to-gray-100/50 dark:from-gray-800/50 dark:to-gray-800/30' 
                      : isSchemaMessage
                        ? 'bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 border-l-4 border-yellow-400 dark:border-yellow-500'
                        : 'bg-white dark:bg-gray-900'
                  }`}
                >
                  {/* Avatar */}
                  <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center shadow-lg ${
                    message.role === 'user'
                      ? 'bg-gradient-to-br from-gray-700 to-gray-900 dark:from-gray-600 dark:to-gray-800'
                      : isSchemaMessage
                        ? 'bg-gradient-to-br from-yellow-400 to-amber-500 dark:from-yellow-500 dark:to-yellow-600'
                        : 'bg-gradient-to-br from-blue-500 to-green-500 dark:from-blue-600 dark:to-green-600'
                  }`}>
                    {message.role === 'user' ? (
                      <UserIcon className="w-5 h-5 text-white" />
                    ) : (
                      <Bot className="w-5 h-5 text-white" />
                    )}
                  </div>
                  
                  {/* Message Content */}
                  <div className="flex-1 max-w-6xl pt-1">
                    <div className="font-semibold text-sm mb-2 flex items-center gap-2">
                      <span className={message.role === 'user' ? 'text-gray-700 dark:text-gray-300' : 'text-blue-600 dark:text-blue-400'}>
                      {message.role === 'user' ? 'You' : 'AI Assistant'}
                      </span>
                      {message.timestamp && (
                        <span className="text-xs font-normal text-gray-400 dark:text-gray-500">
                          {new Date(message.timestamp).toLocaleTimeString()}
                        </span>
                      )}
                    </div>
                    <div className="relative flex items-start gap-2">
                      <div className={`flex-1 whitespace-pre-wrap leading-relaxed prose prose-sm max-w-none dark:prose-invert rounded-lg p-2 ${
                        isSchemaMessage 
                          ? 'bg-yellow-100/50 dark:bg-yellow-900/20 text-yellow-900 dark:text-yellow-100 border border-yellow-200 dark:border-yellow-800'
                          : message.role === 'user'
                            ? 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700'
                            : 'text-gray-800 dark:text-gray-200'
                      }`}>
                      {message.content}
                    </div>
                    </div>
                  </div>
                </div>
                  
                  {/* Show SQL Results Table below assistant message (for SQL Assistant mode) */}
                  {(() => {
                    if (message.role !== 'assistant' || isSchemaMessage || mode !== 'SQL Assistant') return null;
                    
                    // Results are stored using the assistant message index
                    // Check if results exist for this message (regardless of whether content looks like SQL)
                    const resultData = messageResults.get(index);
                    
                    if (!resultData) {
                      return null;
                    }
                    
                    if (!resultData.columns || !resultData.rows || resultData.columns.length === 0) {
                      return null;
                    }
                    
                    // Helper function to format cell values with pill styling
                    const formatCellValue = (_column: string, value: any, colIndex: number): JSX.Element => {
                      if (value === null || value === undefined || value === '') {
                        return <span className="text-gray-400 dark:text-gray-500">-</span>;
                      }
                      
                      const valueStr = String(value);
                      
                      // Use different pill colors based on column index for visual variety
                      // This creates a pattern similar to the image without predicting column names
                      const pillColors = [
                        { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' }, // Plain text columns
                        { bg: 'bg-green-50', text: 'text-gray-700', border: 'border-green-200' },
                        { bg: 'bg-blue-50', text: 'text-gray-700', border: 'border-blue-200' },
                        { bg: 'bg-purple-50', text: 'text-gray-700', border: 'border-purple-200' },
                        { bg: 'bg-yellow-50', text: 'text-gray-700', border: 'border-yellow-200' },
                        { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' },
                        { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' },
                      ];
                      
                      const colorScheme = pillColors[colIndex % pillColors.length];
                      
                      // For dark mode
                      const darkBg = colorScheme.bg.includes('gray') ? 'dark:bg-gray-800' : 
                                    colorScheme.bg.includes('green') ? 'dark:bg-green-900/20' :
                                    colorScheme.bg.includes('blue') ? 'dark:bg-blue-900/20' :
                                    colorScheme.bg.includes('purple') ? 'dark:bg-purple-900/20' :
                                    'dark:bg-yellow-900/20';
                      const darkText = 'dark:text-gray-300';
                      const darkBorder = colorScheme.border.includes('gray') ? 'dark:border-gray-700' : 
                                       colorScheme.border.includes('green') ? 'dark:border-green-700' :
                                       colorScheme.border.includes('blue') ? 'dark:border-blue-700' :
                                       colorScheme.border.includes('purple') ? 'dark:border-purple-700' :
                                       'dark:border-yellow-700';
                      
                      return (
                        <span className={`inline-flex items-center px-2 py-1.5 rounded-full ${colorScheme.bg} ${darkBg} ${colorScheme.text} ${darkText} border ${colorScheme.border} ${darkBorder} text-xs font-medium`}>
                          {valueStr}
                        </span>
                      );
                    };
                    
                    return (
                    <div className="w-full px-4 py-2">
                      <div className="ml-14 max-w-6xl">
                        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden shadow-sm">
                          {/* Table Actions */}
                          <div className="flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                              {resultData.rows.length} row{resultData.rows.length !== 1 ? 's' : ''}
                            </span>
                            <div className="flex items-center gap-2">
                              {(() => {
                                const msgPagination = messagePagination.get(index);
                                const hasMultiplePages = msgPagination && msgPagination.totalPages > 1;
                                
                                return (
                                  <>
                                    {/* Copy Buttons */}
                                    <button
                                      onClick={() => copyCurrentPageToClipboard(resultData.columns, resultData.rows)}
                                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600 rounded-md transition-colors duration-150 shadow-sm hover:shadow"
                                      title="Copy current page to clipboard"
                                    >
                                      <Copy className="w-3.5 h-3.5" />
                                      {hasMultiplePages ? 'Copy Page' : 'Copy'}
                                    </button>
                                    {hasMultiplePages && (
                                      <button
                                        onClick={() => {
                                          const sqlQuery = isAJIMUser ? message.content : conversation[index - 1]?.content || message.content;
                                          copyAllDataToClipboard(sqlQuery);
                                        }}
                                        disabled={loading}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 border border-blue-300 dark:border-blue-700 rounded-md transition-colors duration-150 shadow-sm hover:shadow disabled:opacity-50 disabled:cursor-not-allowed"
                                        title="Copy all data to clipboard"
                                      >
                                        <Copy className="w-3.5 h-3.5" />
                                        Copy All
                                      </button>
                                    )}
                                    
                                    {/* Export Buttons */}
                                    <button
                                      onClick={() => exportCurrentPageToCSV(resultData.columns, resultData.rows, `query_page_${Date.now()}.csv`)}
                                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600 rounded-md transition-colors duration-150 shadow-sm hover:shadow"
                                      title="Export current page to CSV"
                                    >
                                      <Download className="w-3.5 h-3.5" />
                                      {hasMultiplePages ? 'Export Page' : 'Export CSV'}
                                    </button>
                                    {hasMultiplePages && (
                                      <button
                                        onClick={() => {
                                          const sqlQuery = isAJIMUser ? message.content : conversation[index - 1]?.content || message.content;
                                          exportAllDataToCSV(sqlQuery, `query_full_${Date.now()}.csv`);
                                        }}
                                        disabled={loading}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 dark:from-green-500 dark:to-green-600 dark:hover:from-green-600 dark:hover:to-green-700 rounded-md transition-all duration-150 shadow-sm hover:shadow disabled:opacity-50 disabled:cursor-not-allowed"
                                        title="Export all data to CSV"
                                      >
                                        <Download className="w-3.5 h-3.5" />
                                        Export All
                                      </button>
                                    )}
                                  </>
                                );
                              })()}
                            </div>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 select-text">
                              <thead className="bg-white dark:bg-gray-800">
                                <tr>
                                  {resultData.columns.map((column, colIdx) => {
                                    const msgPagination = messagePagination.get(index);
                                    const isSorted = msgPagination?.sortBy === column;
                                    return (
                                      <th
                                        key={colIdx}
                                        onClick={() => {
                                          if (!loading) {
                                            const msgPagination = messagePagination.get(index);
                                            const newSortOrder = isSorted && msgPagination?.sortOrder === 'asc' ? 'desc' : 'asc';
                                            handleMessageSortChange(index, column, newSortOrder);
                                          }
                                        }}
                                        className="px-3 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-150"
                                      >
                                        <div className="flex items-center gap-2">
                                          <span>{column}</span>
                                          {isSorted && (
                                            <span className="text-blue-600 dark:text-blue-400">
                                              {msgPagination?.sortOrder === 'asc' ? '▲' : '▼'}
                                            </span>
                                          )}
                                        </div>
                                      </th>
                                    );
                                  })}
                                </tr>
                              </thead>
                              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
                                {resultData.rows.length === 0 ? (
                                  <tr>
                                    <td colSpan={resultData.columns.length} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                                      No data available
                                    </td>
                                  </tr>
                                ) : (
                                  resultData.rows.map((row, rowIdx) => (
                                    <tr
                                      key={rowIdx}
                                      className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-150"
                                    >
                                      {resultData.columns.map((column, colIdx) => (
                                        <td
                                          key={colIdx}
                                          className="px-2 py-2 whitespace-nowrap text-sm select-text cursor-text"
                                        >
                                          {formatCellValue(column, row[column], colIdx)}
                                        </td>
                                      ))}
                                    </tr>
                                  ))
                                )}
                              </tbody>
                            </table>
                          </div>
                          
                          {/* Pagination Controls for this message */}
                          {(() => {
                            const msgPagination = messagePagination.get(index);
                            
                            // Always show pagination if we have result data, even if no pagination info yet
                            if (!msgPagination && !resultData) return null;
                            
                            // If no pagination info but we have results, create default pagination
                            const pagination = msgPagination || {
                              currentPage: 1,
                              pageSize: 10,
                              totalItems: resultData?.rows?.length || 0,
                              totalPages: 1,
                              sortBy: '',
                              sortOrder: 'asc' as const
                            };
                            
                            const startItem = (pagination.currentPage - 1) * pagination.pageSize + 1;
                            const endItem = Math.min(pagination.currentPage * pagination.pageSize, pagination.totalItems);
                            
                            // Generate page numbers to show (max 5 pages)
                            const maxPagesToShow = 5;
                            let startPage = Math.max(1, pagination.currentPage - Math.floor(maxPagesToShow / 2));
                            let endPage = Math.min(pagination.totalPages, startPage + maxPagesToShow - 1);
                            if (endPage - startPage < maxPagesToShow - 1) {
                              startPage = Math.max(1, endPage - maxPagesToShow + 1);
                            }
                            const pageNumbers = [];
                            for (let i = startPage; i <= endPage; i++) {
                              pageNumbers.push(i);
                            }
                            return (
                              <div className="bg-gray-50 dark:bg-gray-700 px-3 py-3 border-t border-gray-200 dark:border-gray-600">
                                <div className="flex items-center justify-between flex-wrap gap-3">
                                  {/* Left side: Showing X to Y of Z results */}
                                  <div className="flex items-center gap-4">
                                    <span className="text-sm text-gray-700 dark:text-gray-300">
                                      Showing <span className="font-medium">{startItem}</span> to <span className="font-medium">{endItem}</span> of <span className="font-medium">{pagination.totalItems.toLocaleString()}</span> results
                                    </span>
                                    <select
                                      value={pagination.pageSize || 10}
                                      onChange={(e) => {
                                        const newSize = Number(e.target.value);
                                        handleMessagePageSizeChange(index, newSize);
                                      }}
                                      disabled={loading}
                                      className="px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 focus:ring-offset-0 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none transition-colors cursor-pointer"
                                    >
                                      {[5, 10, 25, 50].map((size) => (
                                        <option key={size} value={size}>
                                          {size} per page
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  
                                  {/* Right side: Pagination buttons - Always show, but disable when appropriate */}
                                  <div className="flex items-center gap-1">
                                    <button
                                      disabled={pagination.currentPage === 1 || loading || pagination.totalPages <= 1}
                                      onClick={() => handleMessagePageChange(index, 1)}
                                      className="px-2 py-1.5 text-sm font-medium border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white dark:disabled:hover:bg-gray-700 transition-colors"
                                    >
                                      First
                                    </button>
                                    <button
                                      disabled={pagination.currentPage === 1 || loading || pagination.totalPages <= 1}
                                      onClick={() => handleMessagePageChange(index, pagination.currentPage - 1)}
                                      className="px-2 py-1.5 text-sm font-medium border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white dark:disabled:hover:bg-gray-700 transition-colors"
                                    >
                                      Previous
                                    </button>
                                    
                                    {/* Page numbers - Always show at least page 1 */}
                                    {pagination.totalPages > 0 ? (
                                      pageNumbers.map((pageNum) => (
                                        <button
                                          key={pageNum}
                                          disabled={loading}
                                          onClick={() => handleMessagePageChange(index, pageNum)}
                                          className={`px-2 py-1.5 text-sm font-medium border rounded-md transition-colors ${
                                            pageNum === pagination.currentPage
                                              ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
                                              : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                                        >
                                          {pageNum}
                                        </button>
                                      ))
                                    ) : (
                                      <button
                                        disabled
                                        className="px-2 py-1.5 text-sm font-medium border rounded-md bg-blue-600 text-white border-blue-600 opacity-50 cursor-not-allowed"
                                      >
                                        1
                                      </button>
                                    )}
                                    
                                    <button
                                      disabled={pagination.currentPage === pagination.totalPages || loading || pagination.totalPages <= 1}
                                      onClick={() => handleMessagePageChange(index, pagination.currentPage + 1)}
                                      className="px-2 py-1.5 text-sm font-medium border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white dark:disabled:hover:bg-gray-700 transition-colors"
                                    >
                                      Next
                                    </button>
                                    <button
                                      disabled={pagination.currentPage === pagination.totalPages || loading || pagination.totalPages <= 1}
                                      onClick={() => handleMessagePageChange(index, pagination.totalPages)}
                                      className="px-2 py-1.5 text-sm font-medium border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white dark:disabled:hover:bg-gray-700 transition-colors"
                                    >
                                      Last
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                    );
                  })()}
                  </div>
                )})}
                {loading && (
                <div className="flex gap-4 px-6 py-6 bg-white dark:bg-gray-900 animate-pulse">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-green-500 dark:from-blue-600 dark:to-green-600 flex items-center justify-center shadow-lg">
                    <Bot className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 pt-1">
                    <div className="font-semibold text-sm text-blue-600 dark:text-blue-400 mb-2">AI Assistant</div>
                    <div className="flex items-center gap-3">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                      </div>
                      <span className="text-gray-500 dark:text-gray-400 text-sm font-medium">Thinking...</span>
                    </div>
                  </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* SQL Results Popup Modal */}
          {showResultsModal && sqlResults && sqlResults.rows && sqlResults.rows.length > 0 && (
            <div 
              key={`modal-${sqlResults.columns.join('-')}-${sqlResults.rows.length}`}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 dark:bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  setShowResultsModal(false);
                }
              }}
            >
              <div className="relative w-full max-w-7xl max-h-[90vh] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl flex flex-col animate-in slide-in-from-bottom-4 duration-300 overflow-hidden border-2 border-gray-200 dark:border-gray-700">
                {/* Modal Header */}
                <div className="flex items-center justify-between px-2 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-800 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
                      <FileText className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Query Results</h2>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {totalItems > 0 ? `${totalItems.toLocaleString()} row${totalItems !== 1 ? 's' : ''} found` : 'No results'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowResultsModal(false)}
                    className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors duration-200 hover:scale-110"
                    aria-label="Close modal"
                  >
                    <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  </button>
                </div>

                {/* Modal Body - Table */}
                <div className="flex-1 overflow-hidden flex flex-col">
                  <div className="flex-1 overflow-auto">
                    <div className="p-4">
                <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                          <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0 z-10">
                      <tr>
                        {sqlResults.columns.map((column, idx) => (
                          <th
                            key={idx}
                                  onClick={() => handleSortChange(column)}
                                  className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 select-none transition-colors duration-150"
                          >
                                  <div className="flex items-center gap-2">
                                    <span>{column}</span>
                                    {sortBy === column && (
                                      <span className="text-blue-600 dark:text-blue-400">
                                        {sortOrder === 'asc' ? '▲' : '▼'}
                                      </span>
                                    )}
                                  </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {sqlResults.rows.map((row, rowIdx) => (
                        <tr
                          key={rowIdx}
                                className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-150"
                        >
                          {sqlResults.columns.map((column, colIdx) => (
                            <td
                              key={colIdx}
                                    className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white"
                            >
                              {row[column] ?? ''}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                    </div>
                  </div>

                  {/* Pagination Controls */}
                  <div className="border-t border-gray-200 dark:border-gray-700 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 px-3 py-3 shadow-inner">
                    {totalPages > 1 ? (
                      <div className="flex items-center justify-between flex-wrap gap-3">
                        <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          <span className="inline-flex items-center gap-1">
                            <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded font-semibold">{currentPage}</span>
                            <span className="text-gray-500 dark:text-gray-400">of</span>
                            <span className="px-2 py-1 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded font-semibold">{totalPages}</span>
                          </span>
                          <span className="ml-3 text-gray-600 dark:text-gray-400">({totalItems.toLocaleString()} rows)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            disabled={currentPage === 1 || loading}
                            onClick={() => handlePageChange(currentPage - 1)}
                            className="px-4 py-2 text-sm font-medium border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-400 dark:hover:border-blue-500 hover:text-blue-700 dark:hover:text-blue-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:scale-105 disabled:hover:scale-100 shadow-sm hover:shadow-md"
                          >
                            ← Prev
                          </button>
                          <button
                            disabled={currentPage === totalPages || loading}
                            onClick={() => handlePageChange(currentPage + 1)}
                            className="px-4 py-2 text-sm font-medium border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-400 dark:hover:border-blue-500 hover:text-blue-700 dark:hover:text-blue-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:scale-105 disabled:hover:scale-100 shadow-sm hover:shadow-md"
                          >
                            Next →
                          </button>
                          <select
                            value={pageSize}
                            onChange={(e) => {
                              setPageSize(Number(e.target.value));
                              handlePageChange(1);
                            }}
                            disabled={loading}
                            className="px-3 py-2 text-sm font-medium border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                          >
                            {[10, 25, 50, 100, 200].map((size) => (
                              <option key={size} value={size}>
                                {size} / page
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center">
                        <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                          <span className="inline-flex items-center gap-2">
                            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                            Total: <span className="text-green-700 dark:text-green-400">{sqlResults.rows.length.toLocaleString()}</span> rows
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

        {/* Input Area - Fixed at Bottom - ChatGPT Style */}
        <div className="border-t bg-gradient-to-r from-white via-gray-50 to-white dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 border-gray-200 dark:border-gray-700 px-2 py-2 shadow-lg">
          <div className="max-w-7xl mx-auto w-full">
            {/* File Attachments Preview - for Read Image/PDF mode */}
            {mode === 'Read Image/PDF' && attachedFiles.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {attachedFiles.map((attachedFile, index) => (
                  <div
                    key={index}
                    className="relative group border border-gray-300 dark:border-gray-600 rounded-lg p-2 bg-gray-50 dark:bg-gray-800"
                  >
                    {attachedFile.type === 'image' ? (
                      <img
                        src={attachedFile.preview}
                        alt={attachedFile.file.name}
                        className="w-20 h-20 object-cover rounded"
                      />
                    ) : (
                      <div className="w-20 h-20 flex items-center justify-center bg-gray-200 dark:bg-gray-700 rounded">
                        <FileText className="w-8 h-8 text-gray-500 dark:text-gray-400" />
                      </div>
                    )}
                    <button
                      onClick={() => handleRemoveFile(index)}
                      className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                    <div className="mt-1 text-xs text-gray-600 dark:text-gray-400 truncate max-w-[80px]">
                      {attachedFile.file.name}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="relative">
              {/* File Input Button - for Read Image/PDF mode */}
              {mode === 'Read Image/PDF' && (
                <label className="absolute left-3 bottom-3 p-2.5 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 text-gray-600 dark:text-gray-400 rounded-lg hover:from-gray-200 hover:to-gray-300 dark:hover:from-gray-600 dark:hover:to-gray-500 cursor-pointer transition-all duration-200 hover:scale-110 shadow-sm hover:shadow-md z-10">
                  <Paperclip className="w-4 h-4" />
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                    disabled={loading}
                  />
                </label>
              )}

              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={mode === 'Read Image/PDF' ? "Attach an image or PDF and ask a question, or just describe what you want..." : "Message AI Assistant..."}
                className={`w-full px-3 py-3 ${mode === 'Read Image/PDF' ? 'pl-12' : ''} pr-14 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition-colors bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400`}
                rows={2}
                disabled={loading}
              />
              <button
                onClick={handleAskQuestion}
                disabled={loading || (!question.trim() && (mode !== 'Read Image/PDF' || attachedFiles.length === 0))}
                className="absolute bottom-3 right-3 p-2.5 bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-500 dark:to-blue-600 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 dark:hover:from-blue-600 dark:hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:scale-110 shadow-lg hover:shadow-xl disabled:hover:scale-100"
                title="Send message"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 text-center flex items-center justify-center gap-2">
              <span className="inline-flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 text-xs font-semibold text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded shadow-sm">Enter</kbd>
                <span>to send</span>
              </span>
              <span className="text-gray-300 dark:text-gray-600">•</span>
              <span className="inline-flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 text-xs font-semibold text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded shadow-sm">Shift</kbd>
                <span>+</span>
                <kbd className="px-1.5 py-0.5 text-xs font-semibold text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded shadow-sm">Enter</kbd>
                <span>for new line</span>
              </span>
              {mode === 'Read Image/PDF' && (
                <>
                  <span className="text-gray-300 dark:text-gray-600">•</span>
                  <span className="text-purple-600 dark:text-purple-400 font-medium">Click paperclip to attach files</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
