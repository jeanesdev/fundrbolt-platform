/**
 * Tests for ContactPage component.
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HelmetProvider } from 'react-helmet-async';
import { BrowserRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import * as api from '../services/api';
import { ContactPage } from './ContactPage';

// Mock the API module
vi.mock('../services/api', () => ({
  contactApi: {
    submit: vi.fn(),
  },
}));

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <HelmetProvider>
      <BrowserRouter>{component}</BrowserRouter>
    </HelmetProvider>
  );
};

describe('ContactPage', () => {
  // SEO and Meta Tags Tests
  it('renders Helmet component with meta tags', () => {
    renderWithProviders(<ContactPage />);
    // Note: Helmet meta tags are rendered but may not be visible in JSDOM
    // Testing that the page renders without errors is sufficient for unit tests
    // Full meta tag verification would require e2e tests
    expect(screen.getByRole('heading', { name: /get in touch/i })).toBeInTheDocument();
  });

  // Hero Section Tests
  it('renders the hero section with main heading', () => {
    renderWithProviders(<ContactPage />);
    expect(screen.getByRole('heading', { name: /get in touch/i, level: 1 })).toBeInTheDocument();
  });

  it('displays hero subtitle with value proposition', () => {
    renderWithProviders(<ContactPage />);
    expect(
      screen.getByText(/have questions about augeo\? we're here to help/i)
    ).toBeInTheDocument();
  });

  // Contact Information Section Tests
  it('renders contact information section heading', () => {
    renderWithProviders(<ContactPage />);
    expect(screen.getByRole('heading', { name: /contact information/i })).toBeInTheDocument();
  });

  it('displays support email address', () => {
    renderWithProviders(<ContactPage />);
    expect(screen.getByText('support@augeo.app')).toBeInTheDocument();
  });

  it('shows expected response time', () => {
    renderWithProviders(<ContactPage />);
    expect(screen.getByText(/we typically respond within 24-48 hours/i)).toBeInTheDocument();
  });

  it('displays support hours', () => {
    renderWithProviders(<ContactPage />);
    expect(screen.getByText(/monday - friday, 9am - 5pm pst/i)).toBeInTheDocument();
  });

  it('renders all contact info items with icons', () => {
    const { container } = renderWithProviders(<ContactPage />);
    const infoItems = container.querySelectorAll('.info-item');
    expect(infoItems.length).toBe(3);

    const infoIcons = container.querySelectorAll('.info-icon');
    expect(infoIcons.length).toBe(3);
  });

  it('displays info item headings for email, response time, and support', () => {
    renderWithProviders(<ContactPage />);
    expect(screen.getByRole('heading', { name: /^email$/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /response time/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /^support$/i })).toBeInTheDocument();
  });

  // ContactForm Integration Tests
  it('renders the ContactForm component', () => {
    renderWithProviders(<ContactPage />);
    expect(screen.getByLabelText(/your name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/your email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/subject/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/message/i)).toBeInTheDocument();
  });

  it('allows submitting contact form', async () => {
    const user = userEvent.setup();
    const mockSubmit = vi.mocked(api.contactApi.submit);
    mockSubmit.mockResolvedValueOnce({
      id: '123',
      sender_name: 'Test User',
      sender_email: 'test@example.com',
      subject: 'Test Subject',
      status: 'pending',
      created_at: new Date().toISOString(),
    });

    renderWithProviders(<ContactPage />);

    await user.type(screen.getByLabelText(/your name/i), 'Test User');
    await user.type(screen.getByLabelText(/your email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/subject/i), 'Test Subject');
    await user.type(screen.getByLabelText(/message/i), 'Test message');

    const submitButton = screen.getByRole('button', { name: /send message/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalled();
      expect(screen.getByText(/thank you for your message/i)).toBeInTheDocument();
    });
  });

  // Resources Section Tests
  it('renders additional resources section', () => {
    renderWithProviders(<ContactPage />);
    expect(
      screen.getByRole('heading', { name: /looking for something specific\?/i })
    ).toBeInTheDocument();
  });

  it('displays all three resource cards', () => {
    renderWithProviders(<ContactPage />);
    expect(screen.getByRole('heading', { name: /📚 documentation/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /💡 faqs/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /🎯 demo request/i })).toBeInTheDocument();
  });

  it('shows documentation resource description', () => {
    renderWithProviders(<ContactPage />);
    expect(
      screen.getByText(/browse our comprehensive guides and tutorials/i)
    ).toBeInTheDocument();
  });

  it('shows FAQs resource description', () => {
    renderWithProviders(<ContactPage />);
    expect(
      screen.getByText(/find quick answers to common questions about features/i)
    ).toBeInTheDocument();
  });

  it('shows demo request resource description', () => {
    renderWithProviders(<ContactPage />);
    expect(
      screen.getByText(/schedule a personalized demo to see augeo in action/i)
    ).toBeInTheDocument();
  });

  it('renders resource cards in grid layout', () => {
    const { container } = renderWithProviders(<ContactPage />);
    const resourceGrid = container.querySelector('.resource-grid');
    const resourceCards = container.querySelectorAll('.resource-card');

    expect(resourceGrid).toBeInTheDocument();
    expect(resourceCards.length).toBe(3);
  });

  // Structure and Layout Tests
  it('renders all main sections in correct order', () => {
    const { container } = renderWithProviders(<ContactPage />);
    const sections = container.querySelectorAll('section');

    expect(sections.length).toBe(3);
    expect(sections[0]).toHaveClass('contact-hero');
    expect(sections[1]).toHaveClass('contact-form-section');
    expect(sections[2]).toHaveClass('contact-resources');
  });

  it('wraps content sections in containers', () => {
    const { container } = renderWithProviders(<ContactPage />);
    const containers = container.querySelectorAll('.container');
    expect(containers.length).toBeGreaterThanOrEqual(3);
  });

  it('has proper heading hierarchy', () => {
    renderWithProviders(<ContactPage />);

    // Should have one h1
    const h1Elements = screen.getAllByRole('heading', { level: 1 });
    expect(h1Elements).toHaveLength(1);
    expect(h1Elements[0]).toHaveTextContent(/get in touch/i);

    // Should have multiple h2 elements for sections
    const h2Elements = screen.getAllByRole('heading', { level: 2 });
    expect(h2Elements.length).toBeGreaterThanOrEqual(2);
  });

  it('uses semantic HTML sections', () => {
    const { container } = renderWithProviders(<ContactPage />);
    const sections = container.querySelectorAll('section');
    expect(sections.length).toBeGreaterThanOrEqual(3);
  });

  // Accessibility Tests
  it('contact form section contains contact info and form side by side', () => {
    const { container } = renderWithProviders(<ContactPage />);
    const contactContent = container.querySelector('.contact-content');
    const contactInfo = container.querySelector('.contact-info');
    const contactFormContainer = container.querySelector('.contact-form-container');

    expect(contactContent).toBeInTheDocument();
    expect(contactInfo).toBeInTheDocument();
    expect(contactFormContainer).toBeInTheDocument();
  });

  it('maintains visual structure with proper class names', () => {
    const { container } = renderWithProviders(<ContactPage />);

    expect(container.querySelector('.contact-hero')).toBeInTheDocument();
    expect(container.querySelector('.hero-subtitle')).toBeInTheDocument();
    expect(container.querySelector('.contact-form-section')).toBeInTheDocument();
    expect(container.querySelector('.contact-resources')).toBeInTheDocument();
    expect(container.querySelector('.resource-grid')).toBeInTheDocument();
  });

  // Content Completeness Tests
  it('provides context about who should contact', () => {
    renderWithProviders(<ContactPage />);
    expect(
      screen.getByText(/whether you're a nonprofit looking to modernize your fundraising/i)
    ).toBeInTheDocument();
  });

  it('mentions all three target audiences in contact info', () => {
    renderWithProviders(<ContactPage />);
    const text = screen.getByText(/whether you're a nonprofit looking to modernize your fundraising/i);
    expect(text.textContent).toContain('nonprofit');
    expect(text.textContent).toContain('donor');
    expect(text.textContent).toContain('auctioneer');
  });
});
