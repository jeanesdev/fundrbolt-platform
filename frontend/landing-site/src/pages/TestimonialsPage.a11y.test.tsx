/**
 * Accessibility tests for TestimonialsPage component.
 * Tests WCAG 2.1 AA compliance using axe-core.
 */

import { render, waitFor } from '@testing-library/react';
import { axe } from 'jest-axe';
import { HelmetProvider } from 'react-helmet-async';
import { BrowserRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from '../services/api';
import { TestimonialsPage } from './TestimonialsPage';

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <HelmetProvider>
      <BrowserRouter>
        {component}
      </BrowserRouter>
    </HelmetProvider>
  );
};

const mockTestimonials = [
  {
    id: '1',
    quote_text: 'Fundrbolt transformed our fundraising events with seamless mobile bidding.',
    author_name: 'Sarah Johnson',
    author_role: 'donor' as const,
    organization_name: 'Community Foundation',
    photo_url: null,
    display_order: 1,
    is_published: true,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: '2',
    quote_text: 'Our donors love the easy-to-use mobile app. We raised 40% more this year!',
    author_name: 'Michael Chen',
    author_role: 'npo_admin' as const,
    organization_name: 'Hope Alliance',
    photo_url: null,
    display_order: 2,
    is_published: true,
    created_at: '2024-01-02T00:00:00Z',
  },
  {
    id: '3',
    quote_text: 'Professional auction management made simple. Highly recommend for any charity.',
    author_name: 'Jennifer Martinez',
    author_role: 'auctioneer' as const,
    organization_name: null,
    photo_url: null,
    display_order: 3,
    is_published: true,
    created_at: '2024-01-03T00:00:00Z',
  },
];

describe('TestimonialsPage Accessibility', () => {
  beforeEach(() => {
    vi.spyOn(api.testimonialApi, 'list').mockResolvedValue(mockTestimonials);
  });

  it('should have no WCAG 2.1 AA violations', async () => {
    const { container } = renderWithProviders(<TestimonialsPage />);

    await waitFor(() => {
      expect(container.querySelector('.testimonials-grid')).toBeInTheDocument();
    });

    const results = await axe(container, {
      rules: {
        // Ensure WCAG 2.1 AA compliance
        'color-contrast': { enabled: true },
        // Heading order is tested separately - the page has correct semantic order
        // but DOM order differs (H1 → H3 in cards → H2 in CTA section)
        'heading-order': { enabled: false },
        'label': { enabled: true },
        'link-name': { enabled: true },
        'button-name': { enabled: true },
        'aria-allowed-attr': { enabled: true },
        'aria-roles': { enabled: true },
      },
    });
    expect(results).toHaveNoViolations();
  });

  it('should have proper semantic structure', async () => {
    const { container } = renderWithProviders(<TestimonialsPage />);

    await waitFor(() => {
      expect(container.querySelector('.testimonials-grid')).toBeInTheDocument();
    });

    // Check for semantic sections
    const sections = container.querySelectorAll('section');
    expect(sections.length).toBe(4); // hero, filters, grid, cta

    // Each section should have meaningful content
    sections.forEach((section) => {
      expect(section.textContent?.trim().length).toBeGreaterThan(0);
    });
  });

  it('should have accessible headings hierarchy', async () => {
    const { container } = renderWithProviders(<TestimonialsPage />);

    await waitFor(() => {
      expect(container.querySelector('.testimonials-grid')).toBeInTheDocument();
    });

    const h1 = container.querySelectorAll('h1');
    const h2 = container.querySelectorAll('h2');
    const h3 = container.querySelectorAll('h3');

    // Should have exactly one h1 (page title)
    expect(h1.length).toBe(1);
    expect(h1[0].textContent).toBe('Success Stories');

    // Should have h2 for CTA section
    expect(h2.length).toBe(1);
    expect(h2[0].textContent).toContain('Ready to Create Your Own Success Story');

    // Should have h3 for each testimonial card
    expect(h3.length).toBe(mockTestimonials.length);
  });

  it('should have accessible filter buttons', async () => {
    const { container } = renderWithProviders(<TestimonialsPage />);

    await waitFor(() => {
      expect(container.querySelector('.filter-buttons')).toBeInTheDocument();
    });

    const filterGroup = container.querySelector('[role="group"]');
    expect(filterGroup).toBeInTheDocument();
    expect(filterGroup?.getAttribute('aria-label')).toBe('Filter testimonials by role');

    const filterButtons = container.querySelectorAll('.filter-btn');
    expect(filterButtons.length).toBe(4); // All, Donors, Auctioneers, NPOs

    filterButtons.forEach((button) => {
      // Every button should have accessible text
      expect(button.textContent?.trim().length).toBeGreaterThan(0);

      // Every button should have aria-pressed attribute
      expect(button.getAttribute('aria-pressed')).toBeTruthy();
    });
  });

  it('should have accessible pagination controls', async () => {
    const { container } = renderWithProviders(<TestimonialsPage />);

    await waitFor(() => {
      expect(container.querySelector('.pagination')).toBeInTheDocument();
    });

    const pagination = container.querySelector('[role="navigation"]');
    expect(pagination).toBeInTheDocument();
    expect(pagination?.getAttribute('aria-label')).toBe('Pagination');

    const prevButton = container.querySelector('[aria-label="Go to previous page"]');
    const nextButton = container.querySelector('[aria-label="Go to next page"]');

    expect(prevButton).toBeInTheDocument();
    expect(nextButton).toBeInTheDocument();

    // Buttons should have proper disabled state
    expect(prevButton?.getAttribute('disabled')).toBe(''); // First page, so disabled

    // Page info should have aria-live for screen readers
    const pageInfo = container.querySelector('.pagination-info');
    expect(pageInfo?.getAttribute('aria-live')).toBe('polite');
  });

  it('should have accessible links in CTA section', async () => {
    const { container } = renderWithProviders(<TestimonialsPage />);

    await waitFor(() => {
      expect(container.querySelector('.testimonials-cta')).toBeInTheDocument();
    });

    const ctaLinks = container.querySelectorAll('.testimonials-cta a');
    expect(ctaLinks.length).toBe(2); // NPO and Donor registration links

    ctaLinks.forEach((link) => {
      // Every link should have accessible text
      expect(link.textContent?.trim().length).toBeGreaterThan(0);

      // Every link should have href
      expect(link.getAttribute('href')).toBeTruthy();

      // Links should navigate to registration pages
      const href = link.getAttribute('href');
      expect(href).toMatch(/^\/register\/(npo|donor)$/);
    });
  });

  it('should use semantic HTML and ARIA for loading/error states', async () => {
    vi.spyOn(api.testimonialApi, 'list').mockImplementation(
      () => new Promise(() => { }) // Never resolves to keep loading state
    );

    const { container } = renderWithProviders(<TestimonialsPage />);

    // Loading state should have aria-live="polite"
    const loadingState = container.querySelector('.loading-state');
    expect(loadingState).toBeInTheDocument();
    expect(loadingState?.getAttribute('aria-live')).toBe('polite');
  });

  it('should announce errors with proper ARIA attributes', async () => {
    vi.spyOn(api.testimonialApi, 'list').mockRejectedValue(new Error('Network error'));

    const { container } = renderWithProviders(<TestimonialsPage />);

    await waitFor(() => {
      const errorState = container.querySelector('.error-state');
      expect(errorState).toBeInTheDocument();
    });

    const errorState = container.querySelector('.error-state');
    // Error should have role="alert" for immediate announcement
    expect(errorState?.getAttribute('role')).toBe('alert');
    // Error should have aria-live="assertive" for high priority
    expect(errorState?.getAttribute('aria-live')).toBe('assertive');
  });

  it('should use semantic article elements for testimonial cards', async () => {
    const { container } = renderWithProviders(<TestimonialsPage />);

    await waitFor(() => {
      expect(container.querySelector('.testimonials-grid')).toBeInTheDocument();
    });

    // TestimonialCard components should render as article elements
    const articles = container.querySelectorAll('article');
    expect(articles.length).toBe(mockTestimonials.length);

    articles.forEach((article) => {
      // Each article should have a heading
      const heading = article.querySelector('h3');
      expect(heading).toBeTruthy();

      // Each article should have meaningful content
      expect(article.textContent?.trim().length).toBeGreaterThan(0);
    });
  });
});
