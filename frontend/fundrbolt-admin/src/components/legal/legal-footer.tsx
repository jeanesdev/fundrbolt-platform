/**
 * LegalFooter Component
 * Footer links to legal documents (Terms of Service, Privacy Policy)
 * Displayed on all pages for easy access to legal information
 */
import { Link } from '@tanstack/react-router'

export function LegalFooter() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className='bg-background border-t'>
      <div className='container mx-auto flex flex-col items-center justify-between gap-4 px-4 py-6 md:flex-row md:py-4'>
        {/* Copyright */}
        <p className='text-muted-foreground text-sm'>
          © {currentYear} Fundrbolt Platform. All rights reserved.
        </p>

        {/* Legal Links */}
        <nav className='flex gap-4 text-sm'>
          <Link
            to='/terms-of-service'
            className='text-muted-foreground hover:text-primary underline-offset-4 transition-colors hover:underline'
          >
            Terms of Service
          </Link>
          <span className='text-muted-foreground'>•</span>
          <Link
            to='/privacy-policy'
            className='text-muted-foreground hover:text-primary underline-offset-4 transition-colors hover:underline'
          >
            Privacy Policy
          </Link>
        </nav>
      </div>
    </footer>
  )
}
