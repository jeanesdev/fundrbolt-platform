/**
 * LegalFooter Component
 * Footer links to legal documents (Terms of Service, Privacy Policy)
 * Displayed on all pages for easy access to legal information
 */

export function LegalFooter() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className='border-t bg-background'>
      <div className='container mx-auto flex flex-col items-center justify-between gap-4 py-6 px-4 md:flex-row md:py-4'>
        {/* Copyright */}
        <p className='text-sm text-muted-foreground'>
          © {currentYear} Augeo Platform. All rights reserved.
        </p>

        {/* Legal Links */}
        <nav className='flex gap-4 text-sm'>
          <a
            href='/terms-of-service'
            className='text-muted-foreground hover:text-primary transition-colors underline-offset-4 hover:underline'
          >
            Terms of Service
          </a>
          <span className='text-muted-foreground'>•</span>
          <a
            href='/privacy-policy'
            className='text-muted-foreground hover:text-primary transition-colors underline-offset-4 hover:underline'
          >
            Privacy Policy
          </a>
        </nav>
      </div>
    </footer>
  )
}
