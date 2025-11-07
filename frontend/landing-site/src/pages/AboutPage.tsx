import { Helmet } from 'react-helmet-async';
import './AboutPage.css';

export const AboutPage = () => {
  return (
    <>
      <Helmet>
        <title>About Us - Augeo Platform</title>
        <meta
          name="description"
          content="Learn about Augeo's mission to revolutionize charitable fundraising through innovative silent auction technology."
        />
        <meta property="og:title" content="About Us - Augeo Platform" />
        <meta
          property="og:description"
          content="Learn about Augeo's mission to revolutionize charitable fundraising through innovative silent auction technology."
        />
        <meta property="og:type" content="website" />
      </Helmet>

      {/* Hero Section */}
      <section className="about-hero">
        <div className="container">
          <h1>About Augeo</h1>
          <p className="hero-subtitle">
            Revolutionizing charitable fundraising through innovative technology
          </p>
        </div>
      </section>

      {/* Mission Statement */}
      <section className="mission-section">
        <div className="container">
          <h2>Our Mission</h2>
          <p className="mission-text">
            At Augeo, we believe that every nonprofit organization deserves access to
            powerful, easy-to-use fundraising tools. Our mission is to empower nonprofits
            to maximize their impact by providing a modern, mobile-first silent auction
            platform that makes fundraising events seamless, engaging, and successful.
          </p>
          <p className="mission-text">
            We're committed to removing the barriers that prevent nonprofits from
            reaching their full fundraising potential. By combining cutting-edge
            technology with deep understanding of nonprofit needs, we're transforming
            how charitable organizations connect with donors and achieve their goals.
          </p>
        </div>
      </section>

      {/* Platform Features Section */}
      <section className="features-section">
        <div className="container">
          <h2>Platform Features</h2>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">📱</div>
              <h3>Mobile Bidding</h3>
              <p>
                Donors can bid from anywhere using their smartphones. No apps to download,
                no complicated setup - just simple, intuitive mobile bidding that works
                on any device.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">⚡</div>
              <h3>Real-Time Updates</h3>
              <p>
                See bids as they happen with live updates. Donors get instant notifications
                when they're outbid, creating excitement and encouraging engagement
                throughout your event.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">🎯</div>
              <h3>Easy Setup</h3>
              <p>
                Create your auction in minutes, not hours. Our intuitive interface makes
                it simple to add items, set starting bids, and customize your event to
                match your organization's brand.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">💰</div>
              <h3>Maximize Revenue</h3>
              <p>
                Increase donations with features designed to boost engagement: proxy
                bidding, outbid notifications, and mobile-optimized checkout that makes
                giving effortless.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">📊</div>
              <h3>Powerful Analytics</h3>
              <p>
                Track your auction performance in real-time with comprehensive analytics.
                Understand donor behavior, identify top items, and make data-driven
                decisions for future events.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">🔒</div>
              <h3>Secure & Reliable</h3>
              <p>
                Built with enterprise-grade security. Your donor data is protected with
                encryption, secure payment processing, and compliance with all major
                data protection regulations.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* User Type Benefits Section */}
      <section className="benefits-section">
        <div className="container">
          <h2>Built for Everyone</h2>
          <div className="benefits-grid">
            <div className="benefit-card">
              <h3>For Donors</h3>
              <ul>
                <li>Bid from anywhere on your phone</li>
                <li>Receive instant outbid notifications</li>
                <li>Simple, secure checkout process</li>
                <li>View auction history and receipts</li>
                <li>Support causes you care about effortlessly</li>
              </ul>
            </div>

            <div className="benefit-card">
              <h3>For Auctioneers</h3>
              <ul>
                <li>Professional tools for managing events</li>
                <li>Real-time bidding analytics dashboard</li>
                <li>Streamlined check-in and checkout</li>
                <li>Automatic bid tracking and winner notifications</li>
                <li>Expert support throughout your event</li>
              </ul>
            </div>

            <div className="benefit-card featured">
              <h3>For Nonprofits</h3>
              <ul>
                <li>No upfront costs - only pay when you succeed</li>
                <li>Quick setup with minimal training</li>
                <li>Branded auction experience for your donors</li>
                <li>Comprehensive reporting and analytics</li>
                <li>Dedicated support from setup to settlement</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="container">
          <h2>Ready to Transform Your Fundraising?</h2>
          <p>
            Join hundreds of nonprofits already using Augeo to raise more money and
            create unforgettable fundraising experiences.
          </p>
          <div className="cta-buttons">
            <a href="/register/npo" className="btn btn-primary">
              Register Your NPO
            </a>
            <a href="/register/donor" className="btn btn-secondary">
              Register as Donor
            </a>
          </div>
        </div>
      </section>
    </>
  );
};
