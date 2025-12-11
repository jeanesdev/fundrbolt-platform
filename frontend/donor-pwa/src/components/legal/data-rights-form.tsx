/**
 * DataRightsForm Component
 * GDPR data rights: export data, delete account, withdraw consent
 */

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { consentService } from '@/services/consent-service'
import { Download, Loader2, Shield, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

export function DataRightsForm() {
  const [isExporting, setIsExporting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isWithdrawing, setIsWithdrawing] = useState(false)

  const handleExportData = async () => {
    setIsExporting(true)
    try {
      const response = await consentService.requestDataExport()
      toast.success(response.message || 'Data export request submitted successfully')
    } catch (_error) {
      toast.error('Failed to request data export')
    } finally {
      setIsExporting(false)
    }
  }

  const handleDeleteAccount = async () => {
    setIsDeleting(true)
    try {
      const response = await consentService.requestDataDeletion({ confirmation: true })
      toast.success(response.message || 'Account deletion scheduled')
    } catch (_error) {
      toast.error('Failed to request account deletion')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleWithdrawConsent = async () => {
    setIsWithdrawing(true)
    try {
      const response = await consentService.withdrawConsent()
      toast.success(response.message || 'Consent withdrawn successfully')
    } catch (_error) {
      toast.error('Failed to withdraw consent')
    } finally {
      setIsWithdrawing(false)
    }
  }

  return (
    <div className='space-y-6'>
      {/* Export Data */}
      <Card>
        <CardHeader>
          <div className='flex items-center gap-2'>
            <Download className='h-5 w-5 text-muted-foreground' />
            <CardTitle>Export Your Data</CardTitle>
          </div>
          <CardDescription>
            Download a copy of all your personal data stored in our system (GDPR Article 20)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className='space-y-4'>
            <p className='text-sm text-muted-foreground'>
              We'll prepare a ZIP file containing all your personal information, consent records,
              and activity history. You'll receive an email with a download link when it's ready
              (usually within 24 hours).
            </p>
            <Button onClick={handleExportData} disabled={isExporting}>
              {isExporting && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
              {isExporting ? 'Requesting...' : 'Request Data Export'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Withdraw Consent */}
      <Card>
        <CardHeader>
          <div className='flex items-center gap-2'>
            <Shield className='h-5 w-5 text-muted-foreground' />
            <CardTitle>Withdraw Consent</CardTitle>
          </div>
          <CardDescription>
            Revoke your consent to data processing (GDPR Article 7)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className='space-y-4'>
            <p className='text-sm text-muted-foreground'>
              Withdrawing consent will deactivate your account. You'll need to accept our terms
              again to continue using the platform.
            </p>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant='outline' disabled={isWithdrawing}>
                  {isWithdrawing && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
                  {isWithdrawing ? 'Processing...' : 'Withdraw Consent'}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Withdraw Consent?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will deactivate your account immediately. You can reactivate by signing
                    in again and accepting our terms.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleWithdrawConsent}>
                    Withdraw Consent
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>

      {/* Delete Account */}
      <Card className='border-destructive'>
        <CardHeader>
          <div className='flex items-center gap-2'>
            <Trash2 className='h-5 w-5 text-destructive' />
            <CardTitle className='text-destructive'>Delete Account</CardTitle>
          </div>
          <CardDescription>
            Permanently delete your account and all associated data (GDPR Article 17)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className='space-y-4'>
            <div className='rounded-lg border border-destructive bg-destructive/10 p-4'>
              <p className='text-sm font-semibold text-destructive'>Warning: This is permanent</p>
              <p className='mt-2 text-sm text-destructive/90'>
                Your account will be scheduled for deletion in 30 days. During this grace period,
                you can contact support to cancel the request. After 30 days, all your data will
                be permanently deleted and cannot be recovered.
              </p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant='destructive' disabled={isDeleting}>
                  {isDeleting && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
                  {isDeleting ? 'Processing...' : 'Delete My Account'}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription className='space-y-2'>
                    <p>
                      This action cannot be undone after 30 days. This will permanently delete
                      your account and remove all your data from our servers.
                    </p>
                    <p className='font-semibold'>
                      You have 30 days to contact support if you change your mind.
                    </p>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteAccount}
                    className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
                  >
                    Yes, Delete My Account
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
