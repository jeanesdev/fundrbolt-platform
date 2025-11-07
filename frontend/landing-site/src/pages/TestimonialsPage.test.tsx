/**
 * Tests for TestimonialsPage component.
 */

import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
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
    quote_text: 'Great platform for donors!',
    author_name: 'John Donor',
    author_role: 'donor' as const,
    organization_name: null,
    photo_url: null,
    display_order: 1,
    is_published: true,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: '2',
    quote_text: 'Amazing for auctioneers!',
    author_name: 'Jane Auctioneer',
    author_role: 'auctioneer' as const,
    organization_name: 'Auction House',
    photo_url: null,
    display_order: 2,
    is_published: true,
    created_at: '2024-01-02T00:00:00Z',
  },
];

describe('TestimonialsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders page title', async () => {
    vi.spyOn(api.testimonialApi, 'list').mockResolvedValue(mockTestimonials);

    renderWithProviders(<TestimonialsPage />);

    expect(screen.getByRole('heading', { name: /success stories/i, level: 1 })).toBeInTheDocument();
  });

  it('loads and displays testimonials', async () => {
    vi.spyOn(api.testimonialApi, 'list').mockResolvedValue(mockTestimonials);

    renderWithProviders(<TestimonialsPage />);

    await waitFor(() => {
      expect(screen.getByText('Great platform for donors!')).toBeInTheDocument();
      expect(screen.getByText('Amazing for auctioneers!')).toBeInTheDocument();
    });
  });

  it('displays loading state initially', () => {
    vi.spyOn(api.testimonialApi, 'list').mockResolvedValue([]);

    renderWithProviders(<TestimonialsPage />);

    expect(screen.getByText(/loading testimonials/i)).toBeInTheDocument();
  });

  it('displays error state on API failure', async () => {
    vi.spyOn(api.testimonialApi, 'list').mockRejectedValue(new Error('API Error'));

    renderWithProviders(<TestimonialsPage />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/failed to load testimonials/i)).toBeInTheDocument();
    });
  });

  it('displays empty state when no testimonials', async () => {
    vi.spyOn(api.testimonialApi, 'list').mockResolvedValue([]);

    renderWithProviders(<TestimonialsPage />);

    await waitFor(() => {
      expect(screen.getByText(/no testimonials found/i)).toBeInTheDocument();
    });
  });

  it('renders all filter buttons', async () => {
    vi.spyOn(api.testimonialApi, 'list').mockResolvedValue(mockTestimonials);

    renderWithProviders(<TestimonialsPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /all stories/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^donors$/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /auctioneers/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /npos/i })).toBeInTheDocument();
    });
  });

  it('filters testimonials by role when filter button clicked', async () => {
    const user = userEvent.setup();
    const listSpy = vi.spyOn(api.testimonialApi, 'list');
    listSpy.mockResolvedValue(mockTestimonials);

    renderWithProviders(<TestimonialsPage />);

    await waitFor(() => {
      expect(screen.getByText('Great platform for donors!')).toBeInTheDocument();
    });

    // Click donor filter
    const donorButton = screen.getByRole('button', { name: /^donors$/i });
    await user.click(donorButton);

    await waitFor(() => {
      expect(listSpy).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'donor' })
      );
    });
  });

  it('resets to page 1 when filter changes', async () => {
    const user = userEvent.setup();
    const listSpy = vi.spyOn(api.testimonialApi, 'list');
    listSpy.mockResolvedValue(mockTestimonials);

    renderWithProviders(<TestimonialsPage />);

    await waitFor(() => {
      expect(screen.getByText('Great platform for donors!')).toBeInTheDocument();
    });

    // Change filter
    const donorButton = screen.getByRole('button', { name: /^donors$/i });
    await user.click(donorButton);

    await waitFor(() => {
      // Should call with offset 0 (page 1)
      expect(listSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({ offset: 0 })
      );
    });
  });

  it('renders pagination controls', async () => {
    vi.spyOn(api.testimonialApi, 'list').mockResolvedValue(mockTestimonials);

    renderWithProviders(<TestimonialsPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /previous/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument();
      expect(screen.getByText(/page 1/i)).toBeInTheDocument();
    });
  });

  it('disables previous button on first page', async () => {
    vi.spyOn(api.testimonialApi, 'list').mockResolvedValue(mockTestimonials);

    renderWithProviders(<TestimonialsPage />);

    await waitFor(() => {
      const prevButton = screen.getByRole('button', { name: /previous/i });
      expect(prevButton).toBeDisabled();
    });
  });

  it('disables next button when less than page size items returned', async () => {
    // Return only 2 items (less than page size of 10)
    vi.spyOn(api.testimonialApi, 'list').mockResolvedValue(mockTestimonials);

    renderWithProviders(<TestimonialsPage />);

    await waitFor(() => {
      const nextButton = screen.getByRole('button', { name: /next/i });
      expect(nextButton).toBeDisabled();
    });
  });

  it('renders CTA section with registration links', async () => {
    vi.spyOn(api.testimonialApi, 'list').mockResolvedValue(mockTestimonials);

    renderWithProviders(<TestimonialsPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /ready to create/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /register your npo/i })).toHaveAttribute('href', '/register/npo');
      expect(screen.getByRole('link', { name: /register as donor/i })).toHaveAttribute('href', '/register/donor');
    });
  });

  it('has proper ARIA labels on interactive elements', async () => {
    vi.spyOn(api.testimonialApi, 'list').mockResolvedValue(mockTestimonials);

    renderWithProviders(<TestimonialsPage />);

    await waitFor(() => {
      const filterGroup = screen.getByRole('group', { name: /filter testimonials by role/i });
      expect(filterGroup).toBeInTheDocument();

      const pagination = screen.getByRole('navigation', { name: /pagination/i });
      expect(pagination).toBeInTheDocument();
    });
  });

  it('marks active filter button with aria-pressed', async () => {
    vi.spyOn(api.testimonialApi, 'list').mockResolvedValue(mockTestimonials);

    renderWithProviders(<TestimonialsPage />);

    await waitFor(() => {
      const allStoriesButton = screen.getByRole('button', { name: /all stories/i });
      expect(allStoriesButton).toHaveAttribute('aria-pressed', 'true');
    });
  });
});
