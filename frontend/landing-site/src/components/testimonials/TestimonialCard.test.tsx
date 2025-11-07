/**
 * Tests for TestimonialCard component.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TestimonialCard } from './TestimonialCard';

describe('TestimonialCard', () => {
  it('renders quote text', () => {
    render(
      <TestimonialCard
        quote_text="This is a test quote"
        author_name="John Doe"
        author_role="donor"
        organization_name={null}
        photo_url={null}
      />
    );

    expect(screen.getByText('This is a test quote')).toBeInTheDocument();
  });

  it('renders author name', () => {
    render(
      <TestimonialCard
        quote_text="Test quote"
        author_name="Jane Smith"
        author_role="auctioneer"
        organization_name={null}
        photo_url={null}
      />
    );

    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
  });

  it('displays correct role label for donor', () => {
    render(
      <TestimonialCard
        quote_text="Test quote"
        author_name="John Doe"
        author_role="donor"
        organization_name={null}
        photo_url={null}
      />
    );

    expect(screen.getByText('Donor')).toBeInTheDocument();
  });

  it('displays correct role label for auctioneer', () => {
    render(
      <TestimonialCard
        quote_text="Test quote"
        author_name="Jane Smith"
        author_role="auctioneer"
        organization_name={null}
        photo_url={null}
      />
    );

    expect(screen.getByText('Auctioneer')).toBeInTheDocument();
  });

  it('displays correct role label for npo_admin', () => {
    render(
      <TestimonialCard
        quote_text="Test quote"
        author_name="Bob Johnson"
        author_role="npo_admin"
        organization_name="Test NPO"
        photo_url={null}
      />
    );

    expect(screen.getByText('NPO Administrator')).toBeInTheDocument();
  });

  it('displays organization name when provided', () => {
    render(
      <TestimonialCard
        quote_text="Test quote"
        author_name="Bob Johnson"
        author_role="npo_admin"
        organization_name="Charity Foundation"
        photo_url={null}
      />
    );

    expect(screen.getByText('Charity Foundation')).toBeInTheDocument();
  });

  it('does not display organization name when null', () => {
    const { container } = render(
      <TestimonialCard
        quote_text="Test quote"
        author_name="John Doe"
        author_role="donor"
        organization_name={null}
        photo_url={null}
      />
    );

    expect(container.querySelector('.author-organization')).not.toBeInTheDocument();
  });

  it('displays author photo when provided', () => {
    render(
      <TestimonialCard
        quote_text="Test quote"
        author_name="Jane Smith"
        author_role="donor"
        organization_name={null}
        photo_url="https://example.com/photo.jpg"
      />
    );

    const img = screen.getByRole('img', { name: 'Jane Smith profile' });
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'https://example.com/photo.jpg');
  });

  it('displays avatar with initial when no photo provided', () => {
    const { container } = render(
      <TestimonialCard
        quote_text="Test quote"
        author_name="Alice Brown"
        author_role="donor"
        organization_name={null}
        photo_url={null}
      />
    );

    const avatar = container.querySelector('.author-avatar');
    expect(avatar).toBeInTheDocument();
    expect(avatar).toHaveTextContent('A');
  });

  it('renders as article element for semantic HTML', () => {
    const { container } = render(
      <TestimonialCard
        quote_text="Test quote"
        author_name="John Doe"
        author_role="donor"
        organization_name={null}
        photo_url={null}
      />
    );

    expect(container.querySelector('article.testimonial-card')).toBeInTheDocument();
  });

  it('includes quote icon', () => {
    const { container } = render(
      <TestimonialCard
        quote_text="Test quote"
        author_name="John Doe"
        author_role="donor"
        organization_name={null}
        photo_url={null}
      />
    );

    const quoteIcon = container.querySelector('.quote-icon');
    expect(quoteIcon).toBeInTheDocument();
    expect(quoteIcon).toHaveAttribute('aria-hidden', 'true');
  });

  it('has proper heading hierarchy', () => {
    render(
      <TestimonialCard
        quote_text="Test quote"
        author_name="John Doe"
        author_role="donor"
        organization_name={null}
        photo_url={null}
      />
    );

    const heading = screen.getByRole('heading', { name: 'John Doe' });
    expect(heading).toBeInTheDocument();
    expect(heading.tagName).toBe('H3');
  });
});
