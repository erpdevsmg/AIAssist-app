/**
 * Application Routes Configuration
 * This file lists all available pages in the application for easy discovery
 */

export const ROUTES = {
  HOME: '/',
  AI_ASSISTANT: '/ai-assistant',
  SETTINGS: '/settings',
} as const;

export type RoutePath = typeof ROUTES[keyof typeof ROUTES];

/**
 * Page Components
 * All page components are lazy loaded in App.tsx
 */
export const PAGES = {
  AIAssistantPage: {
    path: ROUTES.HOME,
    name: 'AI Assistant',
    component: 'AIAssistantPage',
    file: 'src/features/AIAssistant/pages/AIAssistantPage.tsx',
  },
  Settings: {
    path: ROUTES.SETTINGS,
    name: 'Settings',
    component: 'Settings',
    file: 'src/features/settings/pages/Settings.tsx',
  },
} as const;

export default ROUTES;



