# API Integration Setup

This directory contains a clean and professional API integration setup with environment variables and base URL configuration.

## 📁 Structure

```
src/shared/api/
├── config.ts       # API configuration and environment variables
├── client.ts       # Axios client with interceptors and error handling
├── services.ts     # Service layer functions
├── index.ts        # Main exports
└── README.md       # This file
```

## 🚀 Quick Start

### 1. Environment Setup

Create a `.env` file in your project root:

```env
# API Configuration
VITE_API_BASE_URL=http://localhost:3001/api

# API Settings
VITE_API_TIMEOUT=10000
VITE_API_RETRY_ATTEMPTS=3
VITE_API_RETRY_DELAY=1000

# Environment
VITE_NODE_ENV=development

# Feature Flags
VITE_ENABLE_API_LOGGING=true
VITE_ENABLE_API_CACHE=true
```

### 2. Using the API

```tsx
import { authService } from '@/shared/api';

// Login
const loginResult = await authService.login({
  email: 'user@example.com',
  password: 'password'
});
```

## 🔧 Features

### ✅ Configuration (`config.ts`)

- **Environment Variables**: Centralized configuration with fallbacks
- **Validation**: Environment variable validation with warnings
- **Endpoints**: Organized endpoint definitions
- **Type Safety**: Full TypeScript support
- **URL Building**: Utility functions for building URLs with parameters

### ✅ Axios Client (`client.ts`)

- **Base Configuration**: Centralized API base URL and timeout settings
- **Request Interceptors**: Automatic token injection and request logging
- **Response Interceptors**: Error handling, token refresh, and response logging
- **Error Handling**: Custom `ApiError` class with status codes and messages
- **File Upload**: Built-in file upload with progress tracking
- **Authentication**: Automatic token management and refresh

### ✅ Service Layer (`services.ts`)

- **Resource Services**: Separate services for each API resource
- **Type Safety**: Full TypeScript support with proper return types
- **Error Handling**: Consistent error handling across all services
- **File Operations**: Upload, download, and file management

## 📚 Usage Examples

### Authentication

```tsx
import { authService } from '@/shared/api';

// Login (automatically stores tokens in cookies)
const loginResult = await authService.login({
  email: 'user@example.com',
  password: 'password'
});

// Logout (automatically clears tokens from cookies)
await authService.logout();

// Refresh token (automatically updates token in cookies)
const refreshResult = await authService.refreshToken(refreshToken);

// Check authentication status
const isAuthenticated = authService.isAuthenticated();

// Get tokens
const authToken = authService.getAuthToken();
const refreshToken = authService.getRefreshToken();

// Clear tokens manually
authService.clearTokens();
```

### User Management

```tsx
import { userService } from '@/shared/api';

// Get user profile
const profile = await userService.getProfile();

// Update profile
await userService.updateProfile({
  firstName: 'John',
  lastName: 'Doe'
});

// Upload avatar
await userService.uploadAvatar(file, (progress) => {
  console.log(`Upload progress: ${progress}%`);
});
```

### File Operations

```tsx
import { fileService } from '@/shared/api';

// Upload file
const uploadResult = await fileService.uploadFile(file, (progress) => {
  console.log(`Upload progress: ${progress}%`);
});

// Download file
const fileBlob = await fileService.downloadFile('file-id');
```

## 🔒 Error Handling

The API setup includes comprehensive error handling:


### 3. Use TypeScript Types

## 🛠️ Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_BASE_URL` | API base URL | `http://localhost:3001/api` |
| `VITE_API_TIMEOUT` | Request timeout (ms) | `10000` |
| `VITE_API_RETRY_ATTEMPTS` | Number of retry attempts | `3` |
| `VITE_API_RETRY_DELAY` | Retry delay (ms) | `1000` |
| `VITE_ENABLE_API_LOGGING` | Enable request/response logging | `false` |
| `VITE_ENABLE_API_CACHE` | Enable API caching | `true` |

### Adding New Endpoints

```tsx
// In config.ts
export const API_ENDPOINTS = {
  // ... existing endpoints
  NEW_RESOURCE: {
    BASE: '/new-resource',
    DETAIL: (id: string | number) => `/new-resource/${id}`,
    ACTION: (id: string | number) => `/new-resource/${id}/action`,
  },
};
```

### Adding New Services

```tsx
// In services.ts
export const newResourceService = {
  getAll: async (params?: PaginationParams) => {
    return api.get<PaginatedResponse<NewResource>>(
      buildApiUrl(API_ENDPOINTS.NEW_RESOURCE.BASE, params)
    );
  },
  
  getById: async (id: string | number) => {
    return api.get<NewResource>(API_ENDPOINTS.NEW_RESOURCE.DETAIL(id));
  },
  
  create: async (data: Partial<NewResource>) => {
    return api.post<NewResource>(API_ENDPOINTS.NEW_RESOURCE.BASE, data);
  },
};
```

## 🧪 Testing

The API setup is designed to be easily testable:


## 📦 Dependencies

Make sure you have axios installed:

```bash
npm install axios
```

## 🍪 Cookie-Based Authentication

The API setup uses cookies for secure token storage:

- **Access Token**: Stored as `auth-token` cookie (expires in 7 days)
- **Refresh Token**: Stored as `auth-refresh-token` cookie (expires in 30 days)
- **Automatic Management**: Tokens are automatically handled during login/logout/refresh
- **Security**: Cookies are HTTP-only and secure in production

### Cookie Configuration

```typescript
// Access token: 7 days expiration
Cookies.set('auth-token', token, { expires: 7 });

// Refresh token: 30 days expiration  
Cookies.set('auth-refresh-token', refreshToken, { expires: 30 });
```

## 🎉 Benefits

- **Type Safety**: Full TypeScript support throughout
- **Environment Configuration**: Flexible environment variable setup
- **Error Handling**: Comprehensive error management
- **Developer Experience**: Request/response logging
- **Scalability**: Easy to extend and maintain
- **Testing**: Designed for easy testing
- **Consistency**: Standardized patterns across the app
- **Secure Authentication**: Cookie-based token management
