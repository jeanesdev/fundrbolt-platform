/**
 * Tests for ContactForm component.
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ContactForm } from './ContactForm';
import * as api from '../../services/api';

// Mock the API
vi.mock('../../services/api', () => ({
  contactApi: {
    submit: vi.fn(),
  },
}));

describe('ContactForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all form fields', () => {
    render(<ContactForm />);

    expect(screen.getByLabelText(/your name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/your email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/subject/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/message/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send message/i })).toBeInTheDocument();
  });

  it('shows required field indicators', () => {
    render(<ContactForm />);

    const requiredMarkers = screen.getAllByText('*');
    expect(requiredMarkers).toHaveLength(4); // name, email, subject, message
  });

  it('validates required fields', async () => {
    const user = userEvent.setup();
    render(<ContactForm />);

    const submitButton = screen.getByRole('button', { name: /send message/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/name must be at least 2 characters/i)).toBeInTheDocument();
    });
  });

  it('validates email format', async () => {
    const user = userEvent.setup();
    render(<ContactForm />);

    const emailInput = screen.getByLabelText(/your email/i);
    await user.type(emailInput, 'not-an-email');

    const submitButton = screen.getByRole('button', { name: /send message/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/please enter a valid email address/i)).toBeInTheDocument();
    });
  });

  it('validates name minimum length', async () => {
    const user = userEvent.setup();
    render(<ContactForm />);

    const nameInput = screen.getByLabelText(/your name/i);
    await user.type(nameInput, 'A'); // Only 1 character

    const submitButton = screen.getByRole('button', { name: /send message/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/name must be at least 2 characters/i)).toBeInTheDocument();
    });
  });

  it('validates name maximum length', async () => {
    const user = userEvent.setup();
    render(<ContactForm />);

    const nameInput = screen.getByLabelText(/your name/i);
    await user.type(nameInput, 'A'.repeat(101)); // 101 characters

    const submitButton = screen.getByRole('button', { name: /send message/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/name must not exceed 100 characters/i)).toBeInTheDocument();
    });
  });

  it('validates subject is not empty', async () => {
    const user = userEvent.setup();
    render(<ContactForm />);

    const nameInput = screen.getByLabelText(/your name/i);
    const emailInput = screen.getByLabelText(/your email/i);
    const messageInput = screen.getByLabelText(/message/i);

    await user.type(nameInput, 'Test User');
    await user.type(emailInput, 'test@example.com');
    await user.type(messageInput, 'Test message');

    const submitButton = screen.getByRole('button', { name: /send message/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/subject is required/i)).toBeInTheDocument();
    });
  });

  it('validates message is not empty', async () => {
    const user = userEvent.setup();
    render(<ContactForm />);

    const nameInput = screen.getByLabelText(/your name/i);
    const emailInput = screen.getByLabelText(/your email/i);
    const subjectInput = screen.getByLabelText(/subject/i);

    await user.type(nameInput, 'Test User');
    await user.type(emailInput, 'test@example.com');
    await user.type(subjectInput, 'Test Subject');

    const submitButton = screen.getByRole('button', { name: /send message/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/message is required/i)).toBeInTheDocument();
    });
  });

  it('submits form successfully with valid data', async () => {
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

    render(<ContactForm />);

    const nameInput = screen.getByLabelText(/your name/i);
    const emailInput = screen.getByLabelText(/your email/i);
    const subjectInput = screen.getByLabelText(/subject/i);
    const messageInput = screen.getByLabelText(/message/i);

    await user.type(nameInput, 'Test User');
    await user.type(emailInput, 'test@example.com');
    await user.type(subjectInput, 'Test Subject');
    await user.type(messageInput, 'Test message');

    const submitButton = screen.getByRole('button', { name: /send message/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalledWith({
        sender_name: 'Test User',
        sender_email: 'test@example.com',
        subject: 'Test Subject',
        message: 'Test message',
        website: '', // Honeypot field should be empty
      });
    });

    await waitFor(() => {
      expect(screen.getByText(/thank you for your message/i)).toBeInTheDocument();
    });
  });

  it('displays success message after submission', async () => {
    const user = userEvent.setup();
    const mockSubmit = vi.mocked(api.contactApi.submit);
    mockSubmit.mockResolvedValueOnce({
      id: '123',
      sender_name: 'Test User',
      sender_email: 'test@example.com',
      subject: 'Test',
      status: 'pending',
      created_at: new Date().toISOString(),
    });

    render(<ContactForm />);

    await user.type(screen.getByLabelText(/your name/i), 'Test User');
    await user.type(screen.getByLabelText(/your email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/subject/i), 'Test');
    await user.type(screen.getByLabelText(/message/i), 'Test message');

    await user.click(screen.getByRole('button', { name: /send message/i }));

    await waitFor(() => {
      const successMessage = screen.getByRole('alert');
      expect(successMessage).toHaveTextContent(/thank you for your message/i);
    });
  });

  it('resets form after successful submission', async () => {
    const user = userEvent.setup();
    const mockSubmit = vi.mocked(api.contactApi.submit);
    mockSubmit.mockResolvedValueOnce({
      id: '123',
      sender_name: 'Test User',
      sender_email: 'test@example.com',
      subject: 'Test',
      status: 'pending',
      created_at: new Date().toISOString(),
    });

    render(<ContactForm />);

    const nameInput = screen.getByLabelText(/your name/i) as HTMLInputElement;
    const emailInput = screen.getByLabelText(/your email/i) as HTMLInputElement;
    const subjectInput = screen.getByLabelText(/subject/i) as HTMLInputElement;
    const messageInput = screen.getByLabelText(/message/i) as HTMLTextAreaElement;

    await user.type(nameInput, 'Test User');
    await user.type(emailInput, 'test@example.com');
    await user.type(subjectInput, 'Test');
    await user.type(messageInput, 'Test message');

    await user.click(screen.getByRole('button', { name: /send message/i }));

    await waitFor(() => {
      expect(nameInput.value).toBe('');
      expect(emailInput.value).toBe('');
      expect(subjectInput.value).toBe('');
      expect(messageInput.value).toBe('');
    });
  });

  it('displays rate limit error (429)', async () => {
    const user = userEvent.setup();
    const mockSubmit = vi.mocked(api.contactApi.submit);
    mockSubmit.mockRejectedValueOnce({
      response: {
        status: 429,
        data: { detail: 'Rate limit exceeded' },
      },
    });

    render(<ContactForm />);

    await user.type(screen.getByLabelText(/your name/i), 'Test User');
    await user.type(screen.getByLabelText(/your email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/subject/i), 'Test');
    await user.type(screen.getByLabelText(/message/i), 'Test');

    await user.click(screen.getByRole('button', { name: /send message/i }));

    await waitFor(() => {
      expect(screen.getByText(/too many messages/i)).toBeInTheDocument();
      expect(screen.getByText(/5 per hour/i)).toBeInTheDocument();
    });
  });

  it('displays validation error (422)', async () => {
    const user = userEvent.setup();
    const mockSubmit = vi.mocked(api.contactApi.submit);
    mockSubmit.mockRejectedValueOnce({
      response: {
        status: 422,
        data: { detail: 'Validation error' },
      },
    });

    render(<ContactForm />);

    await user.type(screen.getByLabelText(/your name/i), 'Test User');
    await user.type(screen.getByLabelText(/your email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/subject/i), 'Test');
    await user.type(screen.getByLabelText(/message/i), 'Test');

    await user.click(screen.getByRole('button', { name: /send message/i }));

    await waitFor(() => {
      expect(screen.getByText(/please check your form fields/i)).toBeInTheDocument();
    });
  });

  it('displays generic error for server errors (500)', async () => {
    const user = userEvent.setup();
    const mockSubmit = vi.mocked(api.contactApi.submit);
    mockSubmit.mockRejectedValueOnce({
      response: {
        status: 500,
        data: { detail: 'Internal server error' },
      },
    });

    render(<ContactForm />);

    await user.type(screen.getByLabelText(/your name/i), 'Test User');
    await user.type(screen.getByLabelText(/your email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/subject/i), 'Test');
    await user.type(screen.getByLabelText(/message/i), 'Test');

    await user.click(screen.getByRole('button', { name: /send message/i }));

    await waitFor(() => {
      expect(screen.getByText(/failed to send message/i)).toBeInTheDocument();
    });
  });

  it('disables inputs while submitting', async () => {
    const user = userEvent.setup();
    const mockSubmit = vi.mocked(api.contactApi.submit);
    mockSubmit.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                id: '123',
                sender_name: 'Test',
                sender_email: 'test@example.com',
                subject: 'Test',
                status: 'pending',
                created_at: new Date().toISOString(),
              }),
            100
          )
        )
    );

    render(<ContactForm />);

    await user.type(screen.getByLabelText(/your name/i), 'Test User');
    await user.type(screen.getByLabelText(/your email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/subject/i), 'Test');
    await user.type(screen.getByLabelText(/message/i), 'Test');

    const submitButton = screen.getByRole('button', { name: /send message/i });
    await user.click(submitButton);

    // Check that inputs are disabled
    expect(screen.getByLabelText(/your name/i)).toBeDisabled();
    expect(screen.getByLabelText(/your email/i)).toBeDisabled();
    expect(screen.getByLabelText(/subject/i)).toBeDisabled();
    expect(screen.getByLabelText(/message/i)).toBeDisabled();
    expect(submitButton).toBeDisabled();

    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
    });
  });

  it('shows "Sending..." text while submitting', async () => {
    const user = userEvent.setup();
    const mockSubmit = vi.mocked(api.contactApi.submit);
    mockSubmit.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                id: '123',
                sender_name: 'Test',
                sender_email: 'test@example.com',
                subject: 'Test',
                status: 'pending',
                created_at: new Date().toISOString(),
              }),
            100
          )
        )
    );

    render(<ContactForm />);

    await user.type(screen.getByLabelText(/your name/i), 'Test User');
    await user.type(screen.getByLabelText(/your email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/subject/i), 'Test');
    await user.type(screen.getByLabelText(/message/i), 'Test');

    const submitButton = screen.getByRole('button', { name: /send message/i });
    await user.click(submitButton);

    expect(screen.getByRole('button', { name: /sending/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /send message/i })).toBeInTheDocument();
    });
  });

  it('honeypot field is hidden from view', () => {
    const { container } = render(<ContactForm />);

    const honeypotField = container.querySelector('.honeypot-field');
    expect(honeypotField).toBeInTheDocument();
    expect(honeypotField).toHaveAttribute('aria-hidden', 'true');
  });

  it('calls onSuccess callback after successful submission', async () => {
    const user = userEvent.setup();
    const mockOnSuccess = vi.fn();
    const mockSubmit = vi.mocked(api.contactApi.submit);
    mockSubmit.mockResolvedValueOnce({
      id: '123',
      sender_name: 'Test',
      sender_email: 'test@example.com',
      subject: 'Test',
      status: 'pending',
      created_at: new Date().toISOString(),
    });

    render(<ContactForm onSuccess={mockOnSuccess} />);

    await user.type(screen.getByLabelText(/your name/i), 'Test User');
    await user.type(screen.getByLabelText(/your email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/subject/i), 'Test');
    await user.type(screen.getByLabelText(/message/i), 'Test');

    await user.click(screen.getByRole('button', { name: /send message/i }));

    await waitFor(() => {
      expect(mockOnSuccess).toHaveBeenCalledTimes(1);
    });
  });

  it('has proper ARIA attributes on form inputs', () => {
    render(<ContactForm />);

    const nameInput = screen.getByLabelText(/your name/i);
    const emailInput = screen.getByLabelText(/your email/i);
    const subjectInput = screen.getByLabelText(/subject/i);
    const messageInput = screen.getByLabelText(/message/i);

    expect(nameInput).toHaveAttribute('aria-invalid', 'false');
    expect(emailInput).toHaveAttribute('aria-invalid', 'false');
    expect(subjectInput).toHaveAttribute('aria-invalid', 'false');
    expect(messageInput).toHaveAttribute('aria-invalid', 'false');
  });

  it('updates aria-invalid when validation errors occur', async () => {
    const user = userEvent.setup();
    render(<ContactForm />);

    const submitButton = screen.getByRole('button', { name: /send message/i });
    await user.click(submitButton);

    await waitFor(() => {
      const nameInput = screen.getByLabelText(/your name/i);
      expect(nameInput).toHaveAttribute('aria-invalid', 'true');
    });
  });

  it('associates error messages with inputs via aria-describedby', async () => {
    const user = userEvent.setup();
    render(<ContactForm />);

    const submitButton = screen.getByRole('button', { name: /send message/i });
    await user.click(submitButton);

    await waitFor(() => {
      const nameInput = screen.getByLabelText(/your name/i);
      const errorId = nameInput.getAttribute('aria-describedby');
      expect(errorId).toBeTruthy();

      const errorMessage = document.getElementById(errorId!);
      expect(errorMessage).toHaveTextContent(/name must be at least 2 characters/i);
    });
  });
});
