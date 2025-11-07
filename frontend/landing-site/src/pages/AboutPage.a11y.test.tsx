/**
 * Accessibility tests for AboutPage component.
 * Tests WCAG 2.1 AA compliance using axe-core.
 */

import { render } from '@testing-library/react';
import { axe } from 'jest-axe';
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

describe('AboutPage Accessibility', () => {
  it('should have no WCAG 2.1 AA violations', async () => {
    const { container } = renderWithProviders(<AboutPage />);
    const results = await axe(container, {
      rules: {
        // Ensure WCAG 2.1 AA compliance
        'color-contrast': { enabled: true },
        'heading-order': { enabled: true },
        'label': { enabled: true },
        'link-name': { enabled: true },
        'list': { enabled: true },
        'image-alt': { enabled: true },
      },
    });
    expect(results).toHaveNoViolations();
  });

  it('should have proper semantic structure', () => {
    const { container } = renderWithProviders(<AboutPage />);

    // Check for semantic sections
    const sections = container.querySelectorAll('section');
    expect(sections.length).toBeGreaterThanOrEqual(5);

    // Each section should have a heading
    sections.forEach((section) => {
      const heading = section.querySelector('h1, h2, h3, h4, h5, h6');
      expect(heading).toBeTruthy();
    });
  });

  it('should have accessible headings hierarchy', () => {
    const { container } = renderWithProviders(<AboutPage />);

    const h1 = container.querySelectorAll('h1');
    const h2 = container.querySelectorAll('h2');
    const h3 = container.querySelectorAll('h3');

    // Should have exactly one h1
    expect(h1.length).toBe(1);

    // Should have multiple h2 for main sections
    expect(h2.length).toBeGreaterThanOrEqual(4);

    // Should have h3 for feature/benefit cards
    expect(h3.length).toBeGreaterThanOrEqual(6);
  });

  it('should have accessible links', () => {
    const { container } = renderWithProviders(<AboutPage />);

    const links = container.querySelectorAll('a');
    links.forEach((link) => {
      // Every link should have accessible text
      expect(link.textContent?.trim().length).toBeGreaterThan(0);

      // Every link should have href
      expect(link.getAttribute('href')).toBeTruthy();
    });
  });

  it('should have proper list structure', () => {
    const { container } = renderWithProviders(<AboutPage />);

    const lists = container.querySelectorAll('ul');
    expect(lists.length).toBe(3); // One for each benefit card

    lists.forEach((list) => {
      const items = list.querySelectorAll('li');
      expect(items.length).toBeGreaterThanOrEqual(5);
    });
  });

  it('should use semantic HTML elements', () => {
    const { container } = renderWithProviders(<AboutPage />);

    // Should use section elements for major content areas
    expect(container.querySelectorAll('section').length).toBeGreaterThan(0);

    // Should have proper headings
    expect(container.querySelectorAll('h1, h2, h3, h4, h5, h6').length).toBeGreaterThan(0);

    // Should have paragraphs for text content
    expect(container.querySelectorAll('p').length).toBeGreaterThan(0);
  });
});
