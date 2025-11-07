/**
 * ContactForm - Contact form with validation and error handling.
 */

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { contactApi } from '../../services/api';
import './ContactForm.css';

// Zod validation schema
const contactSchema = z.object({
  sender_name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must not exceed 100 characters'),
  sender_email: z.string().email('Please enter a valid email address'),
  subject: z
    .string()
    .min(1, 'Subject is required')
    .max(200, 'Subject must not exceed 200 characters'),
  message: z
    .string()
    .min(1, 'Message is required')
    .max(5000, 'Message must not exceed 5000 characters'),
  // Honeypot field - should always be empty
  website: z.string().max(0, 'Bot detected').optional(),
});

type ContactFormData = z.infer<typeof contactSchema>;

interface ContactFormProps {
  onSuccess?: () => void;
}

export const ContactForm = ({ onSuccess }: ContactFormProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
  });

  const onSubmit = async (data: ContactFormData) => {
    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(false);

    try {
      await contactApi.submit(data);
      setSubmitSuccess(true);
      reset(); // Clear form

      if (onSuccess) {
        onSuccess();
      }
    } catch (error: unknown) {
      // Handle different error types
      const err = error as { response?: { status?: number } };
      if (err.response?.status === 429) {
        setSubmitError(
          'You have submitted too many messages. Please try again later (limit: 5 per hour).'
        );
      } else if (err.response?.status === 422) {
        setSubmitError('Please check your form fields and try again.');
      } else {
        setSubmitError('Failed to send message. Please try again later.');
      }
      // eslint-disable-next-line no-console
      console.error('Contact form submission error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="contact-form" onSubmit={handleSubmit(onSubmit)} noValidate>
      {/* Success message */}
      {submitSuccess && (
        <div className="form-message success" role="alert">
          <p>
            <strong>Thank you for your message!</strong> We'll get back to you as soon as possible.
          </p>
        </div>
      )}

      {/* Error message */}
      {submitError && (
        <div className="form-message error" role="alert">
          <p>{submitError}</p>
        </div>
      )}

      {/* Name field */}
      <div className="form-field">
        <label htmlFor="sender_name" className="form-label">
          Your Name <span className="required">*</span>
        </label>
        <input
          type="text"
          id="sender_name"
          className={`form-input ${errors.sender_name ? 'error' : ''}`}
          {...register('sender_name')}
          aria-invalid={errors.sender_name ? 'true' : 'false'}
          aria-describedby={errors.sender_name ? 'sender_name-error' : undefined}
          disabled={isSubmitting}
        />
        {errors.sender_name && (
          <p className="form-error" id="sender_name-error" role="alert">
            {errors.sender_name.message}
          </p>
        )}
      </div>

      {/* Email field */}
      <div className="form-field">
        <label htmlFor="sender_email" className="form-label">
          Your Email <span className="required">*</span>
        </label>
        <input
          type="email"
          id="sender_email"
          className={`form-input ${errors.sender_email ? 'error' : ''}`}
          {...register('sender_email')}
          aria-invalid={errors.sender_email ? 'true' : 'false'}
          aria-describedby={errors.sender_email ? 'sender_email-error' : undefined}
          disabled={isSubmitting}
        />
        {errors.sender_email && (
          <p className="form-error" id="sender_email-error" role="alert">
            {errors.sender_email.message}
          </p>
        )}
      </div>

      {/* Subject field */}
      <div className="form-field">
        <label htmlFor="subject" className="form-label">
          Subject <span className="required">*</span>
        </label>
        <input
          type="text"
          id="subject"
          className={`form-input ${errors.subject ? 'error' : ''}`}
          {...register('subject')}
          aria-invalid={errors.subject ? 'true' : 'false'}
          aria-describedby={errors.subject ? 'subject-error' : undefined}
          disabled={isSubmitting}
        />
        {errors.subject && (
          <p className="form-error" id="subject-error" role="alert">
            {errors.subject.message}
          </p>
        )}
      </div>

      {/* Message field */}
      <div className="form-field">
        <label htmlFor="message" className="form-label">
          Message <span className="required">*</span>
        </label>
        <textarea
          id="message"
          className={`form-input form-textarea ${errors.message ? 'error' : ''}`}
          rows={6}
          {...register('message')}
          aria-invalid={errors.message ? 'true' : 'false'}
          aria-describedby={errors.message ? 'message-error' : undefined}
          disabled={isSubmitting}
        />
        {errors.message && (
          <p className="form-error" id="message-error" role="alert">
            {errors.message.message}
          </p>
        )}
      </div>

      {/* Honeypot field - hidden from humans, catches bots */}
      <div className="honeypot-field" aria-hidden="true">
        <label htmlFor="website">Website (leave blank)</label>
        <input
          type="text"
          id="website"
          className="form-input"
          {...register('website')}
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      {/* Submit button */}
      <button
        type="submit"
        className="btn btn-primary btn-large"
        disabled={isSubmitting}
        aria-busy={isSubmitting}
      >
        {isSubmitting ? 'Sending...' : 'Send Message'}
      </button>
    </form>
  );
};
