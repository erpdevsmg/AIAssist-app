import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { LoadingSpinner } from '@/shared/ui/LoadingSpinner';
import { ROUTES } from './routes';

// Lazy load feature pages 
const AIAssistantPage = React.lazy(() => import('@/features/AIAssistant/pages/AIAssistantPage').then(module => ({ default: module.AIAssistantPage })));
const Settings = React.lazy(() => import('@/features/settings/pages/Settings').then(module => ({ default: module.Settings })));

function App() {
  return (
    <Router>
      <div className="App">
        <Suspense fallback={
          <div className="min-h-screen bg-gray-50 flex items-center justify-center">
            <LoadingSpinner size="lg" text="Loading..." />
          </div>
        }>
          <Routes>
            <Route path={ROUTES.HOME} element={<AIAssistantPage />} />
            <Route path={ROUTES.AI_ASSISTANT} element={<AIAssistantPage />} />
            <Route path={ROUTES.SETTINGS} element={<Settings />} />
          </Routes>
        </Suspense>
      </div>
    </Router>
  );
}

export default App;