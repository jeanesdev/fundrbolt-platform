/**
 * QRCodeDialog Component
 * Displays QR codes for event check-in and app access
 */
import { useRef, useState } from 'react'
import { Download, QrCode, X } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface QRCodeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  eventSlug: string
  eventName: string
}

export function QRCodeDialog({
  open,
  onOpenChange,
  eventSlug,
  eventName,
}: QRCodeDialogProps) {
  const [activeTab, setActiveTab] = useState<'event' | 'checkin'>('event')
  const eventQRRef = useRef<HTMLDivElement>(null)
  const checkinQRRef = useRef<HTMLDivElement>(null)

  // Generate URLs for QR codes
  const eventAppUrl = `https://app.fundrbolt.com/events/${eventSlug}`
  const checkinUrl = `https://app.fundrbolt.com/events/${eventSlug}/checkin`

  /**
   * Downloads a QR code as PNG image
   */
  const downloadQRCode = (
    qrRef: React.RefObject<HTMLDivElement | null>,
    filename: string
  ) => {
    if (!qrRef.current) {
      toast.error('QR code not found')
      return
    }

    const svg = qrRef.current.querySelector('svg')
    if (!svg) {
      toast.error('QR code SVG not found')
      return
    }

    try {
      // Create a canvas element
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        toast.error('Failed to create canvas context')
        return
      }

      // Set canvas size (larger for better quality)
      const scale = 4
      canvas.width = 256 * scale
      canvas.height = 256 * scale

      // Create an image from SVG
      const svgData = new XMLSerializer().serializeToString(svg)
      const svgBlob = new Blob([svgData], {
        type: 'image/svg+xml;charset=utf-8',
      })
      const url = URL.createObjectURL(svgBlob)

      const img = new Image()
      img.onload = () => {
        // Draw white background
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)

        // Draw QR code
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

        // Convert canvas to blob and download
        canvas.toBlob((blob) => {
          if (!blob) {
            toast.error('Failed to create image')
            return
          }

          const downloadUrl = URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.download = filename
          link.href = downloadUrl
          link.click()

          // Cleanup
          URL.revokeObjectURL(downloadUrl)
          URL.revokeObjectURL(url)

          toast.success('QR code downloaded')
        }, 'image/png')
      }

      img.onerror = () => {
        toast.error('Failed to load QR code image')
        URL.revokeObjectURL(url)
      }

      img.src = url
    } catch (_error) {
      // Error downloading QR code
      toast.error('Failed to download QR code')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-2xl'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <QrCode className='h-5 w-5' />
            Event QR Codes
          </DialogTitle>
          <DialogDescription>
            Generate QR codes for event access and self check-in
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as 'event' | 'checkin')}
        >
          <TabsList className='grid w-full grid-cols-2'>
            <TabsTrigger value='event'>Event Access</TabsTrigger>
            <TabsTrigger value='checkin'>Self Check-In</TabsTrigger>
          </TabsList>

          <TabsContent value='event' className='mt-4'>
            <Card>
              <CardHeader>
                <CardTitle>Event Access QR Code</CardTitle>
                <CardDescription>
                  Scan this code to open the event page on app.fundrbolt.com.
                  Donors can use this to access the event on their mobile
                  devices.
                </CardDescription>
              </CardHeader>
              <CardContent className='space-y-4'>
                <div
                  ref={eventQRRef}
                  className='bg-muted flex items-center justify-center rounded-lg p-8'
                >
                  <QRCodeSVG
                    value={eventAppUrl}
                    size={256}
                    level='H'
                    includeMargin
                  />
                </div>

                <div className='bg-muted/50 space-y-2 rounded-md border p-3'>
                  <p className='text-sm font-medium'>Event: {eventName}</p>
                  <p className='text-muted-foreground text-xs break-all'>
                    {eventAppUrl}
                  </p>
                </div>

                <div className='flex gap-2'>
                  <Button
                    onClick={() =>
                      downloadQRCode(
                        eventQRRef,
                        `${eventSlug}-event-access-qr.png`
                      )
                    }
                    className='flex-1'
                  >
                    <Download className='mr-2 h-4 w-4' />
                    Download Event QR Code
                  </Button>
                </div>

                <div className='space-y-2 rounded-md border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-950/20'>
                  <p className='text-sm font-medium text-blue-900 dark:text-blue-100'>
                    💡 Usage Tips
                  </p>
                  <ul className='text-muted-foreground space-y-1 text-xs'>
                    <li>• Display at event entrance for easy mobile access</li>
                    <li>• Include in printed materials and invitations</li>
                    <li>• Share on social media and email campaigns</li>
                    <li>
                      • Donors will be directed to sign in or create an account
                    </li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value='checkin' className='mt-4'>
            <Card>
              <CardHeader>
                <CardTitle>Self Check-In QR Code</CardTitle>
                <CardDescription>
                  Scan this code to access the self check-in page. Donors can
                  check themselves in by entering their confirmation code or
                  email.
                </CardDescription>
              </CardHeader>
              <CardContent className='space-y-4'>
                <div
                  ref={checkinQRRef}
                  className='bg-muted flex items-center justify-center rounded-lg p-8'
                >
                  <QRCodeSVG
                    value={checkinUrl}
                    size={256}
                    level='H'
                    includeMargin
                  />
                </div>

                <div className='bg-muted/50 space-y-2 rounded-md border p-3'>
                  <p className='text-sm font-medium'>Self Check-In Portal</p>
                  <p className='text-muted-foreground text-xs break-all'>
                    {checkinUrl}
                  </p>
                </div>

                <div className='flex gap-2'>
                  <Button
                    onClick={() =>
                      downloadQRCode(
                        checkinQRRef,
                        `${eventSlug}-checkin-qr.png`
                      )
                    }
                    className='flex-1'
                  >
                    <Download className='mr-2 h-4 w-4' />
                    Download Check-In QR Code
                  </Button>
                </div>

                <div className='space-y-2 rounded-md border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-950/20'>
                  <p className='text-sm font-medium text-green-900 dark:text-green-100'>
                    💡 Usage Tips
                  </p>
                  <ul className='text-muted-foreground space-y-1 text-xs'>
                    <li>• Place at check-in desk or registration table</li>
                    <li>
                      • Donors can self-check-in using their confirmation code
                    </li>
                    <li>• Reduces check-in time and staff workload</li>
                    <li>
                      • Guests can look up their registration by email or code
                    </li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className='flex justify-end'>
          <Button variant='outline' onClick={() => onOpenChange(false)}>
            <X className='mr-2 h-4 w-4' />
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
