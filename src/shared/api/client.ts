import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import Cookies from 'js-cookie';
import { API_CONFIG, API_ENDPOINTS } from './config';

// Response types
export interface ApiResponse<T = any> {
  data: T;
  message?: string;
  success: boolean;
  errors?: string[];
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Error types
export class ApiError extends Error {
  constructor(
    public status: number,
    public message: string,
    public errors?: string[],
    public originalError?: AxiosError
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Extend AxiosRequestConfig to include metadata
interface ExtendedAxiosRequestConfig extends AxiosRequestConfig {
  metadata?: { startTime: number };
}

// Create axios instance
const createApiClient = (): AxiosInstance => {
  const client = axios.create({
    baseURL: API_CONFIG.BASE_URL,
    timeout: API_CONFIG.TIMEOUT,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Request interceptor
  client.interceptors.request.use(
    (config) => {
               // Add auth token if available
         const token = Cookies.get('auth-token');
         if (token) {
           config.headers.Authorization = `Bearer ${token}`;
         }

      // Add request timestamp for logging
      (config as ExtendedAxiosRequestConfig).metadata = { startTime: Date.now() };

      // Log requests if enabled
      if (API_CONFIG.ENABLE_LOGGING) {
        //console.log(`🚀 API Request: ${config.method?.toUpperCase()} ${config.url}`);
      }

      return config;
    },
    (error) => {
      if (API_CONFIG.ENABLE_LOGGING) {
        //console.log('❌ Request Error:', error);
      }
      return Promise.reject(error);
    }
  );

  // Response interceptor
  client.interceptors.response.use(
    (response: AxiosResponse) => {
      const config = response.config as ExtendedAxiosRequestConfig;
      
      if (API_CONFIG.ENABLE_LOGGING) {
        const duration = Date.now() - (config.metadata?.startTime || Date.now());
        //console.log(`✅ API Response: ${response.status} (${duration}ms) - ${response.config.url}`);
      }
      
      return response;
    },
    async (error: any) => {
      // Silently handle canceled requests
      if (axios.isCancel(error) || error?.code === 'ERR_CANCELED' || error?.message === 'canceled') {
        if (API_CONFIG.ENABLE_LOGGING) {
          //console.log('⏹️ Request canceled:', error?.config?.url);
        }
        return Promise.reject(error);
      }
      const originalRequest = (error as AxiosError).config as AxiosRequestConfig & { _retry?: boolean };
      
      // Log error details
      if (API_CONFIG.ENABLE_LOGGING) {
        console.log('❌ API Error:', {
          status: (error as AxiosError).response?.status,
          message: (error as AxiosError).message,
          url: (error as AxiosError).config?.url,
          method: (error as AxiosError).config?.method,
        });
      }
      
      // Handle 401 Unauthorized - refresh token or redirect to login
      if ((error as AxiosError).response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true;
        
        try {
          // Attempt to refresh token using SSO endpoint first, fallback to /auth/refresh
          const refreshToken = Cookies.get('auth-refresh-token');
          
          if (refreshToken) {
            let accessToken: string | undefined;
            let newRefreshToken: string | undefined;
            
            try {
              // Try SSO refresh endpoint first
              const ssoResp = await axios.post(`${API_CONFIG.BASE_URL}${API_ENDPOINTS.SSO_REFRESH_TOKEN}`, { refreshToken });
              accessToken = ssoResp.data?.accessToken;
              newRefreshToken = ssoResp.data?.refreshToken;
              
              if (API_CONFIG.ENABLE_LOGGING) {
                console.log('✅ SSO refresh token successful');
              }
            } catch (ssoError) {
              if (API_CONFIG.ENABLE_LOGGING) {
                console.log('⚠️ SSO refresh failed, trying fallback:', ssoError);
              }
              
              // Fallback to standard refresh endpoint
              const refreshResponse = await axios.post(`${API_CONFIG.BASE_URL}${API_ENDPOINTS.REFRESH_TOKEN}`, { refreshToken });
              accessToken = refreshResponse.data?.accessToken;
              newRefreshToken = refreshResponse.data?.refreshToken;
              
              if (API_CONFIG.ENABLE_LOGGING) {
                console.log('✅ Fallback refresh token successful');
              }
            }

            if (accessToken) {

              const tokenExpiry =   new Date(new Date().getTime() + 60 * 60 * 1000)// 1 hour
              const refreshTokenExpiry =   new Date(new Date().getTime() + 7 * 24 * 60 * 60 * 1000);// 7 days          
              // const tokenExpiry = new Date(new Date().getTime() + 2 * 60 * 1000);    // Access token expires in 2 minutes
              // const refreshTokenExpiry = new Date(new Date().getTime() + 2 * 60 * 1000); // Refresh token expires in 2 minutes
              // Update tokens in cookies
              Cookies.set('auth-token', accessToken, {
                domain: '.nautixsuite.com',
                path: '/',
                secure: true,               
                sameSite: 'None',           
                expires: tokenExpiry
              });

              //Cookies.set('auth-token', accessToken, { expires: 7 });
              if (newRefreshToken) {
                Cookies.set('auth-refresh-token', newRefreshToken, {
                  domain: '.nautixsuite.com',
                  path: '/',
                  secure: true,               
                  sameSite: 'None',           
                  expires: refreshTokenExpiry
                });
                //Cookies.set('auth-refresh-token', newRefreshToken, { expires: 30 });
              }
              
              // Retry original request with new token
              originalRequest.headers!.Authorization = `Bearer ${accessToken}`;
              return client(originalRequest);
            } else {
              throw new Error('No access token received from refresh');
            }
          } else {
            throw new Error('No refresh token available');
          }
        } catch (refreshError) {
          //alert('Refresh token failed1');
           // Refresh failed - redirect to login
           Cookies.remove('auth-token');
           Cookies.remove('auth-refresh-token');
           window.location.href = 'https://nautixsuite.com';
         }
      }

      // Handle specific error statuses
      if ((error as AxiosError).response?.status === 403) {
        //console.log('🔒 Access forbidden - insufficient permissions');
      } else if ((error as AxiosError).response?.status === 404) {
        //console.log('🔍 Resource not found');
      } else if ((error as AxiosError).response?.status && (error as AxiosError).response!.status >= 500) {
        //console.log('🔥 Server error - please try again later');
      }

      return Promise.reject(error);
    }
  );

  return client;
};

// Create and export the API client
export const apiClient = createApiClient();

// Utility functions for common HTTP methods
export const api = {
  // GET request
  get: async <T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> => {
    try {
      const response = await apiClient.get<ApiResponse<T>>(url, config);
      return response.data;
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  },

  // POST request
  post: async <T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> => {
    try {
      const response = await apiClient.post<ApiResponse<T>>(url, data, config);
      return response.data;
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  },

  // PUT request
  put: async <T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> => {
    try {
      const response = await apiClient.put<ApiResponse<T>>(url, data, config);
      return response.data;
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  },

  // PATCH request
  patch: async <T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> => {
    try {
      const response = await apiClient.patch<ApiResponse<T>>(url, data, config);
      return response.data;
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  },

  // DELETE request
  delete: async <T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> => {
    try {
      const response = await apiClient.delete<ApiResponse<T>>(url, config);
      return response.data;
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  },

  // Upload file
  upload: async <T>(url: string, file: File, onProgress?: (progress: number) => void): Promise<ApiResponse<T>> => {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await apiClient.post<ApiResponse<T>>(url, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          if (onProgress && progressEvent.total) {
            const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            onProgress(progress);
          }
        },
      });
      return response.data;
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  },
};

// Error handler
const handleApiError = (error: AxiosError | any): ApiError => {
  // Treat canceled requests as AbortError so callers can ignore them
  if (axios.isCancel(error) || error?.code === 'ERR_CANCELED' || error?.message === 'canceled') {
    // Throw a DOMException-compatible error
    const abortError: any = new DOMException('Aborted', 'AbortError');
    // Preserve axios error for debugging
    (abortError as any).originalError = error;
    throw abortError;
  }
  const status = (error as AxiosError).response?.status || 0;
  const responseData = (error as AxiosError).response?.data as any;
  const message = responseData?.message || (error as AxiosError).message || 'An unexpected error occurred';
  const errors = responseData?.errors || [];

  return new ApiError(status, message, errors, error as AxiosError);
};
