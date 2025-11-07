/**
 * Tests for AboutPage component.
 */

import { render, screen } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { BrowserRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AboutPage } from './AboutPage';

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <HelmetProvider>
      <BrowserRouter>
        {component}
      </BrowserRouter>
    </HelmetProvider>
  );
};

describe('AboutPage', () => {
  it('renders the page title', () => {
    renderWithProviders(<AboutPage />);
    expect(screen.getByRole('heading', { name: /about augeo/i, level: 1 })).toBeInTheDocument();
  });

  it('renders the mission statement section', () => {
    renderWithProviders(<AboutPage />);
    expect(screen.getByRole('heading', { name: /our mission/i })).toBeInTheDocument();
    expect(screen.getByText(/empower nonprofits/i)).toBeInTheDocument();
  });

  it('renders all platform features', () => {
    renderWithProviders(<AboutPage />);
    expect(screen.getByRole('heading', { name: /mobile bidding/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /real-time updates/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /easy setup/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /maximize revenue/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /powerful analytics/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /secure & reliable/i })).toBeInTheDocument();
  });

  it('renders user type benefits section', () => {
    renderWithProviders(<AboutPage />);
    expect(screen.getByRole('heading', { name: /built for everyone/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /for donors/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /for auctioneers/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /for nonprofits/i })).toBeInTheDocument();
  });

  it('renders donor benefits', () => {
    renderWithProviders(<AboutPage />);
    expect(screen.getByText(/bid from anywhere on your phone/i)).toBeInTheDocument();
    expect(screen.getByText(/receive instant outbid notifications/i)).toBeInTheDocument();
  });

  it('renders auctioneer benefits', () => {
    renderWithProviders(<AboutPage />);
    expect(screen.getByText(/professional tools for managing events/i)).toBeInTheDocument();
    expect(screen.getByText(/real-time bidding analytics dashboard/i)).toBeInTheDocument();
  });

  it('renders nonprofit benefits', () => {
    renderWithProviders(<AboutPage />);
    expect(screen.getByText(/no upfront costs/i)).toBeInTheDocument();
    expect(screen.getByText(/quick setup with minimal training/i)).toBeInTheDocument();
  });

  it('renders CTA section with registration links', () => {
    renderWithProviders(<AboutPage />);
    expect(screen.getByRole('heading', { name: /ready to transform/i })).toBeInTheDocument();

    const npoLink = screen.getByRole('link', { name: /register your npo/i });
    const donorLink = screen.getByRole('link', { name: /register as donor/i });

    expect(npoLink).toHaveAttribute('href', '/register/npo');
    expect(donorLink).toHaveAttribute('href', '/register/donor');
  });

  it('has proper heading hierarchy', () => {
    renderWithProviders(<AboutPage />);

    // Should have one h1
    const h1Elements = screen.getAllByRole('heading', { level: 1 });
    expect(h1Elements).toHaveLength(1);

    // Should have multiple h2 elements for sections
    const h2Elements = screen.getAllByRole('heading', { level: 2 });
    expect(h2Elements.length).toBeGreaterThan(3);
  });

  it('renders feature icons', () => {
    const { container } = renderWithProviders(<AboutPage />);
    const featureIcons = container.querySelectorAll('.feature-icon');
    expect(featureIcons.length).toBe(6);
  });

  it('highlights the NPO benefit card as featured', () => {
    const { container } = renderWithProviders(<AboutPage />);
    const featuredCards = container.querySelectorAll('.benefit-card.featured');
    expect(featuredCards.length).toBe(1);
  });

  it('renders all sections in correct order', () => {
    const { container } = renderWithProviders(<AboutPage />);

    const sections = container.querySelectorAll('section');
    expect(sections.length).toBeGreaterThanOrEqual(5);

    expect(sections[0]).toHaveClass('about-hero');
    expect(sections[1]).toHaveClass('mission-section');
    expect(sections[2]).toHaveClass('features-section');
    expect(sections[3]).toHaveClass('benefits-section');
    expect(sections[4]).toHaveClass('cta-section');
  });
});
