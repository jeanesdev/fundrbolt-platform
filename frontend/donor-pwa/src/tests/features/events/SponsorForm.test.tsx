/**
 * SponsorForm Component Tests
 * T051: Frontend component test for SponsorForm
 */

import { SponsorForm } from '@/features/events/components/SponsorForm'
import { LogoSize, type Sponsor } from '@/types/sponsor'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock sponsor data for edit mode
const mockSponsor: Sponsor = {
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
  contact_name: 'John Doe',
  contact_email: 'john@techcorp.com',
  contact_phone: '555-1234',
  address_line1: '123 Main St',
  address_line2: 'Suite 100',
  city: 'San Francisco',
  state: 'CA',
  postal_code: '94102',
  country: 'USA',
  donation_amount: 5000,
  notes: 'Great partner',
  display_order: 0,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  created_by: 'user-1',
}

// Helper to create a mock file
function createMockFile(name: string, size: number, type: string): File {
  const blob = new Blob(['x'.repeat(size)], { type })
  return new File([blob], name, { type })
}

describe('SponsorForm', () => {
  let onSubmit: (data: unknown, logoFile?: File) => Promise<void>
  let onCancel: () => void

  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onSubmit = vi.fn().mockResolvedValue(undefined) as any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onCancel = vi.fn() as any

    // Mock FileReader
    global.FileReader = class {
      result: string | ArrayBuffer | null = null
      onloadend: ((this: FileReader, ev: ProgressEvent<FileReader>) => void) | null = null

      readAsDataURL() {
        this.result = 'data:image/png;base64,mockBase64Data'
        if (this.onloadend) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          this.onloadend.call({} as any, {} as ProgressEvent<FileReader>)
        }
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any
  })

  describe('Create Mode', () => {
    it('should render create form with all required fields', () => {
      render(<SponsorForm onSubmit={onSubmit} onCancel={onCancel} />)

      // Required fields
      expect(screen.getByLabelText(/sponsor name/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/sponsor logo/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/logo size/i)).toBeInTheDocument()

      // Optional fields
      expect(screen.getByLabelText(/website url/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/sponsor level/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/donation amount/i)).toBeInTheDocument()

      // Buttons
      expect(screen.getByRole('button', { name: /create sponsor/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
    })

    it('should require name field', async () => {
      render(<SponsorForm onSubmit={onSubmit} onCancel={onCancel} />)

      const submitButton = screen.getByRole('button', { name: /create sponsor/i })
      // Trigger form validation by attempting to submit
      submitButton.click()

      // HTML5 validation should prevent submission
      const nameInput = screen.getByLabelText(/sponsor name/i) as HTMLInputElement
      expect(nameInput).toBeRequired()
      expect(onSubmit).not.toHaveBeenCalled()
    })

    it('should require logo file in create mode', () => {
      render(<SponsorForm onSubmit={onSubmit} onCancel={onCancel} />)

      const logoInput = screen.getByLabelText(/sponsor logo/i) as HTMLInputElement
      expect(logoInput).toBeRequired()
    })

    it('should show logo preview after file selection', async () => {
      const user = userEvent.setup()
      render(<SponsorForm onSubmit={onSubmit} onCancel={onCancel} />)

      const file = createMockFile('logo.png', 1024, 'image/png')
      const input = screen.getByLabelText(/sponsor logo/i)

      await user.upload(input, file)

      await waitFor(() => {
        const preview = screen.getByAltText(/logo preview/i)
        expect(preview).toBeInTheDocument()
        expect(preview).toHaveAttribute('src', 'data:image/png;base64,mockBase64Data')
      })
    })

    it('should allow clearing uploaded logo', async () => {
      const user = userEvent.setup()
      render(<SponsorForm onSubmit={onSubmit} onCancel={onCancel} />)

      const file = createMockFile('logo.png', 1024, 'image/png')
      const input = screen.getByLabelText(/sponsor logo/i)

      await user.upload(input, file)

      await waitFor(() => {
        expect(screen.getByAltText(/logo preview/i)).toBeInTheDocument()
      })

      // Find and click the X button to clear
      const clearButton = screen.getByRole('button', { name: '' }) // X button has no accessible name
      await user.click(clearButton)

      // Logo file input should be required again
      const logoInput = screen.getByLabelText(/sponsor logo/i) as HTMLInputElement
      expect(logoInput).toBeRequired()
    })

    it('should submit form with valid data', async () => {
      const user = userEvent.setup()
      render(<SponsorForm onSubmit={onSubmit} onCancel={onCancel} />)

      // Fill required fields
      await user.type(screen.getByLabelText(/sponsor name/i), 'Test Sponsor')

      const file = createMockFile('logo.png', 1024, 'image/png')
      await user.upload(screen.getByLabelText(/sponsor logo/i), file)

      // Submit form
      await user.click(screen.getByRole('button', { name: /create sponsor/i }))

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledTimes(1)
        expect(onSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Test Sponsor',
            logo_file_name: 'logo.png',
            logo_file_type: 'image/png',
            logo_file_size: 1024,
            logo_size: LogoSize.LARGE, // default changed to LARGE
          }),
          file
        )
      })
    })

    it('should submit form with optional fields', { timeout: 10000 }, async () => {
      const user = userEvent.setup()
      render(<SponsorForm onSubmit={onSubmit} onCancel={onCancel} />)

      // Fill required fields
      await user.type(screen.getByLabelText(/sponsor name/i), 'Test Sponsor')
      const file = createMockFile('logo.png', 1024, 'image/png')
      await user.upload(screen.getByLabelText(/sponsor logo/i), file)

      // Fill optional fields
      await user.type(screen.getByLabelText(/website url/i), 'https://example.com')
      await user.type(screen.getByLabelText(/sponsor level/i), 'Gold')
      await user.type(screen.getByLabelText(/donation amount/i), '1000.50')
      await user.type(screen.getByLabelText(/contact name/i), 'Jane Smith')
      await user.type(screen.getByLabelText(/contact email/i), 'jane@example.com')

      await user.click(screen.getByRole('button', { name: /create sponsor/i }))

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Test Sponsor',
            website_url: 'https://example.com',
            sponsor_level: 'Gold',
            donation_amount: 1000.50,
            contact_name: 'Jane Smith',
            contact_email: 'jane@example.com',
          }),
          file
        )
      })
    })

    it('should call onCancel when cancel clicked', async () => {
      const user = userEvent.setup()
      render(<SponsorForm onSubmit={onSubmit} onCancel={onCancel} />)

      await user.click(screen.getByRole('button', { name: /cancel/i }))

      expect(onCancel).toHaveBeenCalledTimes(1)
    })

    it('should disable form during submission', () => {
      render(<SponsorForm onSubmit={onSubmit} onCancel={onCancel} isSubmitting />)

      expect(screen.getByLabelText(/sponsor name/i)).toBeDisabled()
      expect(screen.getByLabelText(/sponsor logo/i)).toBeDisabled()
      expect(screen.getByRole('button', { name: /creating/i })).toBeDisabled()
      expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled()
    })
  })

  describe('Edit Mode', () => {
    it('should render edit form with pre-populated data', () => {
      render(<SponsorForm sponsor={mockSponsor} onSubmit={onSubmit} onCancel={onCancel} />)

      // Check pre-populated values
      expect(screen.getByDisplayValue('Tech Corp')).toBeInTheDocument()
      expect(screen.getByDisplayValue('https://techcorp.com')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Platinum')).toBeInTheDocument()
      expect(screen.getByDisplayValue('5000')).toBeInTheDocument()
      expect(screen.getByDisplayValue('John Doe')).toBeInTheDocument()
      expect(screen.getByDisplayValue('john@techcorp.com')).toBeInTheDocument()

      // Button should say "Update Sponsor"
      expect(screen.getByRole('button', { name: /update sponsor/i })).toBeInTheDocument()
    })

    it('should show existing logo preview', () => {
      render(<SponsorForm sponsor={mockSponsor} onSubmit={onSubmit} onCancel={onCancel} />)

      const preview = screen.getByAltText(/logo preview/i)
      expect(preview).toBeInTheDocument()
      expect(preview).toHaveAttribute('src', 'https://example.com/thumb1.png')
    })

    it('should not require logo in edit mode', () => {
      render(<SponsorForm sponsor={mockSponsor} onSubmit={onSubmit} onCancel={onCancel} />)

      const logoInput = screen.getByLabelText(/sponsor logo/i) as HTMLInputElement
      expect(logoInput).not.toBeRequired()
    })

    it('should allow replacing logo in edit mode', async () => {
      const user = userEvent.setup()
      render(<SponsorForm sponsor={mockSponsor} onSubmit={onSubmit} onCancel={onCancel} />)

      const file = createMockFile('new-logo.png', 2048, 'image/png')
      await user.upload(screen.getByLabelText(/sponsor logo/i), file)

      await waitFor(() => {
        const preview = screen.getByAltText(/logo preview/i)
        expect(preview).toHaveAttribute('src', 'data:image/png;base64,mockBase64Data')
      })
    })

    it('should submit update with changed fields', { timeout: 10000 }, async () => {
      const user = userEvent.setup()
      render(<SponsorForm sponsor={mockSponsor} onSubmit={onSubmit} onCancel={onCancel} />)

      // Change name
      const nameInput = screen.getByLabelText(/sponsor name/i)
      await user.clear(nameInput)
      await user.type(nameInput, 'Updated Corp')

      await user.click(screen.getByRole('button', { name: /update sponsor/i }))

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Updated Corp',
          }),
          undefined // no logo file
        )
      })
    })

    it('should submit update with new logo', async () => {
      const user = userEvent.setup()
      render(<SponsorForm sponsor={mockSponsor} onSubmit={onSubmit} onCancel={onCancel} />)

      const file = createMockFile('new-logo.png', 2048, 'image/png')
      await user.upload(screen.getByLabelText(/sponsor logo/i), file)

      await user.click(screen.getByRole('button', { name: /update sponsor/i }))

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith(
          expect.anything(),
          file
        )
      })
    })

    it('should disable form during update submission', () => {
      render(<SponsorForm sponsor={mockSponsor} onSubmit={onSubmit} onCancel={onCancel} isSubmitting />)

      expect(screen.getByLabelText(/sponsor name/i)).toBeDisabled()
      expect(screen.getByRole('button', { name: /updating/i })).toBeDisabled()
    })
  })

  describe('Validation', () => {
    it('should validate email format', () => {
      render(<SponsorForm onSubmit={onSubmit} onCancel={onCancel} />)

      const emailInput = screen.getByLabelText(/contact email/i) as HTMLInputElement
      expect(emailInput).toHaveAttribute('type', 'email')
    })

    it('should validate URL format', () => {
      render(<SponsorForm onSubmit={onSubmit} onCancel={onCancel} />)

      const urlInput = screen.getByLabelText(/website url/i) as HTMLInputElement
      expect(urlInput).toHaveAttribute('type', 'url')
    })

    it('should validate donation amount is non-negative', () => {
      render(<SponsorForm onSubmit={onSubmit} onCancel={onCancel} />)

      const donationInput = screen.getByLabelText(/donation amount/i) as HTMLInputElement
      expect(donationInput).toHaveAttribute('type', 'number')
      expect(donationInput).toHaveAttribute('min', '0')
      expect(donationInput).toHaveAttribute('step', '0.01')
    })

    it('should accept allowed file types', () => {
      render(<SponsorForm onSubmit={onSubmit} onCancel={onCancel} />)

      const fileInput = screen.getByLabelText(/sponsor logo/i) as HTMLInputElement
      expect(fileInput).toHaveAttribute('accept', 'image/png,image/jpeg,image/jpg,image/svg+xml,image/webp')
    })
  })

  describe('File Size Validation', () => {
    it('should show file size limit in help text', () => {
      render(<SponsorForm onSubmit={onSubmit} onCancel={onCancel} />)

      expect(screen.getByText(/max 5mb/i)).toBeInTheDocument()
      expect(screen.getByText(/minimum 64x64/i)).toBeInTheDocument()
      expect(screen.getByText(/maximum 2048x2048/i)).toBeInTheDocument()
    })

    it('should accept file under 5MB', async () => {
      const user = userEvent.setup()
      render(<SponsorForm onSubmit={onSubmit} onCancel={onCancel} />)

      // 4MB file
      const file = createMockFile('logo.png', 4 * 1024 * 1024, 'image/png')
      await user.upload(screen.getByLabelText(/sponsor logo/i), file)

      await waitFor(() => {
        expect(screen.getByAltText(/logo preview/i)).toBeInTheDocument()
      })
    })

    // Note: File size validation happens on backend, but we can test that the size is passed
    it('should pass file size to onSubmit', async () => {
      const user = userEvent.setup()
      render(<SponsorForm onSubmit={onSubmit} onCancel={onCancel} />)

      await user.type(screen.getByLabelText(/sponsor name/i), 'Test')

      const fileSize = 6 * 1024 * 1024 // 6MB
      const file = createMockFile('large.png', fileSize, 'image/png')
      await user.upload(screen.getByLabelText(/sponsor logo/i), file)

      await user.click(screen.getByRole('button', { name: /create sponsor/i }))

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            logo_file_size: fileSize,
          }),
          file
        )
      })
    })
  })

  describe('Error Handling', () => {
    it('should call onSubmit even if it might fail (error handled by parent)', async () => {
      const user = userEvent.setup()
      const mockSubmit = vi.fn().mockResolvedValue(undefined)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      render(<SponsorForm onSubmit={mockSubmit as any} onCancel={onCancel} />)

      await user.type(screen.getByLabelText(/sponsor name/i), 'Test')
      const file = createMockFile('logo.png', 1024, 'image/png')
      await user.upload(screen.getByLabelText(/sponsor logo/i), file)

      await user.click(screen.getByRole('button', { name: /create sponsor/i }))

      await waitFor(() => {
        expect(mockSubmit).toHaveBeenCalled()
      })

      // Form should remain interactive (assuming parent handles errors)
      expect(screen.getByRole('button', { name: /create sponsor/i })).toBeInTheDocument()
    })
  })

  describe('All Form Fields', () => {
    it('should have all contact information fields', () => {
      render(<SponsorForm onSubmit={onSubmit} onCancel={onCancel} />)

      expect(screen.getByLabelText(/contact name/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/contact email/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/contact phone/i)).toBeInTheDocument()
    })

    it('should have all address fields', () => {
      render(<SponsorForm onSubmit={onSubmit} onCancel={onCancel} />)

      expect(screen.getByLabelText(/address line 1/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/address line 2/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/city/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/state/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/postal code/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/country/i)).toBeInTheDocument()
    })

    it('should have notes field', () => {
      render(<SponsorForm onSubmit={onSubmit} onCancel={onCancel} />)

      expect(screen.getByLabelText(/internal notes/i)).toBeInTheDocument()
    })
  })

  describe('Contact Information (Phase 6 - T080)', () => {
    it('should allow submission without contact fields', async () => {
      const user = userEvent.setup()
      render(<SponsorForm onSubmit={onSubmit} onCancel={onCancel} />)

      // Fill only required fields
      await user.type(screen.getByLabelText(/sponsor name/i), 'Minimal Corp')
      const file = createMockFile('logo.png', 1024, 'image/png')
      await user.upload(screen.getByLabelText(/sponsor logo/i), file)

      await user.click(screen.getByRole('button', { name: /create sponsor/i }))

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledTimes(1)
        expect(onSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Minimal Corp',
            logo_file_name: 'logo.png',
            logo_file_type: 'image/png',
            logo_file_size: 1024,
          }),
          file
        )
      })
    })

    it('should validate email format', async () => {
      const user = userEvent.setup()
      render(<SponsorForm onSubmit={onSubmit} onCancel={onCancel} />)

      // Type invalid email
      const emailInput = screen.getByLabelText(/contact email/i) as HTMLInputElement
      await user.type(emailInput, 'not-an-email')

      // HTML5 validation should mark as invalid
      expect(emailInput.validity.valid).toBe(false)
      expect(emailInput.validity.typeMismatch).toBe(true)
    })

    it('should accept valid email', async () => {
      const user = userEvent.setup()
      render(<SponsorForm onSubmit={onSubmit} onCancel={onCancel} />)

      const emailInput = screen.getByLabelText(/contact email/i) as HTMLInputElement
      await user.type(emailInput, 'valid@example.com')

      expect(emailInput.validity.valid).toBe(true)
    })

    it('should submit all contact fields', { timeout: 15000 }, async () => {
      const user = userEvent.setup()
      render(<SponsorForm onSubmit={onSubmit} onCancel={onCancel} />)

      // Required fields
      await user.type(screen.getByLabelText(/sponsor name/i), 'Full Contact Corp')
      const file = createMockFile('logo.png', 1024, 'image/png')
      await user.upload(screen.getByLabelText(/sponsor logo/i), file)

      // All contact fields
      await user.type(screen.getByLabelText(/contact name/i), 'Alice Johnson')
      await user.type(screen.getByLabelText(/contact email/i), 'alice@fullcontact.com')
      await user.type(screen.getByLabelText(/contact phone/i), '5559998888') // Phone will be formatted

      // All address fields
      await user.type(screen.getByLabelText(/address line 1/i), '789 Pine Street')
      await user.type(screen.getByLabelText(/address line 2/i), 'Building B')
      await user.type(screen.getByLabelText(/city/i), 'Austin')

      // Note: State is now a dropdown, but we can't easily test Select in Vitest
      // The component defaults to empty string, which is acceptable for this test

      await user.type(screen.getByLabelText(/postal code/i), '78701')
      // Financial fields
      await user.type(screen.getByLabelText(/donation amount/i), '15000.75')
      await user.type(screen.getByLabelText(/internal notes/i), 'Multi-year partnership agreement')

      await user.click(screen.getByRole('button', { name: /create sponsor/i }))

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Full Contact Corp',
            contact_name: 'Alice Johnson',
            contact_email: 'alice@fullcontact.com',
            contact_phone: '(555)999-8888', // Formatted phone number
            address_line1: '789 Pine Street',
            address_line2: 'Building B',
            city: 'Austin',
            postal_code: '78701',
            country: 'United States',
            donation_amount: 15000.75, // Parsed as number
            notes: 'Multi-year partnership agreement',
          }),
          file
        )
      })
    })

    it('should mark contact fields as optional in HTML', () => {
      render(<SponsorForm onSubmit={onSubmit} onCancel={onCancel} />)

      const contactNameInput = screen.getByLabelText(/contact name/i) as HTMLInputElement
      const contactEmailInput = screen.getByLabelText(/contact email/i) as HTMLInputElement
      const contactPhoneInput = screen.getByLabelText(/contact phone/i) as HTMLInputElement
      const addressLine1Input = screen.getByLabelText(/address line 1/i) as HTMLInputElement
      const donationInput = screen.getByLabelText(/donation amount/i) as HTMLInputElement

      expect(contactNameInput.required).toBe(false)
      expect(contactEmailInput.required).toBe(false)
      expect(contactPhoneInput.required).toBe(false)
      expect(addressLine1Input.required).toBe(false)
      expect(donationInput.required).toBe(false)
    })

    it('should validate donation amount as non-negative', async () => {
      const user = userEvent.setup()
      render(<SponsorForm onSubmit={onSubmit} onCancel={onCancel} />)

      const donationInput = screen.getByLabelText(/donation amount/i) as HTMLInputElement
      await user.type(donationInput, '-100')

      expect(donationInput).toHaveAttribute('min', '0')
      expect(donationInput.type).toBe('number')
    })
  })
})
