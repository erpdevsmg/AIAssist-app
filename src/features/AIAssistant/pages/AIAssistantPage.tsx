import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Send, 
  X, 
  Trash2, 
  Loader2,
  AlertCircle,
  User,
  Bot,
} from 'lucide-react';
import { Layout } from '@/shared/ui/Layout';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { AIAssistantService } from '../api/AIAssistantService';
import { 
  AIMode, 
  ConversationMessage, 
  SQLQueryResult, 
  AIDivision, 
  Subdivision
} from '../types/AIAssistant';

export function AIAssistantPage() {
  const navigate = useNavigate();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // ChatGPT API Config
  const [_apiUrl, setApiUrl] = useState<string>('');
  const [_apiKey, setApiKey] = useState<string>('');
  const [apiModel, setApiModel] = useState<string>('');

  // Form state
  const [mode, setMode] = useState<AIMode>('SQL Assistant');
  const [selectedDivision, setSelectedDivision] = useState<string>('');
  const [selectedSubdivision, setSelectedSubdivision] = useState<string>('');
  const [question, setQuestion] = useState('');
  const [conversation, setConversation] = useState<ConversationMessage[]>([]);
  const [sqlResults, setSqlResults] = useState<SQLQueryResult | null>(null);

  // Data state
  const [divisions, setDivisions] = useState<AIDivision[]>([]);

  // Load initial data
  useEffect(() => {
    const initialize = async () => {
      try {
        setInitializing(true);
        setError(null);
        
        // Load AI Provider (URL & API Key)
        try {
          const providerResponse = await AIAssistantService.getAIProvider();
          
          if (providerResponse && providerResponse.success && providerResponse.data) {
            setApiUrl(providerResponse.data.url);
            setApiKey(providerResponse.data.apiKey);
          } else {
            // Not an error - just informational, continue loading
            console.warn('No active AI provider found. The API may not be configured.');
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
          const modelResponse = await AIAssistantService.getAIModel();
          
          if (modelResponse && modelResponse.success && modelResponse.data) {
            setApiModel(modelResponse.data.model);
          } else {
            // Not an error - just informational, continue loading
            console.warn('No active AI model found. The API may not be configured.');
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
          
          if (divisionsResponse && divisionsResponse.success && divisionsResponse.data) {
            setDivisions(divisionsResponse.data);
            
            // Auto-select first division if available
            if (divisionsResponse.data.length > 0) {
              const firstDivision = divisionsResponse.data[0];
              setSelectedDivision(firstDivision.divisionValue);
              
              // Auto-select first subdivision if available
              if (firstDivision.subdivisions && firstDivision.subdivisions.length > 0) {
                setSelectedSubdivision(firstDivision.subdivisions[0].subdivisionValue);
              }
            }
          }
        } catch (divisionsError: any) {
          // Divisions are only needed for SQL Assistant mode, so we can continue
        }

        setInitializing(false);
      } catch (error) {
        setError('Failed to initialize AI Assistant');
        setInitializing(false);
      }
    };

    initialize();
  }, []);

  // Load AI fields and system prompt when division changes
  useEffect(() => {
    if (!selectedDivision) return;

    const loadDivisionData = async () => {
      try {
        setLoading(true);
        
        // Load AI fields for the selected division
        await AIAssistantService.getAIFields(selectedDivision);

        // Load system prompt for the selected division
        const promptResponse = await AIAssistantService.getAIDivisionsSystemPrompt(selectedDivision);
        if (promptResponse.success && promptResponse.data) {
          // Show schema loaded message
          setSuccessMessage(`Schema loaded for division '${selectedDivision}'. You can now ask SQL-related questions.`);
          setTimeout(() => setSuccessMessage(null), 5000);
        }

        setLoading(false);
      } catch (error) {
        setError('Failed to load division data');
        setLoading(false);
      }
    };

    loadDivisionData();
  }, [selectedDivision]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation]);

  // Get current division object
  const currentDivision = divisions.find((d: AIDivision) => d.divisionValue === selectedDivision);
  const subdivisions = currentDivision?.subdivisions || [];

  // Handle asking a question
  const handleAskQuestion = async () => {
    if (!question.trim()) return;
    if (mode === 'SQL Assistant' && !selectedDivision) {
      setError('Please select a division first');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Add user message to conversation
      const userMessage: ConversationMessage = {
        role: 'user',
        content: question,
        timestamp: new Date()
      };
      setConversation(prev => [...prev, userMessage]);

      const aiResponse: ConversationMessage = {
        
          role: 'assistant',
        content: 'AI response will be implemented here.',
          timestamp: new Date()
        };

      setConversation(prev => [...prev, aiResponse]);
      setQuestion('');
      setLoading(false);
    } catch (error) {
      setError('Failed to get AI response. Please try again.');
      setLoading(false);
    }
  };

  // Handle clear
  const handleClear = () => {
    if (confirm('Do you want to clear the conversation history?')) {
    setConversation([]);
    setSqlResults(null);
    setQuestion('');
    setError(null);
    setSuccessMessage(null);
    }
  };

  // Handle exit
  const handleExit = () => {
    navigate(-1);
  };

  // Handle key press in input
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAskQuestion();
    }
  };

  if (initializing) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <span className="ml-2">Loading AI Assistant...</span>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex flex-col h-[calc(100vh-8rem)] max-w-6xl mx-auto bg-white">
        {/* Header - ChatGPT Style */}
        <div className="flex items-center justify-between px-6 py-3 border-b bg-white sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold text-gray-900">AI Assistant</h1>
            {apiModel && (
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                {apiModel}
              </span>
            )}
          </div>
          <button
            onClick={handleExit}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
          </div>

          {/* Status Messages */}
          {successMessage && (
          <div className="mx-6 mt-3 bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-center">
            <AlertCircle className="w-4 h-4 text-yellow-600 mr-2 flex-shrink-0" />
            <span className="text-yellow-800 text-sm">{successMessage}</span>
            </div>
          )}

          {error && (
          <div className="mx-6 mt-3 bg-red-50 border border-red-200 rounded-lg p-3 flex items-center">
            <X className="w-4 h-4 text-red-600 mr-2 flex-shrink-0" />
              <span className="text-red-800 text-sm">{error}</span>
            </div>
          )}

        {/* Controls Bar - Top */}
        <div className="px-6 py-3 border-b bg-gray-50 flex items-center gap-4 flex-wrap">
          {/* Mode Selection */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Mode:</label>
            <div className="flex gap-3">
              {(['General', 'Read Image/PDF', 'SQL Assistant'] as AIMode[]).map((m) => (
                <label
                  key={m}
                  className="flex items-center cursor-pointer text-sm"
                >
                  <input
                    type="radio"
                    name="mode"
                    value={m}
                    checked={mode === m}
                    onChange={() => setMode(m)}
                    className="mr-1.5"
                  />
                  <span className="text-gray-700">{m}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Division Selection */}
          {mode === 'SQL Assistant' && (
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Division:</label>
              <Select
                value={selectedDivision}
                onValueChange={(value) => {
                  setSelectedDivision(value);
                  setSelectedSubdivision('');
                }}
              >
                <SelectTrigger className="w-48 h-8 text-sm">
                  <SelectValue placeholder="Select Division" />
                </SelectTrigger>
                <SelectContent>
                  {divisions.map((division: AIDivision) => (
                    <SelectItem
                      key={division.divisionValue}
                      value={division.divisionValue}
                    >
                      {division.divisionName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {subdivisions.length > 0 && (
                <Select
                  value={selectedSubdivision}
                  onValueChange={setSelectedSubdivision}
                >
                  <SelectTrigger className="w-48 h-8 text-sm">
                    <SelectValue placeholder="Select Subdivision" />
                  </SelectTrigger>
                  <SelectContent>
                    {subdivisions.map((subdivision: Subdivision) => (
                      <SelectItem
                        key={subdivision.subdivisionValue}
                        value={subdivision.subdivisionValue}
                      >
                        {subdivision.subdivisionName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          <div className="ml-auto">
            <button
              onClick={handleClear}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Clear
            </button>
          </div>
        </div>

        {/* Conversation Area - ChatGPT Style */}
        <div className="flex-1 overflow-y-auto bg-white">
            {conversation.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Bot className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 text-lg font-medium mb-2">How can I help you today?</p>
                <p className="text-gray-400 text-sm">Ask me anything or select a mode above</p>
              </div>
              </div>
            ) : (
            <div className="pb-4">
                {conversation.map((message, index) => (
                  <div
                    key={index}
                  className={`flex gap-4 px-6 py-6 ${
                      message.role === 'user'
                      ? 'bg-gray-50' 
                      : 'bg-white'
                  }`}
                >
                  {/* Avatar */}
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                    message.role === 'user'
                      ? 'bg-gray-900'
                      : 'bg-green-500'
                  }`}>
                    {message.role === 'user' ? (
                      <User className="w-5 h-5 text-white" />
                    ) : (
                      <Bot className="w-5 h-5 text-white" />
                    )}
                  </div>
                  
                  {/* Message Content */}
                  <div className="flex-1 max-w-4xl pt-1">
                    <div className="font-semibold text-sm text-gray-900 mb-2">
                      {message.role === 'user' ? 'You' : 'AI Assistant'}
                    </div>
                    <div className="text-gray-800 whitespace-pre-wrap leading-relaxed prose prose-sm max-w-none">
                      {message.content}
                    </div>
                    </div>
                  </div>
                ))}
                {loading && (
                <div className="flex gap-4 px-6 py-6 bg-white">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
                    <Bot className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 pt-1">
                    <div className="font-semibold text-sm text-gray-900 mb-2">AI Assistant</div>
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                      <span className="text-gray-500 text-sm">Thinking...</span>
                    </div>
                  </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* SQL Results Table */}
          {sqlResults && sqlResults.rows.length > 0 && (
          <div className="px-6 py-4 border-t bg-gray-50 max-h-80 overflow-y-auto">
              <div className="bg-white border rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        {sqlResults.columns.map((column, idx) => (
                          <th
                            key={idx}
                          className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider"
                          >
                            {column}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {sqlResults.rows.map((row, rowIdx) => (
                        <tr
                          key={rowIdx}
                        className={rowIdx === 0 ? 'bg-blue-50' : 'hover:bg-gray-50'}
                        >
                          {sqlResults.columns.map((column, colIdx) => (
                            <td
                              key={colIdx}
                            className="px-4 py-2 text-sm text-gray-900"
                            >
                              {row[column] ?? ''}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              <div className="bg-gray-50 px-4 py-2 text-sm text-gray-600 font-medium">
                  Total Count: {sqlResults.rows.length}
                </div>
              </div>
            </div>
          )}

        {/* Input Area - Fixed at Bottom - ChatGPT Style */}
        <div className="border-t bg-white px-6 py-4">
          <div className="max-w-4xl mx-auto">
            <div className="relative">
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Message AI Assistant..."
                className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none bg-white text-gray-900 placeholder-gray-400"
                rows={3}
                disabled={loading}
              />
              <button
                onClick={handleAskQuestion}
                disabled={loading || !question.trim()}
                className="absolute bottom-3 right-3 p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>
            <div className="mt-2 text-xs text-gray-500 text-center">
              Press Enter to send, Shift+Enter for new line
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
