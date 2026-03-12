import React, { type ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
  errorInfo?: React.ErrorInfo
}

/**
 * Error Boundary for ticket management pages
 *
 * Catches React component errors and displays user-friendly error messages
 * with recovery options (refresh, retry, or navigate back)
 *
 * Usage:
 * ```tsx
 * <ErrorBoundary>
 *   <TicketPackagesIndexPage />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error to console and error tracking service
    // eslint-disable-next-line no-console
    console.error('Error Boundary caught:', error, errorInfo)

    // Store error info for debugging
    this.setState({
      error,
      errorInfo,
    })
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined })
  }

  handleRefresh = () => {
    window.location.reload()
  }

  handleNavigateBack = () => {
    window.history.back()
  }

  render() {
    if (this.state.hasError) {
      const isDevelopment = process.env.NODE_ENV === 'development'

      return (
        <div className='bg-background min-h-screen p-4 sm:p-8'>
          <div className='mx-auto max-w-2xl'>
            <Alert variant='destructive' className='border-2'>
              <AlertTriangle className='h-5 w-5' />
              <AlertTitle className='text-lg'>Something went wrong</AlertTitle>
              <AlertDescription className='mt-3 space-y-3'>
                <p>
                  An unexpected error occurred while loading the ticket
                  management page. Please try refreshing or contact support if
                  the problem persists.
                </p>

                {isDevelopment && this.state.error && (
                  <div className='bg-muted mt-4 rounded p-3 text-sm'>
                    <p className='mb-1 font-mono font-bold'>Error Details:</p>
                    <p className='font-mono text-xs break-words'>
                      {this.state.error.toString()}
                    </p>
                    {this.state.errorInfo && (
                      <details className='mt-2'>
                        <summary className='cursor-pointer font-mono text-xs'>
                          Stack Trace
                        </summary>
                        <pre className='bg-background mt-1 max-h-48 overflow-auto rounded p-2 font-mono text-xs'>
                          {this.state.errorInfo.componentStack}
                        </pre>
                      </details>
                    )}
                  </div>
                )}
              </AlertDescription>
            </Alert>

            <div className='mt-6 flex flex-wrap gap-3'>
              <Button
                onClick={this.handleReset}
                variant='outline'
                className='gap-2'
              >
                <RefreshCw className='h-4 w-4' />
                Try Again
              </Button>

              <Button
                onClick={this.handleRefresh}
                variant='outline'
                className='gap-2'
              >
                <RefreshCw className='h-4 w-4' />
                Refresh Page
              </Button>

              <Button onClick={this.handleNavigateBack} variant='ghost'>
                Go Back
              </Button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
