/**
 * Data Deletion Instructions Page
 * Publicly accessible page required for Facebook/Meta app submission.
 * Explains how users can request deletion of their personal data.
 */
import { Link } from '@tanstack/react-router'
import { ArrowLeft, Mail, Trash2, UserX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export function DataDeletionPage() {
  return (
    <div className='container mx-auto max-w-3xl px-4 py-8'>
      <div className='mb-6'>
        <Button variant='ghost' asChild className='mb-4'>
          <Link to='/'>
            <ArrowLeft className='mr-2 h-4 w-4' />
            Back to Home
          </Link>
        </Button>
        <h1 className='text-3xl font-bold'>Data Deletion Instructions</h1>
        <p className='text-muted-foreground mt-2'>
          You have the right to request deletion of your personal data at any
          time. Here's how.
        </p>
      </div>

      <div className='space-y-6'>
        {/* In-app deletion */}
        <Card>
          <CardHeader>
            <div className='flex items-center gap-2'>
              <UserX className='text-muted-foreground h-5 w-5' />
              <CardTitle>Delete Your Account In-App</CardTitle>
            </div>
            <CardDescription>
              The fastest way — available directly inside your FundrBolt account
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-3'>
            <ol className='text-muted-foreground list-decimal space-y-2 pl-5 text-sm'>
              <li>
                Sign in to your FundrBolt account at{' '}
                <a
                  href='https://app.fundrbolt.com'
                  className='text-primary hover:underline'
                >
                  app.fundrbolt.com
                </a>
              </li>
              <li>
                Go to <strong className='text-foreground'>Settings</strong>{' '}
                (tap your profile icon or use the menu)
              </li>
              <li>
                Select the{' '}
                <strong className='text-foreground'>Other</strong> tab
              </li>
              <li>
                Under{' '}
                <strong className='text-foreground'>Privacy &amp; Data Rights</strong>,
                click{' '}
                <strong className='text-foreground'>Delete Account</strong>
              </li>
              <li>
                Confirm the deletion request. Your account and personal data
                will be permanently deleted within 30 days.
              </li>
            </ol>
            <Button asChild size='sm' className='mt-2'>
              <a href='https://app.fundrbolt.com/settings/other'>
                Go to Settings
              </a>
            </Button>
          </CardContent>
        </Card>

        {/* Email request */}
        <Card>
          <CardHeader>
            <div className='flex items-center gap-2'>
              <Mail className='text-muted-foreground h-5 w-5' />
              <CardTitle>Request Deletion by Email</CardTitle>
            </div>
            <CardDescription>
              If you no longer have access to your account, or prefer to request
              by email
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-3'>
            <p className='text-muted-foreground text-sm'>
              Send an email to{' '}
              <a
                href='mailto:privacy@fundrbolt.com'
                className='text-primary hover:underline'
              >
                privacy@fundrbolt.com
              </a>{' '}
              with the subject line{' '}
              <strong className='text-foreground'>
                "Data Deletion Request"
              </strong>{' '}
              and include:
            </p>
            <ul className='text-muted-foreground list-disc space-y-1 pl-5 text-sm'>
              <li>
                The email address associated with your FundrBolt account
              </li>
              <li>
                If signing in with Facebook: your Facebook name or profile URL
              </li>
            </ul>
            <p className='text-muted-foreground text-sm'>
              We will process your request within <strong className='text-foreground'>30 days</strong> and
              send confirmation once complete.
            </p>
          </CardContent>
        </Card>

        {/* What gets deleted */}
        <Card>
          <CardHeader>
            <div className='flex items-center gap-2'>
              <Trash2 className='text-muted-foreground h-5 w-5' />
              <CardTitle>What Gets Deleted</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <ul className='text-muted-foreground list-disc space-y-1 pl-5 text-sm'>
              <li>Your account profile (name, email, profile picture)</li>
              <li>Social login connections (Facebook, Google, Apple)</li>
              <li>Event registrations and guest information</li>
              <li>Auction bids and donation records (non-financial records)</li>
              <li>Notification preferences and consent records</li>
              <li>Saved payment methods</li>
            </ul>
            <p className='text-muted-foreground mt-3 text-sm'>
              Some financial transaction records may be retained for up to 7
              years as required by law (e.g. for tax and audit purposes). These
              records are anonymised where possible.
            </p>
          </CardContent>
        </Card>

        <div className='border-t pt-4'>
          <p className='text-muted-foreground text-sm'>
            For more information, see our{' '}
            <Link
              to='/privacy-policy'
              className='text-primary hover:underline'
            >
              Privacy Policy
            </Link>
            . Questions? Email{' '}
            <a
              href='mailto:privacy@fundrbolt.com'
              className='text-primary hover:underline'
            >
              privacy@fundrbolt.com
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  )
}
