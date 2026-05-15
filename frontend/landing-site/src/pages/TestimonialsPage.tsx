/**
 * TestimonialsPage - displays published testimonials with filtering and pagination.
 */

import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { TestimonialCard } from '../components/testimonials/TestimonialCard';
import { type Testimonial, testimonialApi } from '../services/api';
import './TestimonialsPage.css';

type RoleFilter = '' | 'donor' | 'auctioneer' | 'npo_admin';

const ITEMS_PER_PAGE = 10;

export const TestimonialsPage = () => {
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('');

  useEffect(() => {
    const fetchTestimonials = async () => {
      try {
        setLoading(true);

        const params = {
          limit: ITEMS_PER_PAGE,
          offset: (currentPage - 1) * ITEMS_PER_PAGE,
          ...(roleFilter && { role: roleFilter }),
        };

        const data = await testimonialApi.list(params);
        setTestimonials(data);
      } catch (err) {
        // Silently treat errors as empty — no error message shown to visitors
        // eslint-disable-next-line no-console
        console.error('Error fetching testimonials:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchTestimonials();
  }, [currentPage, roleFilter]);

  const handleFilterChange = (filter: RoleFilter) => {
    setRoleFilter(filter);
    setCurrentPage(1); // Reset to first page when filter changes
  };

  const handleNextPage = () => {
    if (testimonials.length === ITEMS_PER_PAGE) {
      setCurrentPage((prev) => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage((prev) => prev - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <>
      <Helmet>
        <title>Success Stories - FundrBolt Platform</title>
        <meta
          name="description"
          content="Hear from nonprofits, donors, and auctioneers who have transformed their fundraising with FundrBolt's mobile silent auction platform."
        />
        <meta property="og:title" content="Success Stories - FundrBolt Platform" />
        <meta
          property="og:description"
          content="Hear from nonprofits, donors, and auctioneers who have transformed their fundraising with FundrBolt's mobile silent auction platform."
        />
        <meta property="og:type" content="website" />
      </Helmet>

      {/* Hero Section */}
      <section className="testimonials-hero">
        <div className="container">
          <h1>Success Stories</h1>
          <p className="hero-subtitle">
            Hear from nonprofits, donors, and auctioneers who are transforming
            fundraising with FundrBolt
          </p>
        </div>
      </section>

      {/* Filter Section — hidden when there are no testimonials at all */}
      {(!loading && (testimonials.length > 0 || roleFilter !== '')) && (
      <section className="testimonials-filters">
        <div className="container">
          <div className="filter-buttons" role="group" aria-label="Filter testimonials by role">
            <button
              className={`filter-btn ${roleFilter === '' ? 'active' : ''}`}
              onClick={() => handleFilterChange('')}
              aria-pressed={roleFilter === ''}
            >
              All Stories
            </button>
            <button
              className={`filter-btn ${roleFilter === 'donor' ? 'active' : ''}`}
              onClick={() => handleFilterChange('donor')}
              aria-pressed={roleFilter === 'donor'}
            >
              Donors
            </button>
            <button
              className={`filter-btn ${roleFilter === 'auctioneer' ? 'active' : ''}`}
              onClick={() => handleFilterChange('auctioneer')}
              aria-pressed={roleFilter === 'auctioneer'}
            >
              Auctioneers
            </button>
            <button
              className={`filter-btn ${roleFilter === 'npo_admin' ? 'active' : ''}`}
              onClick={() => handleFilterChange('npo_admin')}
              aria-pressed={roleFilter === 'npo_admin'}
            >
              NPOs
            </button>
          </div>
        </div>
      </section>
      )}

      {/* Testimonials Grid — hidden when there are no testimonials at all */}
      {(!loading && (testimonials.length > 0 || roleFilter !== '')) && (
      <section className="testimonials-grid-section">
        <div className="container">
          {testimonials.length === 0 && (
            <div className="empty-state">
              <p>No stories found for this filter.</p>
            </div>
          )}

          {!loading && testimonials.length > 0 && (
            <div className="testimonials-grid">
              {testimonials.map((testimonial) => (
                <TestimonialCard
                  key={testimonial.id}
                  quote_text={testimonial.quote_text}
                  author_name={testimonial.author_name}
                  author_role={testimonial.author_role}
                  organization_name={testimonial.organization_name}
                  photo_url={testimonial.photo_url}
                />
              ))}
            </div>
          )}

          {/* Pagination - only show if there's more than one page */}
          {!loading &&
            testimonials.length > 0 &&
            (currentPage > 1 || testimonials.length === ITEMS_PER_PAGE) && (
              <div className="pagination" role="navigation" aria-label="Pagination">
                <button
                  className="pagination-btn"
                  onClick={handlePrevPage}
                  disabled={currentPage === 1}
                  aria-label="Go to previous page"
                >
                  ← Previous
                </button>
                <span className="pagination-info" aria-live="polite">
                  Page {currentPage}
                </span>
                <button
                  className="pagination-btn"
                  onClick={handleNextPage}
                  disabled={testimonials.length < ITEMS_PER_PAGE}
                  aria-label="Go to next page"
                >
                  Next →
                </button>
              </div>
            )}
        </div>
      </section>
      )}

      {/* CTA Section */}
      <section className="testimonials-cta">
        <div className="container">
          <h2>Ready to Create Your Own Success Story?</h2>
          <p>
            Join hundreds of nonprofits, donors, and auctioneers using FundrBolt to
            raise more funds and create unforgettable experiences.
          </p>
          <div className="cta-buttons">
            <a href="https://admin.fundrbolt.com/register-npo" className="btn btn-primary">
              Register Your NPO
            </a>
            <a href="https://app.fundrbolt.com/sign-up" className="btn btn-secondary">
              Register as Donor
            </a>
          </div>
        </div>
      </section>
    </>
  );
};
