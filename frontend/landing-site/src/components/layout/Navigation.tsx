/**
 * Navigation component with mobile-first responsive design.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import './Navigation.css';

export const Navigation = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  return (
    <nav className="navigation" role="navigation" aria-label="Main navigation">
      <div className="container">
        <div className="nav-wrapper">
          {/* Logo */}
          <Link to="/" className="nav-logo" aria-label="Fundrbolt Home">
            <span className="logo-text">Fundrbolt</span>
          </Link>

          {/* Mobile menu button */}
          <button
            className="mobile-menu-btn"
            onClick={toggleMobileMenu}
            aria-expanded={isMobileMenuOpen}
            aria-label="Toggle navigation menu"
          >
            <span className="hamburger-icon">
              <span></span>
              <span></span>
              <span></span>
            </span>
          </button>

          {/* Navigation links */}
          <div className={`nav-links ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
            <Link to="/" className="nav-link" onClick={() => setIsMobileMenuOpen(false)}>
              Home
            </Link>
            <Link to="/about" className="nav-link" onClick={() => setIsMobileMenuOpen(false)}>
              About
            </Link>
            <Link to="/testimonials" className="nav-link" onClick={() => setIsMobileMenuOpen(false)}>
              Testimonials
            </Link>
            <Link to="/contact" className="nav-link" onClick={() => setIsMobileMenuOpen(false)}>
              Contact
            </Link>
            <Link
              to="/login"
              className="nav-link nav-link-login"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Login
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
};
