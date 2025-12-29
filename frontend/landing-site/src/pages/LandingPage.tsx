/**
 * Landing Page - Main entry point with mobile-first responsive design.
 */

import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import './LandingPage.css';

export const LandingPage = () => {
  return (
    <>
      <Helmet>
        <title>Fundrbolt - Fundraising Platform for Nonprofits</title>
        <meta
          name="description"
          content="World-class fundraising software that maximizes nonprofit revenue. Mobile bidding, real-time updates, and easy setup for your next gala or auction."
        />
        <meta property="og:title" content="Fundrbolt - Fundraising Platform for Nonprofits" />
        <meta
          property="og:description"
          content="World-class fundraising software that maximizes nonprofit revenue."
        />
        <meta property="og:type" content="website" />
        <link rel="canonical" href="https://fundrbolt.com" />
      </Helmet>

      {/* Hero Section */}
      <section className="hero">
        <div className="container">
          <div className="hero-content">
            <h1 className="hero-title">
              Fundraising Software That Maximizes Your Revenue
            </h1>
            <p className="hero-subtitle">
              World-class auction and fundraising platform designed for nonprofits.
              Mobile bidding, real-time updates, and easy setup get your next event running in days, not weeks.
            </p>
            <div className="hero-cta">
              <Link to="/register/donor" className="btn btn-primary btn-large">
                Register as Donor
              </Link>
              <Link to="/register/npo" className="btn btn-secondary btn-large">
                Register Your NPO
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features">
        <div className="container">
          <h2 className="section-title text-center">Why Choose Fundrbolt?</h2>
          <p className="section-subtitle text-center">
            Everything you need to run a successful fundraising event
          </p>

          <div className="feature-grid">
            <div className="feature-card">
              <div className="feature-icon">📱</div>
              <h3 className="feature-title">Mobile Bidding</h3>
              <p className="feature-description">
                Silent auction bidding with push notifications from any device. Donors can track auctions throughout the event, increasing engagement and bids.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">⚡</div>
              <h3 className="feature-title">Real-Time Updates</h3>
              <p className="feature-description">
                Instant leaderboards and bid notifications keep the excitement high and donors engaged throughout your event.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">🚀</div>
              <h3 className="feature-title">Easy Setup</h3>
              <p className="feature-description">
                Get your event running in days, not weeks. Our intuitive platform requires minimal training and technical expertise.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">👥</div>
              <h3 className="feature-title">Professional Auctioneers</h3>
              <p className="feature-description">
                Connect with experienced auctioneers or bring your own. Our platform gives them the tools they need to succeed.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">💰</div>
              <h3 className="feature-title">Maximize Revenue</h3>
              <p className="feature-description">
                Proven to increase fundraising results by 40% compared to traditional methods through better engagement and reach.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">📊</div>
              <h3 className="feature-title">Powerful Analytics</h3>
              <p className="feature-description">
                Track performance in real-time and get detailed post-event reports to improve future fundraising efforts.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* User Types Section */}
      <section className="user-types">
        <div className="container">
          <h2 className="section-title text-center">Get Started Today</h2>
          <p className="section-subtitle text-center">
            Choose the path that's right for you
          </p>

          <div className="user-type-grid">
            <div className="user-type-card">
              <h3 className="user-type-title">For Donors</h3>
              <p className="user-type-description">
                Participate in auctions and support causes you care about. Easy mobile bidding from anywhere.
              </p>
              <Link to="/register/donor" className="btn btn-primary">
                Register as Donor
              </Link>
            </div>

            <div className="user-type-card">
              <h3 className="user-type-title">For Auctioneers</h3>
              <p className="user-type-description">
                Professional tools for managing live and silent auctions. Real-time controls at your fingertips.
              </p>
              <Link to="/register/auctioneer" className="btn btn-primary">
                Register as Auctioneer
              </Link>
            </div>

            <div className="user-type-card user-type-featured">
              <div className="featured-badge">Popular</div>
              <h3 className="user-type-title">For Nonprofits</h3>
              <p className="user-type-description">
                Launch your fundraising event in days. Everything you need to maximize revenue and donor engagement.
              </p>
              <Link to="/register/npo" className="btn btn-primary">
                Register Your NPO
              </Link>
            </div>
          </div>

          <div className="existing-user">
            <p>Already have an account?</p>
            <Link to="/login" className="btn btn-secondary">
              Login
            </Link>
          </div>
        </div>
      </section>

      {/* Social Proof Section */}
      <section className="social-proof">
        <div className="container">
          <div className="social-proof-content">
            <h2 className="social-proof-title">Trusted by Nonprofits Nationwide</h2>
            <p className="social-proof-text">
              Join hundreds of organizations raising millions for important causes
            </p>
            <Link to="/testimonials" className="btn btn-secondary">
              Read Success Stories
            </Link>
          </div>
        </div>
      </section>
    </>
  );
};
