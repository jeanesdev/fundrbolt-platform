/**
 * ContactPage - Contact us page with form.
 */

import { Helmet } from 'react-helmet-async';
import { ContactForm } from '../components/forms/ContactForm';
import './ContactPage.css';

export const ContactPage = () => {
  return (
    <>
      <Helmet>
        <title>Contact Us - Augeo Platform</title>
        <meta
          name="description"
          content="Get in touch with the Augeo Platform team. We're here to help with questions about our mobile silent auction platform for nonprofits."
        />
        <meta property="og:title" content="Contact Us - Augeo Platform" />
        <meta
          property="og:description"
          content="Get in touch with the Augeo Platform team. We're here to help with questions about our mobile silent auction platform for nonprofits."
        />
        <meta property="og:type" content="website" />
      </Helmet>

      {/* Hero Section */}
      <section className="contact-hero">
        <div className="container">
          <h1>Get in Touch</h1>
          <p className="hero-subtitle">
            Have questions about Augeo? We're here to help. Send us a message and we'll get back to
            you as soon as possible.
          </p>
        </div>
      </section>

      {/* Contact Form Section */}
      <section className="contact-form-section">
        <div className="container">
          <div className="contact-content">
            <div className="contact-info">
              <h2>Contact Information</h2>
              <p>
                Whether you're a nonprofit looking to modernize your fundraising, a donor with
                questions, or an auctioneer interested in our platform, we'd love to hear from you.
              </p>

              <div className="info-items">
                <div className="info-item">
                  <div className="info-icon">📧</div>
                  <div>
                    <h3>Email</h3>
                    <p>support@augeo.app</p>
                  </div>
                </div>

                <div className="info-item">
                  <div className="info-icon">⏰</div>
                  <div>
                    <h3>Response Time</h3>
                    <p>We typically respond within 24-48 hours</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="contact-form-container">
              <ContactForm />
            </div>
          </div>
        </div>
      </section>

      {/* Additional Resources Section */}
      <section className="contact-resources">
        <div className="container">
          <h2>Looking for Something Specific?</h2>
          <div className="resource-grid">
            <div className="resource-card">
              <h3>📚 Documentation</h3>
              <p>Browse our comprehensive guides and tutorials for getting started with Augeo.</p>
            </div>
            <div className="resource-card">
              <h3>💡 FAQs</h3>
              <p>Find quick answers to common questions about features, pricing, and setup.</p>
            </div>
            <div className="resource-card">
              <h3>🎯 Demo Request</h3>
              <p>Schedule a personalized demo to see Augeo in action for your organization.</p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};
