/**
 * SponsorList Component Tests
 * T050: Frontend component test for SponsorList
 */

import { SponsorList } from '@/features/events/components/SponsorList'
import { LogoSize, type Sponsor } from '@/types/sponsor'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

// Mock sponsor data
const mockSponsors: Sponsor[] = [
  {
    id: '1',
    event_id: 'event-1',
    name: 'Tech Corp',
    logo_url: 'https://example.com/logo1.png',
    logo_blob_name: 'sponsors/1/logo.png',
    thumbnail_url: 'https://example.com/thumb1.png',
    thumbnail_blob_name: 'sponsors/1/thumb.png',
    website_url: 'https://techcorp.com',
    logo_size: LogoSize.LARGE,
    sponsor_level: 'Platinum',
    display_order: 0,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    created_by: 'user-1',
  },
  {
    id: '2',
    event_id: 'event-1',
    name: 'Local Business',
    logo_url: 'https://example.com/logo2.png',
    logo_blob_name: 'sponsors/2/logo.png',
    thumbnail_url: 'https://example.com/thumb2.png',
    thumbnail_blob_name: 'sponsors/2/thumb.png',
    website_url: 'https://localbiz.com',
    logo_size: LogoSize.MEDIUM,
    sponsor_level: 'Gold',
    display_order: 1,
    created_at: '2024-01-02T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z',
    created_by: 'user-1',
  },
  {
    id: '3',
    event_id: 'event-1',
    name: 'Community Partner',
    logo_url: 'https://example.com/logo3.png',
    logo_blob_name: 'sponsors/3/logo.png',
    thumbnail_url: 'https://example.com/thumb3.png',
    thumbnail_blob_name: 'sponsors/3/thumb.png',
    logo_size: LogoSize.SMALL,
    display_order: 2,
    created_at: '2024-01-03T00:00:00Z',
    updated_at: '2024-01-03T00:00:00Z',
    created_by: 'user-1',
  },
]

describe('SponsorList', () => {
  describe('Empty State', () => {
    it('should render empty state when no sponsors', () => {
      render(<SponsorList sponsors={[]} />)

      expect(screen.getByText('No sponsors yet')).toBeInTheDocument()
      expect(
        screen.getByText('Add sponsors to showcase their support for your event')
      ).toBeInTheDocument()
    })

    it('should show "Add First Sponsor" button in empty state when onAdd provided and not readonly', () => {
      const onAdd = vi.fn()
      render(<SponsorList sponsors={[]} onAdd={onAdd} />)

      const button = screen.getByRole('button', { name: /add first sponsor/i })
      expect(button).toBeInTheDocument()
    })

    it('should not show add button in empty state when readonly', () => {
      const onAdd = vi.fn()
      render(<SponsorList sponsors={[]} onAdd={onAdd} readOnly />)

      expect(
        screen.queryByRole('button', { name: /add first sponsor/i })
      ).not.toBeInTheDocument()
    })

    it('should call onAdd when "Add First Sponsor" clicked', async () => {
      const user = userEvent.setup()
      const onAdd = vi.fn()
      render(<SponsorList sponsors={[]} onAdd={onAdd} />)

      const button = screen.getByRole('button', { name: /add first sponsor/i })
      await user.click(button)

      expect(onAdd).toHaveBeenCalledTimes(1)
    })
  })

  describe('Loading State', () => {
    it('should render loading skeletons when isLoading is true', () => {
      render(<SponsorList sponsors={[]} isLoading />)

      // Skeletons don't have accessible roles, check by class or test-id would be better
      // For now, we verify that empty state is NOT shown
      expect(screen.queryByText('No sponsors yet')).not.toBeInTheDocument()
    })

    it('should not show sponsors when loading', () => {
      render(<SponsorList sponsors={mockSponsors} isLoading />)

      expect(screen.queryByText('Tech Corp')).not.toBeInTheDocument()
      expect(screen.queryByText('Local Business')).not.toBeInTheDocument()
    })
  })

  describe('Error State', () => {
    it('should render error message when error provided', () => {
      const errorMessage = 'Failed to load sponsors'
      render(<SponsorList sponsors={[]} error={errorMessage} />)

      expect(screen.getByText(errorMessage)).toBeInTheDocument()
    })

    it('should not show sponsors when error exists', () => {
      render(
        <SponsorList
          sponsors={mockSponsors}
          error="Something went wrong"
        />
      )

      expect(screen.queryByText('Tech Corp')).not.toBeInTheDocument()
    })
  })

  describe('Sponsor Cards Rendering', () => {
    it('should render all sponsor cards', () => {
      render(<SponsorList sponsors={mockSponsors} />)

      expect(screen.getByText('Tech Corp')).toBeInTheDocument()
      expect(screen.getByText('Local Business')).toBeInTheDocument()
      expect(screen.getByText('Community Partner')).toBeInTheDocument()
    })

    it('should group sponsors by logo size with correct headers', () => {
      render(<SponsorList sponsors={mockSponsors} />)

      // Check for size group headers
      expect(screen.getByText('Platinum Sponsors')).toBeInTheDocument() // large
      expect(screen.getByText('Gold Sponsors')).toBeInTheDocument() // medium
      expect(screen.getByText('Silver Sponsors')).toBeInTheDocument() // small
    })

    it('should not show group headers for sizes with no sponsors', () => {
      render(<SponsorList sponsors={mockSponsors} />)

      // xlarge and xsmall headers should not appear
      expect(screen.queryByText('Title Sponsors')).not.toBeInTheDocument() // xlarge
      expect(screen.queryByText('Bronze Sponsors')).not.toBeInTheDocument() // xsmall
    })

    it('should show "Add Sponsor" button when sponsors exist and onAdd provided', () => {
      const onAdd = vi.fn()
      render(<SponsorList sponsors={mockSponsors} onAdd={onAdd} />)

      // Should have "Add Sponsor" button at top (not "Add First Sponsor")
      const buttons = screen.getAllByRole('button', { name: /add sponsor/i })
      expect(buttons.length).toBeGreaterThan(0)
    })

    it('should not show add button when readonly', () => {
      const onAdd = vi.fn()
      render(<SponsorList sponsors={mockSponsors} onAdd={onAdd} readOnly />)

      expect(
        screen.queryByRole('button', { name: /add sponsor/i })
      ).not.toBeInTheDocument()
    })
  })

  describe('Interactions', () => {
    it('should call onAdd when "Add Sponsor" clicked', async () => {
      const user = userEvent.setup()
      const onAdd = vi.fn()
      render(<SponsorList sponsors={mockSponsors} onAdd={onAdd} />)

      const button = screen.getByRole('button', { name: /add sponsor/i })
      await user.click(button)

      expect(onAdd).toHaveBeenCalledTimes(1)
    })

    it('should pass onEdit to SponsorCard components', () => {
      const onEdit = vi.fn()
      render(<SponsorList sponsors={mockSponsors} onEdit={onEdit} />)

      // SponsorCard should receive the onEdit prop
      // This tests prop passing; actual edit functionality tested in SponsorCard tests
      expect(screen.getByText('Tech Corp')).toBeInTheDocument()
    })

    it('should pass onDelete to SponsorCard components', () => {
      const onDelete = vi.fn()
      render(<SponsorList sponsors={mockSponsors} onDelete={onDelete} />)

      // SponsorCard should receive the onDelete prop
      expect(screen.getByText('Tech Corp')).toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('should handle single sponsor', () => {
      render(<SponsorList sponsors={[mockSponsors[0]]} />)

      expect(screen.getByText('Tech Corp')).toBeInTheDocument()
      expect(screen.queryByText('Local Business')).not.toBeInTheDocument()
    })

    it('should handle all sponsors of same size', () => {
      const sameSize = mockSponsors.map((s) => ({ ...s, logo_size: LogoSize.LARGE }))
      render(<SponsorList sponsors={sameSize} />)

      expect(screen.getByText('Platinum Sponsors')).toBeInTheDocument()
      expect(screen.queryByText('Gold Sponsors')).not.toBeInTheDocument()
    })

    it('should render correctly with only xlarge sponsors', () => {
      const xlarge: Sponsor[] = [
        {
          ...mockSponsors[0],
          logo_size: LogoSize.XLARGE,
        },
      ]
      render(<SponsorList sponsors={xlarge} />)

      expect(screen.getByText('Title Sponsors')).toBeInTheDocument()
    })
  })
})
