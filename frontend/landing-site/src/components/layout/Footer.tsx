/**
 * Footer component with mobile-first responsive design.
 */

import { Link } from 'react-router-dom';
import './Footer.css';

export const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer" role="contentinfo">
      <div className="container">
        <div className="footer-content">
          {/* Brand */}
          <div className="footer-section footer-brand">
            <h3 className="footer-logo">Augeo</h3>
            <p className="footer-tagline">
              World-class fundraising software that maximizes nonprofit revenue
            </p>
          </div>

          {/* Quick Links */}
          <div className="footer-section">
            <h4 className="footer-heading">Platform</h4>
            <nav className="footer-links" aria-label="Platform links">
              <Link to="/about" className="footer-link">About</Link>
              <Link to="/testimonials" className="footer-link">Testimonials</Link>
              <Link to="/contact" className="footer-link">Contact</Link>
            </nav>
          </div>

          {/* Get Started */}
          <div className="footer-section">
            <h4 className="footer-heading">Get Started</h4>
            <nav className="footer-links" aria-label="Get started links">
              <Link to="/register/donor" className="footer-link">Register as Donor</Link>
              <Link to="/register/auctioneer" className="footer-link">Register as Auctioneer</Link>
              <Link to="/register/npo" className="footer-link">Register Your NPO</Link>
              <Link to="/login" className="footer-link">Login</Link>
            </nav>
          </div>

          {/* Legal */}
          <div className="footer-section">
            <h4 className="footer-heading">Legal</h4>
            <nav className="footer-links" aria-label="Legal links">
              <Link to="/legal/terms" className="footer-link">Terms of Service</Link>
              <Link to="/legal/privacy" className="footer-link">Privacy Policy</Link>
            </nav>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="footer-bottom">
          <p className="footer-copyright">
            © {currentYear} Augeo. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};
