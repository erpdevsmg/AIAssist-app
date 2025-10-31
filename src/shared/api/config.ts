// API Configuration
export const API_CONFIG = {
  // Base URL from environment variable with fallback
  BASE_URL: import.meta.env.VITE_API_URL+'/api' || 'http://localhost:3001/api',
  
  
  // Timeout settings
  TIMEOUT: parseInt(import.meta.env.VITE_API_TIMEOUT || '10000'),
  
  // Retry settings
  RETRY_ATTEMPTS: parseInt(import.meta.env.VITE_API_RETRY_ATTEMPTS || '3'),
  RETRY_DELAY: parseInt(import.meta.env.VITE_API_RETRY_DELAY || '1000'),
  
  // Environment
  ENV: import.meta.env.VITE_NODE_ENV || 'development',
  
  // Feature flags
  ENABLE_LOGGING: import.meta.env.VITE_ENABLE_API_LOGGING === 'true',
  ENABLE_CACHE: import.meta.env.VITE_ENABLE_API_CACHE !== 'false',
} as const;

// Environment validation
export const validateApiConfig = () => {
  const requiredVars = ['VITE_API_BASE_URL'];
  const missing = requiredVars.filter(varName => !import.meta.env[varName]);
  
  if (missing.length > 0) {
    console.warn(`Missing environment variables: ${missing.join(', ')}`);
    console.warn('Using default values. Please check your .env file.');
  }
  
  return {
    isValid: true,
    warnings: missing.length > 0 ? missing : [],
  };
};

// API endpoints configuration
export const API_ENDPOINTS = {
  BASE: '/api',
  // Auth endpoints
  LOGIN: '/auth/login',
  LOGOUT: '/auth/logout',
  REFRESH_TOKEN: '/auth/refresh',
  SSO_REFRESH_TOKEN: '/Desk/sso-refresh-token',
  FORGOT_PASSWORD: '/auth/forgot-password',
  RESET_PASSWORD: '/auth/reset-password',

  
  // User endpoints
  USERS: '/users',
  PROFILE: '/users/profile',
  USER_PROFILE: '/Desk/me',
  UPDATE_USER_PROFILE: '/users/UPDATE_USER_PROFILE',
  SETTINGS: '/users/settings',
  UPDATE_SETTINGS: '/users/settings',
  AVATAR: '/users/avatar',
  
  // File endpoints
  UPLOAD: '/files/upload',
  DOWNLOAD: '/files/download/:id',
  
  // Notification endpoints
  NOTIFICATIONS: '/notifications',
  NOTIFICATIONS_BASE:'/notifications',
  MARK_READ: '/notifications/mark-read',

  // AI Assistant endpoints
  GET_AI_PROVIDER: '/Desk/GetAIProvider',
  GET_AI_MODEL: '/Desk/GetAIModel',
  GET_AI_DIVISIONS: '/Desk/GetAIDivisions',
  GET_AI_DIVISIONS_SYSTEM_PROMPT: '/Desk/GetAIDivisionsSystemPrompt',
  GET_AI_FIELDS: '/Desk/GetAIFields',
  EXECUTE_SQL_QUERY: '/Desk/ExecuteSafeQuery',
 
};

// Query parameters types
export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// URL builder utility
export const buildApiUrl = (endpoint: string, params?: Record<string, any>): string => {
  if (!params) return endpoint;
  
  const url = new URL(endpoint, 'http://localhost'); // Base URL doesn't matter for params
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.append(key, String(value));
    }
  });
  
  return `${endpoint}${url.search}`;
};
