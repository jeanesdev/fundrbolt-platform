/**
 * Test setup file for Vitest.
 * Imports jest-dom custom matchers for better DOM assertions.
 */

import '@testing-library/jest-dom';
import { toHaveNoViolations } from 'jest-axe';
import { expect } from 'vitest';

expect.extend(toHaveNoViolations);
