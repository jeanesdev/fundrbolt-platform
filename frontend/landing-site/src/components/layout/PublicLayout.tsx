/**
 * PublicLayout component - wraps all public pages.
 */

import { Outlet } from 'react-router-dom';
import { Navigation } from './Navigation';
import { Footer } from './Footer';
import './PublicLayout.css';

export const PublicLayout = () => {
  return (
    <>
      {/* Skip to main content link for accessibility */}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <Navigation />

      <main id="main-content" className="main-content" role="main">
        <Outlet />
      </main>

      <Footer />
    </>
  );
};
