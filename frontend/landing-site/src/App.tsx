/**
 * Main application component with routing.
 */

import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { PublicLayout } from './components/layout/PublicLayout';

// Lazy load pages for code splitting
const LandingPage = lazy(() => import('./pages/LandingPage').then(m => ({ default: m.LandingPage })));

function App() {
  return (
    <HelmetProvider>
      <BrowserRouter>
        <Suspense fallback={
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
            <div className="spinner"></div>
          </div>
        }>
          <Routes>
            <Route element={<PublicLayout />}>
              <Route path="/" element={<LandingPage />} />
              {/* Additional routes will be added in future phases */}
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </HelmetProvider>
  );
}

export default App;
