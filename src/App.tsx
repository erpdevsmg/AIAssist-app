import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { LoadingSpinner } from '@/shared/ui/LoadingSpinner';

// Lazy load feature pages 
const AIAssistantDesk = React.lazy(() => import('@/features/AIAssistant/pages/AIAssistantDesk').then(module => ({ default: module.AIAssistantDesk })));

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
            <Route path="/" element={<AIAssistantDesk />} />
          </Routes>
        </Suspense>
      </div>
    </Router>
  );
}

export default App;