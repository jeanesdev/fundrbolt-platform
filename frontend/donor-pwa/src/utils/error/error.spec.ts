/**
 * Tests for error utilities
 */

import { describe, it, expect } from 'vitest';

import { getErrorMessage } from './index';

describe('getErrorMessage', () => {
  it('should return the string directly if error is a string', () => {
    expect(getErrorMessage('Some error')).toBe('Some error');
  });

  it('should extract message from axios-style error response', () => {
    const axiosError = {
      response: {
        data: {
          error: {
            message: 'Server error message',
          },
        },
      },
    };
    expect(getErrorMessage(axiosError)).toBe('Server error message');
  });

  it('should extract message from standard Error object', () => {
    const error = new Error('Standard error');
    expect(getErrorMessage(error)).toBe('Standard error');
  });

  it('should return fallback message for unknown error types', () => {
    expect(getErrorMessage(null)).toBe('An error occurred');
    expect(getErrorMessage(undefined)).toBe('An error occurred');
    expect(getErrorMessage({})).toBe('An error occurred');
  });

  it('should use custom fallback message when provided', () => {
    expect(getErrorMessage({}, 'Custom fallback')).toBe('Custom fallback');
  });

  it('should prioritize axios error message over standard message', () => {
    const error = {
      response: {
        data: {
          error: {
            message: 'API error',
          },
        },
      },
      message: 'Generic message',
    };
    expect(getErrorMessage(error)).toBe('API error');
  });
});
