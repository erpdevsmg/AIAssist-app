import { api } from './client';
import { API_ENDPOINTS, buildApiUrl, PaginationParams } from './config';
import { AIAssistant } from '@/features/AIAssistant/types/AIAssistant';
import Cookies from 'js-cookie';

// User types (since they're not in the AIAssistant types file)
export interface User {
  id: string;
  email: string;
  userName: string;
  lastName: string;
  roleID: string;
  badgeNo?: string;
  department?: string;
  position?: string;
  designation?: string;
  coCode?: string;
  deptCode?: string;
  deptName?: string;
  userID?: string;
  coName?: string;
}

export interface UserSettings {
  language: string;
  timezone: string;
  dateFormat: string;
  currency: string;
  notifications: {
    email: boolean;
    push: boolean;
    sms: boolean;
  };
  theme: 'light' | 'dark' | 'auto';
}

// Authentication Services
export const authService = {
  login: async (credentials: { email: string; password: string }) => {
    const response = await api.post<{ user: User; token: string; refreshToken: string }>(
      API_ENDPOINTS.LOGIN,
      credentials
    );
    
    // Store tokens in cookies
    if (response.data.token) {
      Cookies.set('auth-token', response.data.token, { expires: 7 }); // 7 days
    }
    if (response.data.refreshToken) {
      Cookies.set('auth-refresh-token', response.data.refreshToken, { expires: 30 }); // 30 days
    }
    
    return response;
  },

  logout: async () => {
    const response = await api.post(API_ENDPOINTS.LOGOUT);
    
    // Clear tokens from cookies
    Cookies.remove('auth-token');
    Cookies.remove('auth-refresh-token');
    
    return response;
  },

  refreshToken: async (refreshToken: string) => {
    const response = await api.post<{ accessToken: string }>(
      API_ENDPOINTS.REFRESH_TOKEN,
      { refreshToken }
    );
    
    // Update access token in cookie
    if (response.data.accessToken) {
      Cookies.set('auth-token', response.data.accessToken, { expires: 7 });
    }
    
    return response;
  },

  ssoRefreshToken: async (refreshToken: string) => {
    try {
      const response = await api.post<{ accessToken: string; refreshToken?: string }>(
        API_ENDPOINTS.SSO_REFRESH_TOKEN,
        { refreshToken }
      );
      
      if (response.data.accessToken) {
        Cookies.set('auth-token', response.data.accessToken, { expires: 7 });
      }
      if (response.data.refreshToken) {
        Cookies.set('auth-refresh-token', response.data.refreshToken, { expires: 30 });
      }
      
      return response;
    } catch (error) {
      console.error('SSO refresh token failed:', error);
      throw error;
    }
  },

  forgotPassword: async (email: string) => {
    return api.post(API_ENDPOINTS.FORGOT_PASSWORD, { email });
  },

  resetPassword: async (token: string, password: string) => {
    return api.post(API_ENDPOINTS.RESET_PASSWORD, { token, password });
  },

  // Helper methods for token management
  getAuthToken: () => {
    return Cookies.get('auth-token');
  },

  getRefreshToken: () => {
    return Cookies.get('auth-refresh-token');
  },

  isAuthenticated: () => {
    return !!Cookies.get('auth-token');
  },

  clearTokens: () => {
    Cookies.remove('auth-token');
    Cookies.remove('auth-refresh-token');
  },

   // Test refresh token functionality
   testRefreshToken: async () => {
    const refreshToken = authService.getRefreshToken();
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }
    
    try {
      const result = await authService.ssoRefreshToken(refreshToken);
      console.log('✅ Refresh token test successful:', result);
      return result;
    } catch (error) {
      console.error('❌ Refresh token test failed:', error);
      throw error;
    }
  },
};

// AI Assistant Services
export const aiAssistantService = {
  // Get single AI Assistant by ID
  getAIAssistant: async (id: string | number) => {
    return api.get(`${API_ENDPOINTS.BASE}/${id}`);
  },

  // Create new AI Assistant
  createAIAssistant: async (aiAssistantData: Partial<AIAssistant>) => {
    return api.post(API_ENDPOINTS.BASE, aiAssistantData);
  },

  // Update AI Assistant
  updateAIAssistant: async (id: string | number, aiAssistantData: Partial<AIAssistant>) => {
    return api.put(`${API_ENDPOINTS.BASE}/${id}`, aiAssistantData);
  },

  // Delete AI Assistant
  deleteAIAssistant: async (id: string | number) => {
    return api.delete(`${API_ENDPOINTS.BASE}/${id}`);
  },
  
};

// User Services
export const userService = {
  // Get user profile
  getProfile: async () => {
    return api.get<User>(API_ENDPOINTS.PROFILE);
  },

  // Get current user (alias for profile)
  getCurrentUser: async (signal?: AbortSignal) => {
    try {
      return await api.get<User>(API_ENDPOINTS.USER_PROFILE, { signal });
    } catch (error: any) {
      // Normalize "canceled" error to have name "CanceledError" for consistent handling
      if (
        error &&
        (error.message === 'canceled' || error.message === 'cancelled') &&
        error.method === 'get' &&
        error.url === API_ENDPOINTS.USER_PROFILE
      ) {
        
        error.name = 'CanceledError';
      }
      // Swallow abort/cancel errors and return a benign response
      if (error?.name === 'AbortError' || error?.name === 'CanceledError') {
        return { data: null as unknown as User, success: false, message: 'aborted' };
      }
      throw error;
    }
  },

  // Update user profile
  updateProfile: async (profileData: Partial<User>) => {
    return api.put<User>(API_ENDPOINTS.UPDATE_USER_PROFILE, profileData);
  },

  // Get user settings
  getSettings: async () => {
    return api.get<UserSettings>(API_ENDPOINTS.SETTINGS);
  },

  // Update user settings
  updateSettings: async (settingsData: Partial<UserSettings>) => {
    return api.put<UserSettings>(API_ENDPOINTS.UPDATE_SETTINGS, settingsData);
  },

  // Upload avatar
  uploadAvatar: async (file: File, onProgress?: (progress: number) => void) => {
    return api.upload<{ avatarUrl: string }>(API_ENDPOINTS.AVATAR, file, onProgress);
  },
};

// File Services
export const fileService = {
  // Upload file
  uploadFile: async (file: File, onProgress?: (progress: number) => void) => {
    return api.upload<{ fileId: string; fileName: string; fileUrl: string }>(
      API_ENDPOINTS.UPLOAD,
      file,
      onProgress
    );
  },

  // Download file
  // downloadFile: async (id: string | number) => {
  //   return api.get(API_ENDPOINTS.FILES.DOWNLOAD(id), {
  //     responseType: 'blob',
  //   });
  // },
};

// Notification Services
export const notificationService = {
  // Get notifications
  getNotifications: async (params?: PaginationParams) => {
    return api.get(buildApiUrl(API_ENDPOINTS.NOTIFICATIONS, params));
  },

  // Mark notification as read
  markAsRead: async (id: string | number) => {
    return api.post(API_ENDPOINTS.MARK_READ, { id });
  },
};
